"use strict";

// A .bbpack is one file: a zip of manifest.json and content.json, or the same
// object as JSON. Nothing in a pack is executed. JSON.parse is the only reader.

const crypto = require("crypto");

const KINDS = new Set(["project", "template", "lesson", "bundle"]);
const ALLOWED_FILES = new Set(["manifest.json", "content.json"]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
  const parts = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data);
    const crc = crc32(data);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    name.copy(local, 30);
    parts.push(local, data);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, centralBuf, eocd]);
}

function unzipStore(buffer) {
  const files = [];
  let cursor = 0;
  while (cursor + 30 <= buffer.length) {
    const sig = buffer.readUInt32LE(cursor);
    if (sig === 0x02014b50 || sig === 0x06054b50) break;
    if (sig !== 0x04034b50) break;
    const method = buffer.readUInt16LE(cursor + 8);
    const compressed = buffer.readUInt32LE(cursor + 18);
    const nameLen = buffer.readUInt16LE(cursor + 26);
    const extraLen = buffer.readUInt16LE(cursor + 28);
    const name = buffer.slice(cursor + 30, cursor + 30 + nameLen).toString("utf8");
    const start = cursor + 30 + nameLen + extraLen;
    const data = buffer.slice(start, start + compressed);
    if (method !== 0) {
      const err = new Error(`${name} is compressed. Packs use stored zip entries only.`);
      err.statusCode = 400;
      throw err;
    }
    files.push({ name, data });
    cursor = start + compressed;
  }
  return files;
}

function safeName(name) {
  const text = String(name || "");
  if (!text || text.includes("..") || text.includes("\\") || text.startsWith("/") || text.includes("\0")) return "";
  return text;
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function countContent(content, kind) {
  const counts = { projects: 0, lessons: 0, templates: 0, notes: 0, graphs: 0, challenges: 0 };
  const notes = Array.isArray(content?.notes) ? content.notes : [];
  counts.notes += notes.length;
  if (kind === "project" && content?.system) {
    counts.projects = 1;
    counts.graphs = Array.isArray(content.system?.graphs?.items) ? content.system.graphs.items.length : (Array.isArray(content.system?.node_graph_nodes) ? 1 : 0);
    counts.challenges = Array.isArray(content.system?.learning?.challenges) ? content.system.learning.challenges.length : 0;
    counts.notes += Array.isArray(content.system?.learning?.why_notes) ? content.system.learning.why_notes.length : 0;
  }
  if (kind === "template" && content?.template) counts.templates = 1;
  if (kind === "lesson") counts.lessons = (Array.isArray(content?.programs) ? content.programs.length : 0) + (Array.isArray(content?.courses) ? content.courses.length : 0);
  if (kind === "bundle") {
    counts.projects += Array.isArray(content?.projects) ? content.projects.length : 0;
    counts.templates += Array.isArray(content?.templates) ? content.templates.length : 0;
    counts.lessons += Array.isArray(content?.lessons) ? content.lessons.length : 0;
  }
  return counts;
}

function validatePack(pack) {
  const errors = [];
  const body = asObject(pack);
  if (!body) return { ok: false, errors: ["A pack must be a JSON object."], preview: null };
  if (body.format !== "bbpack") errors.push("format must be bbpack.");
  if (body.schema !== 1) errors.push("schema must be 1.");
  if (!KINDS.has(body.kind)) errors.push("kind must be project, template, lesson, or bundle.");
  if (!String(body.name || "").trim()) errors.push("name is required.");
  if (!String(body.author || "").trim()) errors.push("author is required.");
  if (!String(body.version || "").trim()) errors.push("version is required.");
  const content = asObject(body.content);
  if (!content) errors.push("content must be an object.");
  if (content && body.kind === "project" && !content.system?.system_name) errors.push("A project pack needs content.system.system_name.");
  if (content && body.kind === "template" && !content.template?.id) errors.push("A template pack needs content.template.id.");
  if (content && body.kind === "lesson" && !Array.isArray(content.programs) && !Array.isArray(content.courses)) {
    errors.push("A lesson pack needs programs or courses.");
  }
  if (content && body.kind === "bundle") {
    const any = ["projects", "templates", "lessons", "notes"].some((key) => Array.isArray(content[key]) && content[key].length);
    if (!any) errors.push("A bundle needs projects, templates, lessons, or notes.");
  }
  if (content && Array.isArray(content.notes)) {
    content.notes.forEach((note, index) => {
      if (!note?.topic || !note?.author || !note?.body) errors.push(`Note ${index + 1} needs a topic, an author, and a body.`);
    });
  }
  const preview = errors.length ? null : {
    name: String(body.name).trim(),
    author: String(body.author).trim(),
    version: String(body.version).trim(),
    kind: body.kind,
    description: String(body.description || "").slice(0, 400),
    counts: countContent(content, body.kind),
  };
  return { ok: errors.length === 0, errors, preview, pack: errors.length ? null : body };
}

function buildPack({ kind, name, author, version = "1.0.0", description = "", content }) {
  return {
    format: "bbpack",
    schema: 1,
    kind,
    name: String(name || "").trim(),
    author: String(author || "").trim(),
    version: String(version || "1.0.0"),
    description: String(description || ""),
    created: new Date().toISOString(),
    content: content || {},
  };
}

function encodePack(pack) {
  const checked = validatePack(pack);
  if (!checked.ok) {
    const err = new Error(checked.errors[0] || "That pack is not valid.");
    err.statusCode = 400;
    err.errors = checked.errors;
    throw err;
  }
  const manifest = {
    format: pack.format,
    schema: pack.schema,
    kind: pack.kind,
    name: pack.name,
    author: pack.author,
    version: pack.version,
    description: pack.description || "",
    created: pack.created || new Date().toISOString(),
  };
  const bytes = zipStore([
    { name: "manifest.json", data: JSON.stringify(manifest, null, 2) },
    { name: "content.json", data: JSON.stringify(pack.content || {}, null, 2) },
  ]);
  return { bytes, manifest, filename: `${pack.name.replace(/[^\w.-]+/g, "-").replace(/^-|-$/g, "") || "pack"}.bbpack` };
}

function decodePack(input) {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(String(input || ""), "utf8");
  if (buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50) {
    const files = unzipStore(buffer);
    const found = new Map();
    for (const file of files) {
      const name = safeName(file.name);
      if (!name || !ALLOWED_FILES.has(name)) {
        const err = new Error(`Pack file ${file.name || "(blank)"} is not allowed. Only manifest.json and content.json are read.`);
        err.statusCode = 400;
        throw err;
      }
      found.set(name, file.data.toString("utf8"));
    }
    if (!found.has("manifest.json") || !found.has("content.json")) {
      const err = new Error("The pack is missing manifest.json or content.json.");
      err.statusCode = 400;
      throw err;
    }
    let manifest;
    let content;
    try {
      manifest = JSON.parse(found.get("manifest.json"));
      content = JSON.parse(found.get("content.json"));
    } catch (exc) {
      const err = new Error(`The pack JSON could not be read (${exc.message}).`);
      err.statusCode = 400;
      throw err;
    }
    return validatePack({ ...manifest, content });
  }
  try {
    return validatePack(JSON.parse(buffer.toString("utf8")));
  } catch (exc) {
    if (exc.statusCode) throw exc;
    const err = new Error(`That file is not a pack (${exc.message}).`);
    err.statusCode = 400;
    throw err;
  }
}

function fileId() {
  return crypto.randomBytes(4).toString("hex");
}

function packItems(pack) {
  const content = pack?.content || {};
  const projects = [];
  const templates = [];
  const lessons = [];
  const notes = (Array.isArray(content.notes) ? content.notes : []).map((note) => ({
    topic: String(note.topic || ""),
    author: String(note.author || pack.author || ""),
    body: String(note.body || ""),
    pack: pack.name,
  }));
  if (pack.kind === "project") projects.push({ name: pack.name, system: content.system, context: content.context || {} });
  if (pack.kind === "template") templates.push(content.template);
  if (pack.kind === "lesson") lessons.push({ name: pack.name, programs: content.programs || [], courses: content.courses || [] });
  if (pack.kind === "bundle") {
    for (const item of content.projects || []) projects.push(item);
    for (const item of content.templates || []) templates.push(item);
    for (const item of content.lessons || []) lessons.push(item);
  }
  return { projects, templates, lessons, notes };
}

function conflictsFor(pack, existing) {
  const items = packItems(pack);
  const conflicts = [];
  const names = new Set((existing.projects || []).map((item) => String(item.name || "").toLowerCase()));
  const templateIds = new Set((existing.templates || []).map((item) => item.id));
  const programIds = new Set((existing.programs || []).map((item) => item.id));
  for (const project of items.projects) {
    if (names.has(String(project.name || project.system?.system_name || "").toLowerCase())) {
      conflicts.push({ kind: "project", name: project.name || project.system?.system_name });
    }
  }
  for (const template of items.templates) {
    if (template?.id && templateIds.has(template.id)) conflicts.push({ kind: "template", name: template.id });
  }
  for (const lesson of items.lessons) {
    for (const program of lesson.programs || []) {
      if (program?.id && programIds.has(program.id)) conflicts.push({ kind: "lesson", name: program.id });
    }
  }
  return conflicts;
}

function renamed(value, taken) {
  const base = String(value || "Imported").trim() || "Imported";
  if (!taken.has(base.toLowerCase())) return base;
  let n = 2;
  while (taken.has(`${base} (${n})`.toLowerCase())) n += 1;
  return `${base} (${n})`;
}

module.exports = {
  KINDS,
  buildPack,
  validatePack,
  encodePack,
  decodePack,
  zipStore,
  unzipStore,
  fileId,
  packItems,
  conflictsFor,
  renamed,
};
