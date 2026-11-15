"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Busboy = require("busboy");

const { createStore } = require("./store");
const { createSecrets } = require("./secrets");
const { complete, joinModelText, outputTokenLimit, stubFetch } = require("./llm");
const { LEARNING_PROMPT, learningGaps, fillLearning, learningUserText } = require("./learning");
const { attachStarters } = require("./templateLearning");
const { recordAnswer, emptyProgress } = require("./practice");
const { catalog, forkPayload } = require("./references");
const { loadPacks, loadPackSources, programById, courseById, taskById } = require("./packs");
const { loadGlossary } = require("./glossary");
const { loadGraphTemplates } = require("./graphTemplates");
const { buildPack, encodePack, decodePack, packItems, conflictsFor, renamed } = require("./bbpack");
const { loadCommunityIndex, readSettings, writeSettings, readNotes, writeNotes } = require("./community");
const {
  ensureStudy,
  checkTask,
  acceptText,
  scoreAttempt,
  bumpSession,
  queueReviews,
  dueReviews,
  answerReview,
} = require("./study");
const {
  ALLOWED_MODELS,
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  FREE_DAILY,
  TEMPLATES,
  usageDay,
  keyFingerprint,
  extractJson,
  assessReply,
  TRUNCATED_OUTPUT_MESSAGE,
  buildUserText,
  classifyError,
  redact,
  normalizeSystem,
  applyEdits,
  normalizeGenerateRequest,
  promptsFor,
  normalizeUnrealVersion,
  LEGACY_UNREAL_VERSION,
  DEFAULT_UNREAL_VERSION,
  UNREAL_VERSIONS,
  GITHUB_REPO,
  releaseNotice,
} = require("./logic");
const { knownLocks, checkConstraints } = require("./constraints");
const { repairCommonCpp } = require("./repair");
const { stackMap } = require("./stackMap");
const { detectEngine, compilePlugin } = require("./engine");
const { moduleName, writePlugin, copyTree, enablePlugin } = require("./pluginFiles");
const { createCompanion, summarizeProject } = require("./companion");
const { buildAssetPlan } = require("./realAssets");

const OWNER = "You";
const REF_LIMIT = 10 * 1024 * 1024;
const PROJECT_FILE_LIMIT = 25 * 1024 * 1024;
const TEXT_CHARS = 20000;
const REF_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);
const TEXT_EXT = new Set(["h", "hpp", "cpp", "c", "txt", "md", "json", "ini", "cs", "py"]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

class HttpError extends Error {
  constructor(status, detail) {
    super(typeof detail === "string" ? detail : detail?.message || "Request failed");
    this.status = status;
    this.detail = detail;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function extOf(filename) {
  const base = String(filename || "");
  const dot = base.lastIndexOf(".");
  return dot === -1 ? "" : base.slice(dot + 1).toLowerCase();
}

function send(res, status, body, headers = {}) {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": payload.length,
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(payload);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, "Request is too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson(req, limit = 8 * 1024 * 1024) {
  const buf = await readBody(req, limit);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    throw new HttpError(400, "That was not valid JSON");
  }
}

function readMultipart(req) {
  return new Promise((resolve, reject) => {
    let bb;
    try {
      bb = Busboy({ headers: req.headers, limits: { files: 1, fileSize: PROJECT_FILE_LIMIT + 1 } });
    } catch (exc) {
      reject(new HttpError(400, "Upload could not be read"));
      return;
    }
    const fields = {};
    const files = [];
    let tooBig = false;
    const pending = [];
    bb.on("field", (name, val) => { fields[name] = val; });
    bb.on("file", (name, stream, info) => {
      pending.push(new Promise((done, fail) => {
        const chunks = [];
        stream.on("data", (d) => chunks.push(d));
        stream.on("limit", () => { tooBig = true; });
        stream.on("end", () => done({
          field: name,
          filename: info.filename || "file",
          mime: info.mimeType || "application/octet-stream",
          data: Buffer.concat(chunks),
        }));
        stream.on("error", fail);
      }));
    });
    bb.on("error", reject);
    bb.on("finish", () => {
      Promise.all(pending).then((list) => resolve({ fields, file: list[0] || null, tooBig })).catch(reject);
    });
    req.pipe(bb);
  });
}

function summary(p) {
  return {
    project_id: p.project_id,
    name: p.name,
    system_name: p.system?.system_name,
    owner_name: OWNER,
    my_role: "owner",
    version: p.version,
    updated_at: p.updated_at,
    updated_by_name: p.updated_by_name || OWNER,
    auto_fix_export: !!p.auto_fix_export,
    team_id: null,
  };
}

function presentContext(context) {
  const ctx = { ...(context || {}) };
  ctx.unreal_version = normalizeUnrealVersion(ctx.unreal_version) || LEGACY_UNREAL_VERSION;
  ctx.locks = knownLocks(ctx.locks);
  ctx.setup_done = Array.isArray(ctx.setup_done)
    ? ctx.setup_done.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0).slice(0, 40)
    : [];
  return ctx;
}

function detail(p) {
  return {
    ...summary(p),
    system: p.system || null,
    context: presentContext(p.context),
    ignored_issues: p.ignored_issues || [],
  };
}

function fileOut(f) {
  return {
    file_id: f.file_id,
    filename: f.filename,
    content_type: f.content_type,
    size: f.size,
    kind: f.kind,
    uploaded_by_name: f.uploaded_by_name,
    created_at: f.created_at,
    project_id: f.project_id,
  };
}

function findProject(data, projectId) {
  return data.projects.find((p) => p.project_id === projectId && !p.is_deleted) || null;
}

function requireProject(data, projectId) {
  const project = findProject(data, projectId);
  if (!project) throw new HttpError(404, "Project not found");
  return project;
}

function snapshot(data, project, note = "", fixes = null) {
  data.versions.push({
    project_id: project.project_id,
    version: project.version,
    system: project.system,
    context: project.context || {},
    saved_by_name: project.updated_by_name || OWNER,
    saved_at: project.updated_at,
    note: String(note || "").trim().slice(0, 200),
    fixes: fixes || [],
    label: "",
  });
}

function claimReferences(data, context, projectId) {
  const ids = new Set((context?.references || []).map((r) => r?.file_id).filter(Boolean));
  if (!ids.size) return;
  for (const f of data.files) {
    if (ids.has(f.file_id) && !f.project_id) f.project_id = projectId;
  }
}

function createProject(data, { name, system, context, note, fixes }) {
  if (!system || typeof system !== "object" || !system.system_name) {
    throw new HttpError(400, "That doesn't look like a generated system");
  }
  const project = {
    project_id: newId("proj"),
    name: String(name || system.system_name).trim().slice(0, 120) || "Untitled system",
    system,
    context: context || {},
    version: 1,
    updated_at: nowIso(),
    updated_by_name: OWNER,
    auto_fix_export: false,
    ignored_issues: [],
    is_deleted: false,
    created_at: nowIso(),
  };
  data.projects.push(project);
  snapshot(data, project, note, fixes || []);
  claimReferences(data, context, project.project_id);
  return detail(project);
}

function recordUsage(data, key, provider, model, kind, clock) {
  data.usage.push({
    key_fp: keyFingerprint(key),
    provider,
    model,
    kind,
    day: usageDay(clock ? clock() : new Date()),
    at: nowIso(),
  });
}

function resolveLlm(headers, secrets) {
  const saved = secrets.publicView("");
  const provider = headers["x-llm-provider"] || saved.provider || DEFAULT_PROVIDER;
  const model = headers["x-llm-model"] || (provider === saved.provider ? saved.model : null) || (provider === "gemini" ? DEFAULT_MODEL : (ALLOWED_MODELS[provider] || [""])[0]);
  let key = headers["x-llm-key"];
  if (!key) key = secrets.getKey(provider);
  if (provider === "ollama") {
    if (!key || !String(key).trim()) key = "local";
  } else if (!key || !String(key).trim()) {
    throw new HttpError(400, "Add your API key in Settings before synthesizing.");
  }
  if (!ALLOWED_MODELS[provider] || !ALLOWED_MODELS[provider].includes(model)) {
    throw new HttpError(400, "Pick a supported provider and model in Settings.");
  }
  return { provider, model, key: String(key).trim() };
}

function contentDisposition(filename) {
  const ascii = String(filename).replace(/[^\x20-\x7E]/g, "").replace(/"/g, "") || "download";
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function pdfText(data) {
  let pdfParse;
  try {
    pdfParse = require("pdf-parse");
  } catch {
    throw new HttpError(400, "PDF reading isn't available in this build.");
  }
  try {
    const res = await pdfParse(data);
    return String(res.text || "").slice(0, TEXT_CHARS);
  } catch {
    throw new HttpError(400, "Couldn't read that PDF");
  }
}

function textFromBytes(data) {
  try {
    return data.toString("utf8").slice(0, TEXT_CHARS);
  } catch {
    throw new HttpError(400, "Text files must be UTF-8");
  }
}

async function startServer(options = {}) {
  const dataDir = options.dataDir;
  if (!dataDir) throw new Error("dataDir is required");
  const companion = await createCompanion();
  fs.mkdirSync(path.join(dataDir, "files"), { recursive: true });
  const store = createStore(path.join(dataDir, "library.json"));
  const secrets = createSecrets(path.join(dataDir, "secrets.json"), path.join(dataDir, "secret.key"), options.codec);
  const jobs = new Map();
  const sleep = options.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const fetchImpl = options.fetchImpl || (process.env.UE5_STUB_LLM === "1" ? stubFetch : undefined);
  const clock = options.now || (() => new Date());
  const staticDir = options.staticDir ? path.resolve(options.staticDir) : null;
  let lessonPacks = options.packsDir
    ? loadPacks(options.packsDir)
    : loadPackSources({
      appPath: options.appPath,
      resourcesPath: options.resourcesPath,
      userData: dataDir,
    });
  function reloadLessonPacks() {
    lessonPacks = options.packsDir
      ? loadPacks(options.packsDir)
      : loadPackSources({
        appPath: options.appPath,
        resourcesPath: options.resourcesPath,
        userData: dataDir,
      });
  }
  if (lessonPacks.problems.length) {
    console.error(`Lesson packs: ${lessonPacks.problems.join(" | ")}`);
  } else {
    console.log(`Lesson packs: ${(lessonPacks.files || []).join(", ") || "(none)"}`);
  }

  function filePath(fileId) {
    return path.join(dataDir, "files", fileId);
  }

  async function loadReferences(ids) {
    const out = [];
    for (const fid of (ids || []).slice(0, 5)) {
      const f = store.data.files.find((row) => row.file_id === fid && !row.is_deleted);
      if (!f || f.kind !== "reference") continue;
      if (String(f.content_type).startsWith("image/")) {
        const bytes = fs.readFileSync(filePath(f.file_id));
        out.push({ ...f, image_bytes: bytes });
      } else {
        out.push(f);
      }
    }
    return out;
  }

  async function callModel(llm, args) {
    const limit = outputTokenLimit(llm.provider, llm.model);
    try {
      return await complete({ ...args, maxTokens: limit });
    } catch (exc) {
      const msg = String(exc.message || "").toLowerCase();
      const rejectedLimit = (exc.status_code === 400 || exc.statusCode === 400)
        && /maxoutputtokens|max_completion_tokens|max_tokens/.test(msg);
      if (rejectedLimit && limit > 8192) {
        return await complete({ ...args, maxTokens: 8192 });
      }
      throw exc;
    }
  }

  // A length stop used to be ignored, so a chopped C++ file could be shown as
  // the finished system. Keep asking until the JSON and the code are whole,
  // and refuse the result if they never are.
  async function assembleReply(job, llm, { system, user, images }) {
    let raw = "";
    let prompt = user;
    let mode = "start";
    let truncated = false;
    for (let part = 0; part < 3; part += 1) {
      await store.update((data) => { recordUsage(data, llm.key, llm.provider, llm.model, "synthesis", clock); });
      const reply = await callModel(llm, {
        provider: llm.provider,
        model: llm.model,
        apiKey: llm.key,
        system,
        user: prompt,
        images: part === 0 ? images : [],
        timeoutMs: options.generateTimeoutMs || 180000,
        fetchImpl,
        onChars: (n) => { job.chars = (mode === "append" ? raw.length : 0) + n; },
      });
      raw = mode === "append" ? joinModelText(raw, reply.text) : reply.text;
      truncated = reply.truncated;
      const verdict = assessReply(raw, { truncated });
      if (verdict.action === "accept") return { raw, truncated: false, accepted: true };
      mode = verdict.action;
      const tail = raw.slice(-2500);
      prompt = mode === "append"
        ? `The previous JSON reply was cut off at the output limit. Continue EXACTLY from the last character of the tail. Do not repeat the tail. Do not add commentary or code fences.\n\nTAIL:\n${tail}`
        : `The JSON below was cut off inside the C++ or is missing a section. Reply with ONE complete JSON object for the same system. Write full cpp_header and cpp_source, plus blueprint_pseudocode, setup_guide, and node_graph_nodes. Do not stop mid-function.\n\nINCOMPLETE:\n${raw.slice(0, 12000)}`;
    }
    return { raw, truncated, accepted: false };
  }

  async function runJob(job, req, refs, llm) {
    const images = refs.filter((r) => r.image_bytes).map((r) => ({
      mime: r.content_type || "image/png",
      base64: r.image_bytes.toString("base64"),
    }));
    const userText = buildUserText(req, refs.map((r) => ({
      filename: r.filename,
      text: r.text || "",
      image_bytes: r.image_bytes,
    })));
    const attempts = llm.provider === "gemini" ? 3 : 1;
    let assembled = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        assembled = await assembleReply(job, llm, {
          system: promptsFor(req.unreal_version).system,
          user: userText,
          images,
        });
        break;
      } catch (exc) {
        const classified = classifyError(exc, llm.model);
        if (attempt === attempts - 1 || classified.code !== "busy" || job.chars > 0) {
          console.error(`Generation failed: ${redact(exc.message || exc, llm.key).slice(0, 500)}`);
          job.status = "error";
          job.error_code = classified.code;
          job.detail = redact(classified.message, llm.key);
          return;
        }
        job.detail = `Model busy, retrying (${attempt + 1}/2)…`;
        await sleep(4000 * (attempt + 1));
      }
    }
    const raw = assembled ? assembled.raw : "";
    if (assembled && !assembled.accepted) {
      job.status = "error";
      job.error_code = assembled.truncated ? "truncated" : "incomplete";
      job.detail = assembled.truncated
        ? TRUNCATED_OUTPUT_MESSAGE
        : "The model's output was incomplete. Please try again, or lower Complexity.";
      console.error(`Refused unfinished model output. Tail: ${String(raw).slice(-300)}`);
      return;
    }
    try {
      const data = repairCommonCpp(normalizeSystem(extractJson(raw), req.stack_systems));
      data.constraint_violations = checkConstraints(data, req.locks);
      data.stack_map = stackMap(req.stack_systems);
      for (const name of data.shared_attributes) {
        if (name && !data.stack_map.shared.some((item) => item.name === name)) {
          data.stack_map.shared.push({ kind: "shared", name, systems: data.stacked_from.filter(Boolean) });
        }
      }
      job.status = "done";
      job.chars = raw.length;
      job.result = data;
      job.detail = undefined;
    } catch (exc) {
      console.error(`Bad model output (${exc.message}). Tail: ${String(raw).slice(-300)}`);
      job.status = "error";
      job.detail = "The model's output was incomplete. Please try again, or lower Complexity.";
    }
  }

  async function ask(llm, { system, user, maxTokens, timeoutMs, kind }) {
    await store.update((data) => { recordUsage(data, llm.key, llm.provider, llm.model, kind, clock); });
    try {
      const reply = await complete({
        provider: llm.provider,
        model: llm.model,
        apiKey: llm.key,
        system,
        user,
        maxTokens,
        timeoutMs,
        fetchImpl,
      });
      return reply.text;
    } catch (exc) {
      if (exc?.name === "AbortError" || classifyError(exc, llm.model).code === "busy" && String(exc.message).includes("timeout")) {
        throw new HttpError(504, kind === "review"
          ? "The model took too long to review. Try again, or switch to Gemini 3.5 Flash-Lite."
          : kind === "fix"
            ? "The model took too long to write the fix. Try again, or fix fewer issues at once."
            : "The model took too long to write tests. Try again.");
      }
      const classified = classifyError(exc, llm.model);
      if (classified.code === "busy" && (exc?.name === "AbortError" || /timeout/i.test(String(exc.message)))) {
        throw new HttpError(504, classified.message);
      }
      console.error(`${kind} failed: ${redact(exc.message || exc, llm.key).slice(0, 300)}`);
      throw new HttpError(502, redact(classified.message, llm.key));
    }
  }

  const routes = [];
  function route(method, pattern, handler) {
    const keys = [];
    const re = new RegExp("^" + pattern.replace(/:([A-Za-z_]+)/g, (_, name) => {
      keys.push(name);
      return "([^/]+)";
    }) + "$");
    routes.push({ method, re, keys, handler });
  }

  const appVersion = options.appVersion || require("../package.json").version || "0.0.0";
  let updateOnce = null;
  function loadUpdate() {
    if (!updateOnce) {
      updateOnce = (async () => {
        try {
          if (typeof options.updateCheck === "function") {
            return releaseNotice(appVersion, await options.updateCheck(appVersion));
          }
          // Tests inject fetchImpl for the model. Don't send that to GitHub.
          if (options.fetchImpl) return null;
          const res = await fetch(`https://api.github.com/repos/${options.repo || GITHUB_REPO}/releases/latest`, {
            headers: {
              Accept: "application/vnd.github+json",
              "User-Agent": "UE5-System-Architect",
            },
            signal: AbortSignal.timeout(4000),
          });
          // A private repo returns 404 without a token. That is not an error for the user.
          if (!res.ok) return null;
          return releaseNotice(appVersion, await res.json());
        } catch {
          return null;
        }
      })();
    }
    return updateOnce;
  }

  route("GET", "/api/", async () => ({
    message: "UE5 System Architect",
    desktop: true,
    models: ALLOWED_MODELS,
    version: appVersion,
  }));

  route("GET", "/api/app", async () => ({
    version: appVersion,
    repo: options.repo || GITHUB_REPO,
    unreal_versions: UNREAL_VERSIONS,
    default_unreal_version: DEFAULT_UNREAL_VERSION,
    legacy_unreal_version: LEGACY_UNREAL_VERSION,
    update: await loadUpdate(),
  }));

  route("GET", "/api/templates", async () => ({ templates: attachStarters(TEMPLATES) }));

  route("GET", "/api/references", async () => catalog());

  route("GET", "/api/glossary", async () => {
    const loaded = loadGlossary({ appPath: options.appPath, resourcesPath: options.resourcesPath });
    if (loaded.problems.length) console.error(`Glossary: ${loaded.problems.join(" | ")}`);
    return { terms: loaded.terms, problems: loaded.problems };
  });

  function importedTemplates() {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dataDir, "imported-templates.json"), "utf8"));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveImportedTemplates(list) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, "imported-templates.json"), JSON.stringify(list, null, 2));
  }

  function contentFile(name) {
    const candidates = [];
    if (options.appPath) candidates.push(path.join(options.appPath, "content", name));
    if (options.resourcesPath) {
      candidates.push(path.join(options.resourcesPath, "app.asar", "content", name));
      candidates.push(path.join(options.resourcesPath, "app", "content", name));
    }
    candidates.push(path.join(__dirname, "..", "content", name));
    for (const file of candidates) {
      try {
        if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
      } catch { /* try the next copy */ }
    }
    return null;
  }

  function graphTemplateList() {
    const loaded = loadGraphTemplates({ appPath: options.appPath, resourcesPath: options.resourcesPath });
    const extra = importedTemplates();
    const seen = new Set(loaded.templates.map((item) => item.id));
    return { templates: [...loaded.templates, ...extra.filter((item) => item?.id && !seen.has(item.id))], problems: loaded.problems };
  }

  route("GET", "/api/graph-templates", async () => {
    const loaded = graphTemplateList();
    if (loaded.problems.length) console.error(`Graph templates: ${loaded.problems.join(" | ")}`);
    return loaded;
  });

  route("GET", "/api/planned", async () => {
    const planned = contentFile("planned.json");
    return { items: Array.isArray(planned?.items) ? planned.items : [] };
  });

  route("GET", "/api/resources", async () => {
    const resources = contentFile("resources.json");
    return { resources: Array.isArray(resources?.resources) ? resources.resources : [] };
  });

  route("GET", "/api/community-notes", async () => ({ notes: readNotes(dataDir) }));

  function communityPayload(remote) {
    const settings = readSettings(dataDir);
    const bundled = loadCommunityIndex({ appPath: options.appPath, resourcesPath: options.resourcesPath, dir: options.communityDir });
    return {
      enabled: settings.enabled,
      repo: settings.repo,
      path: settings.path,
      source: remote ? "github" : "bundled",
      packs: remote ? remote.packs : bundled.packs,
      how_to_submit: bundled.how_to_submit,
      problems: remote ? remote.problems : bundled.problems,
    };
  }

  async function githubListing(settings) {
    const fetchImpl = options.fetchImpl || fetch;
    const url = `https://api.github.com/repos/${settings.repo}/contents/${encodeURI(settings.path)}`;
    const response = await fetchImpl(url, { headers: { Accept: "application/vnd.github+json", "User-Agent": "blueprint-builder" } });
    if (!response.ok) return { packs: [], problems: [`GitHub returned ${response.status} for ${settings.repo}.`] };
    const listing = await response.json();
    if (!Array.isArray(listing)) return { packs: [], problems: ["GitHub did not return a folder."] };
    return {
      packs: listing.filter((item) => String(item.name || "").endsWith(".bbpack")).map((item) => ({
        id: String(item.name).replace(/\.bbpack$/i, ""),
        title: String(item.name).replace(/\.bbpack$/i, ""),
        author: settings.repo,
        summary: "Pack file in the community repo.",
        file: item.name,
        download_url: item.download_url || "",
      })),
      problems: [],
    };
  }

  route("GET", "/api/community", async () => {
    const settings = readSettings(dataDir);
    if (!settings.enabled) return communityPayload(null);
    if (!settings.repo) return { ...communityPayload(null), enabled: true, problems: ["Community download is on, but no GitHub repo is set."] };
    try {
      return { ...communityPayload(await githubListing(settings)), enabled: true, repo: settings.repo, path: settings.path, source: "github" };
    } catch (exc) {
      return { ...communityPayload(null), enabled: true, source: "github", problems: [`Couldn't reach GitHub (${exc.message}).`] };
    }
  });

  route("PUT", "/api/community/settings", async (req) => {
    const body = await readJson(req);
    return writeSettings(dataDir, { enabled: body.enabled, repo: body.repo, path: body.path });
  });

  route("GET", "/api/community/packs/:id", async (_req, params) => {
    const settings = readSettings(dataDir);
    const bundled = loadCommunityIndex({ appPath: options.appPath, resourcesPath: options.resourcesPath, dir: options.communityDir });
    const local = bundled.packs.find((item) => item.id === params.id);
    const readLocal = () => {
      const root = path.resolve(bundled.dir);
      const file = path.resolve(root, local.file);
      if (file !== root && !file.startsWith(`${root}${path.sep}`)) throw new HttpError(400, "That pack path is not allowed.");
      return { filename: local.file, base64: fs.readFileSync(file).toString("base64") };
    };
    if (!settings.enabled && local) return readLocal();
    if (settings.enabled && settings.repo) {
      const remote = await githubListing(settings);
      const pack = remote.packs.find((item) => item.id === params.id);
      if (!pack?.download_url) throw new HttpError(404, "That pack is not in the repo listing.");
      const fetchImpl = options.fetchImpl || fetch;
      const response = await fetchImpl(pack.download_url, { headers: { "User-Agent": "blueprint-builder" } });
      if (!response.ok) throw new HttpError(502, "GitHub did not return that pack.");
      const bytes = Buffer.from(await response.arrayBuffer());
      return { filename: pack.file, base64: bytes.toString("base64") };
    }
    if (local) return readLocal();
    throw new HttpError(404, "That pack isn't available.");
  });

  function catalogForConflicts() {
    const projects = (store.data?.projects || []).filter((item) => !item.is_deleted);
    const templates = graphTemplateList().templates;
    return { projects, templates, programs: lessonPacks.programs || [] };
  }

  function previewPack(decoded) {
    if (!decoded.ok) return { ok: false, errors: decoded.errors, preview: null, conflicts: [] };
    return { ok: true, errors: [], preview: decoded.preview, conflicts: conflictsFor(decoded.pack, catalogForConflicts()), pack: decoded.pack };
  }

  route("POST", "/api/packs/preview", async (req) => {
    const body = await readJson(req);
    const raw = body.data ? Buffer.from(String(body.data), "base64") : Buffer.from(JSON.stringify(body.pack || body), "utf8");
    return previewPack(decodePack(raw));
  });

  route("POST", "/api/packs/export", async (req) => {
    const body = await readJson(req);
    let pack;
    if (body.kind === "project") {
      const project = (store.data.projects || []).find((item) => item.project_id === body.project_id && !item.is_deleted);
      if (!project) throw new HttpError(404, "That project isn't saved.");
      pack = buildPack({
        kind: "project",
        name: project.name,
        author: body.author || "Local",
        description: project.system?.summary || "",
        content: { system: project.system, context: project.context || {} },
      });
    } else if (body.kind === "template") {
      const template = graphTemplateList().templates.find((item) => item.id === body.template_id);
      if (!template) throw new HttpError(404, "That template isn't in the app.");
      pack = buildPack({
        kind: "template",
        name: template.title || template.id,
        author: body.author || "Local",
        description: template.summary || "",
        content: { template },
      });
    } else if (body.kind === "lesson") {
      const program = (lessonPacks.programs || []).find((item) => item.id === body.program_id);
      if (!program) throw new HttpError(404, "That lesson pack isn't loaded.");
      pack = buildPack({
        kind: "lesson",
        name: program.title || program.id,
        author: body.author || "Local",
        description: program.summary || "",
        content: { programs: [program] },
      });
    } else {
      throw new HttpError(400, "Say whether this is a project, a template, or a lesson.");
    }
    const encoded = encodePack(pack);
    return { filename: encoded.filename, base64: encoded.bytes.toString("base64"), manifest: encoded.manifest };
  });

  route("POST", "/api/packs/import", async (req) => {
    const body = await readJson(req);
    const raw = body.data ? Buffer.from(String(body.data), "base64") : Buffer.from(JSON.stringify(body.pack || {}), "utf8");
    const decoded = decodePack(raw);
    const preview = previewPack(decoded);
    if (!preview.ok) throw new HttpError(400, preview.errors[0] || "That pack is not valid.");
    if (preview.conflicts.length && body.mode !== "rename" && body.mode !== "replace") {
      return { ok: false, needsChoice: true, preview: preview.preview, conflicts: preview.conflicts };
    }
    const mode = body.mode || "rename";
    const items = packItems(decoded.pack);
    const takenProjects = new Set((store.data.projects || []).filter((item) => !item.is_deleted).map((item) => String(item.name).toLowerCase()));
    const applied = { projects: [], templates: [], lessons: [], notes: 0 };
    await store.update((data) => {
      for (const project of items.projects) {
        const system = project.system;
        if (!system?.system_name) continue;
        let name = project.name || system.system_name;
        const clash = (data.projects || []).find((item) => !item.is_deleted && String(item.name).toLowerCase() === String(name).toLowerCase());
        if (clash && mode === "replace") {
          clash.system = system;
          clash.context = project.context || clash.context || {};
          clash.updated_at = nowIso();
          applied.projects.push(clash.project_id);
          continue;
        }
        if (clash && mode === "rename") name = renamed(name, takenProjects);
        takenProjects.add(String(name).toLowerCase());
        const created = createProject(data, { name, system, context: project.context || {}, note: `Imported ${decoded.pack.name}` });
        applied.projects.push(created.project_id);
      }
      return data;
    });
    if (items.templates.length) {
      const list = importedTemplates();
      for (const template of items.templates) {
        let next = { ...template };
        if (list.some((item) => item.id === next.id) || graphTemplateList().templates.some((item) => item.id === next.id)) {
          if (mode === "replace") {
            const index = list.findIndex((item) => item.id === next.id);
            if (index >= 0) list[index] = next;
            else list.push(next);
          } else {
            const ids = new Set(graphTemplateList().templates.map((item) => String(item.id).toLowerCase()));
            next = { ...next, id: renamed(next.id, ids), title: `${next.title || next.id} (imported)` };
            list.push(next);
          }
        } else list.push(next);
        applied.templates.push(next.id);
      }
      saveImportedTemplates(list);
    }
    if (items.lessons.length) {
      const folder = path.join(dataDir, "packs");
      fs.mkdirSync(folder, { recursive: true });
      for (const lesson of items.lessons) {
        const programs = (lesson.programs || []).map((program) => {
          if (mode !== "rename") return program;
          const ids = new Set((lessonPacks.programs || []).map((item) => String(item.id).toLowerCase()));
          if (!ids.has(String(program.id).toLowerCase())) return program;
          return { ...program, id: renamed(program.id, ids) };
        });
        const file = `${String(lesson.name || "lesson").replace(/[^\w.-]+/g, "-") || "lesson"}.json`;
        fs.writeFileSync(path.join(folder, file), JSON.stringify({ programs, courses: lesson.courses || [] }, null, 2));
        applied.lessons.push(file);
      }
      reloadLessonPacks();
    }
    if (items.notes.length) {
      const notes = readNotes(dataDir).filter((note) => note.pack !== decoded.pack.name);
      writeNotes(dataDir, [...notes, ...items.notes]);
      applied.notes = items.notes.length;
    }
    return { ok: true, preview: preview.preview, applied, conflicts: preview.conflicts };
  });

  route("POST", "/api/examples/:id/fork", async (_req, params) => {
    const payload = forkPayload(params.id);
    if (!payload) throw new HttpError(404, "That example isn't in the library.");
    return store.update((data) => createProject(data, payload));
  });

  route("GET", "/api/settings", async () => secrets.publicView(dataDir));

  route("PUT", "/api/settings", async (req) => {
    const body = await readJson(req);
    const provider = body.provider || DEFAULT_PROVIDER;
    const model = body.model || (provider === "gemini" ? DEFAULT_MODEL : ALLOWED_MODELS[provider]?.[0]);
    try {
      secrets.setSelection(provider, model);
    } catch (exc) {
      throw new HttpError(exc.statusCode || 400, exc.message);
    }
    if (body.clear_key) secrets.clearKey(provider);
    if (typeof body.key === "string" && body.key.trim()) {
      secrets.setKey(provider, body.key.trim());
    }
    if (typeof body.engine_path === "string") secrets.setEnginePath(body.engine_path);
    if (!secrets.getKey(provider) && body.key) {
      throw new HttpError(500, "The key was saved but could not be read back. Try again.");
    }
    return secrets.publicView(dataDir);
  });

  route("POST", "/api/app/open-data-dir", async () => {
    if (typeof options.openPath === "function") {
      await options.openPath(dataDir);
    }
    return { ok: true, path: dataDir };
  });

  route("GET", "/api/engine", async () => detectEngine({
    override: secrets.publicView(dataDir).engine_path,
  }));

  route("POST", "/api/engine/compile", async (req) => {
    const body = await readJson(req);
    const system = body.system && typeof body.system === "object" ? body.system : body;
    if (!system?.cpp_header || !system?.cpp_source) {
      throw new HttpError(400, "Compile needs a header and a source file.");
    }
    const workDir = path.join(dataDir, "scratch", crypto.randomUUID());
    fs.mkdirSync(workDir, { recursive: true });
    try {
      return await compilePlugin({
        system,
        engineRoot: secrets.publicView(dataDir).engine_path,
        workDir,
        spawnImpl: options.spawnImpl,
      });
    } catch (exc) {
      const message = String(exc?.message || exc || "Build failed");
      return {
        found: true,
        ok: false,
        issues: [{ severity: "error", file: "", line: null, message: message.slice(0, 500), fix: "This is the error from the app, before Unreal printed a compiler line." }],
        log: String(exc?.stack || message).slice(0, 4000),
        message: `Build with Unreal failed: ${message.slice(0, 400)}`,
      };
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  route("POST", "/api/export/pick", async () => {
    if (typeof options.pickFile !== "function") {
      throw new HttpError(400, "Type the .uproject path. The file picker is available in the desktop app.");
    }
    const picked = await options.pickFile([{ name: "Unreal project", extensions: ["uproject"] }]);
    return { path: typeof picked === "string" ? picked : "" };
  });

  route("POST", "/api/export/to-project", async (req) => {
    const body = await readJson(req);
    const system = body.system;
    if (!system || typeof system !== "object" || !system.cpp_header || !system.cpp_source) {
      throw new HttpError(400, "Export needs a generated system.");
    }
    const target = path.resolve(String(body.uproject || ""));
    if (!target.toLowerCase().endsWith(".uproject") || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
      throw new HttpError(400, "Pick an Unreal project file that ends in .uproject.");
    }
    try {
      JSON.parse(fs.readFileSync(target, "utf8"));
    } catch {
      throw new HttpError(400, "That .uproject could not be read.");
    }
    const dest = path.join(path.dirname(target), "Plugins", moduleName(system));
    try {
      const written = writePlugin(dest, system, { confirm: body.confirm === true });
      return { ok: true, plugin: written.module, path: dest, uproject: target, conflicts: written.conflicts };
    } catch (exc) {
      if (exc.statusCode === 409) return { ok: false, conflicts: exc.conflicts || [], path: dest, uproject: target };
      throw exc;
    }
  });

  function companionSource() {
    const candidates = [];
    if (options.appPath) candidates.push(path.join(options.appPath, "ue-plugin", "ArchitectCompanion"));
    candidates.push(path.join(__dirname, "..", "ue-plugin", "ArchitectCompanion"));
    return candidates.find((dir) => fs.existsSync(path.join(dir, "ArchitectCompanion.uplugin"))) || "";
  }

  route("GET", "/api/companion", async () => ({
    host: "127.0.0.1",
    port: companion.port,
    code: companion.code,
    paired: companion.paired,
    summary: companion.summary(),
    project: companion.report?.project || "",
    engine: companion.report?.engine || "",
    classes: Array.isArray(companion.report?.classes) ? companion.report.classes.slice(0, 24) : [],
    result: companion.lastResult,
  }));

  route("POST", "/api/companion/rotate", async () => ({ code: companion.rotate() }));

  route("POST", "/api/companion/install", async (req) => {
    const body = await readJson(req);
    const target = path.resolve(String(body.uproject || ""));
    if (!target.toLowerCase().endsWith(".uproject") || !fs.existsSync(target)) {
      throw new HttpError(400, "Pick an Unreal project file that ends in .uproject.");
    }
    const source = companionSource();
    if (!source) throw new HttpError(500, "The companion plugin is not in this app.");
    const dest = path.join(path.dirname(target), "Plugins", "ArchitectCompanion");
    try {
      const copied = copyTree(source, dest, { confirm: body.confirm === true });
      enablePlugin(target, "ArchitectCompanion");
      return { ok: true, path: dest, files: copied.files.length, conflicts: copied.conflicts };
    } catch (exc) {
      if (exc.statusCode === 409) return { ok: false, conflicts: exc.conflicts || [], path: dest };
      throw exc;
    }
  });

  route("POST", "/api/companion/send", async (req) => {
    const body = await readJson(req);
    const system = body.system;
    if (!system?.cpp_header || !system?.cpp_source) throw new HttpError(400, "Send to Unreal needs a generated system.");
    const target = path.resolve(String(body.uproject || ""));
    if (!target.toLowerCase().endsWith(".uproject") || !fs.existsSync(target)) {
      throw new HttpError(400, "Pick an Unreal project file that ends in .uproject.");
    }
    const dest = path.join(path.dirname(target), "Plugins", moduleName(system));
    let written;
    try {
      written = writePlugin(dest, system, { confirm: body.confirm === true });
    } catch (exc) {
      if (exc.statusCode === 409) return { ok: false, conflicts: exc.conflicts || [], path: dest };
      throw exc;
    }
    const command = companion.paired ? companion.queue({ type: "reload", module: written.module }) : null;
    return {
      ok: true,
      plugin: written.module,
      path: dest,
      paired: companion.paired,
      queued: !!command,
      message: command ? "Files written. The editor was asked to compile." : "Files written. Pair the Architect panel, then compile in the editor.",
    };
  });

  route("POST", "/api/companion/assets", async (req) => {
    const body = await readJson(req);
    const system = body.system;
    if (!system?.cpp_header || !system?.cpp_source) throw new HttpError(400, "Create in Unreal needs a generated system.");
    const plan = buildAssetPlan(system, { folder: body.folder, confirm: body.confirm === true });
    if (!companion.paired) {
      return { ok: false, paired: false, folder: plan.folder, message: "Pair the Architect panel in the editor first." };
    }
    companion.clearResult();
    const command = companion.queue(plan);
    return {
      ok: true,
      queued: true,
      id: command.id,
      folder: plan.folder,
      confirm: plan.confirm,
      message: plan.confirm
        ? `Asked the editor to replace assets in ${plan.folder}.`
        : `Asked the editor to create assets in ${plan.folder}.`,
    };
  });

  route("POST", "/api/companion/open", async (req) => {
    const body = await readJson(req);
    const asset = String(body.asset || "").trim();
    if (!asset.startsWith("/Game/")) throw new HttpError(400, "Open in Unreal needs an asset under /Game.");
    if (!companion.paired) return { ok: false, paired: false, message: "Pair the Architect panel in the editor first." };
    const command = companion.queue({ type: "open-asset", asset });
    return { ok: true, queued: true, id: command.id, asset, message: "Asked the editor to open that asset." };
  });

  route("POST", "/api/companion/context", async () => {
    const summary = summarizeProject(companion.report);
    if (!summary || summary.startsWith("Engine unknown")) throw new HttpError(400, "The editor has not sent a project yet.");
    return { summary };
  });

  route("GET", "/api/usage/today", async () => {
    const saved = secrets.publicView(dataDir);
    const key = secrets.getKey(saved.provider);
    const fp = key ? keyFingerprint(key) : "";
    const day = usageDay(clock());
    const models = {};
    if (fp) {
      for (const row of store.data.usage) {
        if (row.key_fp !== fp || row.day !== day) continue;
        models[row.model] = models[row.model] || { used: 0, free_limit: FREE_DAILY[row.model] };
        models[row.model].used += 1;
      }
    }
    return { day, resets: "midnight Pacific time", models, free_limits: FREE_DAILY };
  });

  route("POST", "/api/ai/test-key", async (req) => {
    const llm = resolveLlm(req.headers, secrets);
    await store.update((data) => { recordUsage(data, llm.key, llm.provider, llm.model, "key_test", clock); });
    try {
      await complete({
        provider: llm.provider,
        model: llm.model,
        apiKey: llm.key,
        system: "Reply with the single word OK.",
        user: "Say OK",
        maxTokens: 256,
        timeoutMs: options.testTimeoutMs || 30000,
        fetchImpl,
      });
    } catch (exc) {
      if (exc?.name === "AbortError") {
        return { ok: false, code: "busy", message: "The model didn't answer within 30 seconds. It may be overloaded; try Gemini 3.5 Flash-Lite." };
      }
      console.error(`Key test failed: ${redact(exc.message || exc, llm.key).slice(0, 300)}`);
      const classified = classifyError(exc, llm.model);
      return { ok: false, code: classified.code, message: redact(classified.message, llm.key) };
    }
    return { ok: true, message: `Key works with ${llm.model}.` };
  });

  async function assembleLearning(job, llm, system, unrealVersion) {
    let raw = "";
    let user = learningUserText(system, unrealVersion);
    let mode = "start";
    let reasked = false;
    for (let part = 0; part < 3; part += 1) {
      await store.update((data) => { recordUsage(data, llm.key, llm.provider, llm.model, "learning", clock); });
      const reply = await callModel(llm, {
        provider: llm.provider,
        model: llm.model,
        apiKey: llm.key,
        system: LEARNING_PROMPT,
        user,
        images: [],
        timeoutMs: options.generateTimeoutMs || 180000,
        fetchImpl,
        onChars: (n) => { if (job) job.chars = n; },
      });
      raw = mode === "append" ? joinModelText(raw, reply.text) : reply.text;
      let parsed = null;
      try { parsed = extractJson(raw); } catch { parsed = null; }
      if (!parsed) {
        mode = "append";
        user = `The previous JSON reply was cut off at the output limit. Continue EXACTLY from the last character of the tail. Do not repeat the tail. Do not add commentary.\n\nTAIL:\n${raw.slice(-2500)}`;
        if (!reply.truncated && part > 0) break;
        continue;
      }
      const gaps = learningGaps(parsed, system);
      if (gaps.length && !reasked) {
        reasked = true;
        mode = "replace";
        user = `The teaching JSON is missing ${gaps.join("; ")}. Reply with the full JSON object and include them. Keep every why note you already wrote.`;
        continue;
      }
      return fillLearning(parsed, system);
    }
    return null;
  }

  route("POST", "/api/learn", async (req) => {
    const body = await readJson(req);
    const system = body.system;
    if (!system || typeof system !== "object" || !system.system_name) {
      throw new HttpError(400, "The learning pass needs the finished system.");
    }
    const llm = resolveLlm(req.headers, secrets);
    const version = normalizeUnrealVersion(body.unreal_version) || DEFAULT_UNREAL_VERSION;
    let learning = null;
    try {
      learning = await assembleLearning(null, llm, system, version);
    } catch (exc) {
      console.error(`Learning pass failed: ${redact(exc.message || exc, llm.key).slice(0, 300)}`);
      throw new HttpError(502, "The learning pass failed. The system was kept. Press Retry learning pass.");
    }
    if (!learning) {
      throw new HttpError(502, "The learning pass was cut off. The system was kept. Press Retry learning pass.");
    }
    return { learning };
  });

  route("POST", "/api/generate", async (req) => {
    const body = await readJson(req);
    let gen;
    try {
      gen = normalizeGenerateRequest(body);
    } catch (exc) {
      throw new HttpError(exc.statusCode || 400, exc.message);
    }
    const llm = resolveLlm(req.headers, secrets);
    const refs = await loadReferences(gen.reference_file_ids);
    const job = {
      job_id: crypto.randomUUID(),
      status: "running",
      chars: 0,
      created_at: nowIso(),
    };
    jobs.set(job.job_id, job);
    const task = runJob(job, gen, refs, llm);
    job.task = task;
    task.catch((exc) => {
      console.error(`Job crashed: ${exc.message}`);
      if (job.status === "running") {
        job.status = "error";
        job.detail = "Generation stopped unexpectedly. Please try again.";
      }
    });
    return { job_id: job.job_id };
  });

  route("GET", "/api/generate/:job_id", async (_req, params) => {
    const job = jobs.get(params.job_id);
    if (!job) throw new HttpError(404, "Job not found");
    return {
      job_id: job.job_id,
      status: job.status,
      chars: job.chars || 0,
      created_at: job.created_at,
      detail: job.detail,
      error_code: job.error_code,
      result: job.result,
    };
  });

  route("POST", "/api/ai/review-cpp", async (req) => {
    const body = await readJson(req);
    const llm = resolveLlm(req.headers, secrets);
    const header = String(body.cpp_header || "");
    const source = String(body.cpp_source || "");
    if (!header || !source) throw new HttpError(400, "Add both the header and the source before reviewing.");
    const known = (Array.isArray(body.known_issues) ? body.known_issues : []).map((k) => `- ${String(k).slice(0, 200)}`).join("\n") || "(none)";
    const fileBase = String(body.file_base || "System").slice(0, 120);
    const version = normalizeUnrealVersion(body.unreal_version) || DEFAULT_UNREAL_VERSION;
    const text = `Target Unreal version: UE ${version}\n\nKNOWN ISSUES:\n${known}\n\n=== ${fileBase}.h ===\n${header.slice(0, 40000)}\n\n=== ${fileBase}.cpp ===\n${source.slice(0, 60000)}`;
    const raw = await ask(llm, { system: promptsFor(version).review, user: text, maxTokens: 8000, timeoutMs: 50000, kind: "review" });
    let issues;
    try {
      issues = extractJson(raw).issues;
      if (!Array.isArray(issues)) throw new Error("issues is not a list");
    } catch {
      throw new HttpError(502, "The model's review couldn't be read. Please try again.");
    }
    const out = issues.filter((i) => i && typeof i === "object" && i.message).slice(0, 12).map((i) => ({
      severity: i.severity === "error" ? "error" : "warning",
      file: String(i.file || "").endsWith("cpp") ? ".cpp" : ".h",
      line: Number.isInteger(i.line) ? i.line : null,
      message: String(i.message).slice(0, 400),
      fix: String(i.fix || "").slice(0, 400),
    }));
    if (issues.length && !out.length) throw new HttpError(502, "The model's review couldn't be read. Please try again.");
    return { issues: out, model: llm.model };
  });

  route("POST", "/api/ai/fix-cpp", async (req) => {
    const body = await readJson(req);
    const llm = resolveLlm(req.headers, secrets);
    const header = String(body.cpp_header || "");
    const source = String(body.cpp_source || "");
    const issueList = Array.isArray(body.issues) ? body.issues.map((t) => String(t)).filter(Boolean).slice(0, 40) : [];
    if (!issueList.length) throw new HttpError(400, "There are no issues to fix.");
    if (body.project_id) {
      await store.update((data) => { requireProject(data, body.project_id); });
    }
    const fileBase = String(body.file_base || "System").slice(0, 120);
    const version = normalizeUnrealVersion(body.unreal_version) || DEFAULT_UNREAL_VERSION;
    const issues = issueList.map((t, i) => `${i + 1}. ${t.slice(0, 500)}`).join("\n");
    const buildLog = String(body.build_log || "").slice(-4000);
    const text = `Target Unreal version: UE ${version}\n\nISSUES:\n${issues}${buildLog ? `\n\nUNREAL BUILD LOG (tail):\n${buildLog}` : ""}\n\n=== ${fileBase}.h ===\n${header.slice(0, 40000)}\n\n=== ${fileBase}.cpp ===\n${source.slice(0, 60000)}`;
    const raw = await ask(llm, { system: promptsFor(version).fix, user: text, maxTokens: 12000, timeoutMs: 55000, kind: "fix" });
    const files = { ".h": header, ".cpp": source };
    let applied;
    try {
      const edits = extractJson(raw).edits;
      if (!Array.isArray(edits)) throw new Error("edits is not a list");
      applied = applyEdits(files, edits.slice(0, 15));
    } catch (exc) {
      console.error(`Unusable fix patch: ${exc.message}`);
      throw new HttpError(422, { code: "patch_failed", message: "The patch did not match the current code, so nothing changed. Jump to the line in the C++ view and edit it, or try Fix again." });
    }
    if (!applied.length || (files[".h"] === header && files[".cpp"] === source)) {
      throw new HttpError(422, { code: "no_changes", message: "The model did not change the code. Edit the line in the C++ view, or copy the build log and try Fix again." });
    }
    return { cpp_header: files[".h"], cpp_source: files[".cpp"], changes: applied, model: llm.model };
  });

  route("POST", "/api/ai/tests", async (req) => {
    const body = await readJson(req);
    const llm = resolveLlm(req.headers, secrets);
    const header = String(body.cpp_header || "");
    const source = String(body.cpp_source || "");
    if (!header || !source) throw new HttpError(400, "Add both the header and the source before writing tests.");
    if (body.project_id) {
      await store.update((data) => { requireProject(data, body.project_id); });
    }
    const fileBase = String(body.file_base || "System").slice(0, 120);
    const version = normalizeUnrealVersion(body.unreal_version) || DEFAULT_UNREAL_VERSION;
    const text = `Target Unreal version: UE ${version}\n\nHeader file name: ${fileBase}.h\n\n=== ${fileBase}.h ===\n${header.slice(0, 40000)}\n\n=== ${fileBase}.cpp ===\n${source.slice(0, 60000)}`;
    const raw = await ask(llm, { system: promptsFor(version).tests, user: text, maxTokens: 12000, timeoutMs: 55000, kind: "tests" });
    let data;
    try {
      data = extractJson(raw);
      const code = data.code;
      if (typeof code !== "string" || !code.includes("It(") || !/BEGIN_DEFINE_SPEC|IMPLEMENT_\w*AUTOMATION_TEST/.test(code)) {
        throw new Error("no test cases");
      }
    } catch {
      throw new HttpError(502, "The model's tests couldn't be read. Please try again.");
    }
    const name = String(data.file_name || "").replace(/\.cpp$/i, "").replace(/[^A-Za-z0-9_]/g, "") || `${fileBase}Spec`;
    return {
      file_name: `${name}.cpp`,
      code: data.code,
      cases: (Array.isArray(data.cases) ? data.cases : []).map((c) => String(c).slice(0, 120)).slice(0, 12),
      model: llm.model,
    };
  });

  route("GET", "/api/projects", async () => ({
    mine: store.data.projects.filter((p) => !p.is_deleted).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 500).map(summary),
    shared: [],
    team: [],
  }));

  route("POST", "/api/projects", async (req) => {
    const body = await readJson(req);
    return store.update((data) => createProject(data, {
      name: body.name,
      system: body.system,
      context: body.context || {},
      note: body.note || "",
      fixes: Array.isArray(body.fixes) ? body.fixes.slice(0, 20) : [],
    }));
  });

  route("POST", "/api/projects/import", async (req) => {
    const body = await readJson(req);
    const incoming = body.data && typeof body.data === "object" ? body.data : body;
    return store.update((data) => importOne(data, incoming));
  });

  function importOne(data, incoming) {
    const system = incoming.system && typeof incoming.system === "object" ? incoming.system : incoming;
    let context = incoming.context && typeof incoming.context === "object" ? incoming.context : (system.context || {});
    context = Object.fromEntries(Object.entries(context || {}).filter(([k]) => k !== "references"));
    const name = incoming.name || system.system_name || "Imported system";
    const clean = Object.fromEntries(Object.entries(system).filter(([k]) => k !== "context" && k !== "saved_at"));
    return createProject(data, { name: String(name), system: clean, context, note: incoming.note || "" });
  }

  route("GET", "/api/library/export", async () => {
    const projects = store.data.projects.filter((p) => !p.is_deleted);
    const ids = new Set(projects.map((p) => p.project_id));
    return {
      format: "ue5-architect-library",
      version: 1,
      exported_at: nowIso(),
      projects: projects.map((p) => ({
        project_id: p.project_id,
        name: p.name,
        system: p.system,
        context: p.context || {},
        version: p.version,
        auto_fix_export: !!p.auto_fix_export,
        ignored_issues: p.ignored_issues || [],
        updated_at: p.updated_at,
        note: "",
      })),
      versions: store.data.versions.filter((v) => ids.has(v.project_id)).map((v) => ({
        project_id: v.project_id,
        version: v.version,
        system: v.system,
        context: v.context || {},
        saved_by_name: v.saved_by_name,
        saved_at: v.saved_at,
        note: v.note || "",
        fixes: v.fixes || [],
        label: v.label || "",
      })),
      presets: store.data.presets.map((p) => ({
        name: p.name,
        plugin_name: p.plugin_name,
        project_ids: p.project_ids,
        updated_at: p.updated_at,
      })),
      progress: store.data.progress || emptyProgress(),
    };
  });

  route("POST", "/api/library/import", async (req) => {
    const body = await readJson(req, 64 * 1024 * 1024);
    const incoming = body.data && typeof body.data === "object" ? body.data : body;
    if (incoming.format !== "ue5-architect-library" || !Array.isArray(incoming.projects)) {
      throw new HttpError(400, "That file isn't a library backup.");
    }
    return store.update((data) => {
      const map = {};
      let count = 0;
      for (const src of incoming.projects) {
        if (!src || typeof src !== "object" || !src.system) continue;
        const created = createProject(data, {
          name: src.name,
          system: src.system,
          context: src.context || {},
          note: "Imported from a library backup",
        });
        const project = findProject(data, created.project_id);
        map[src.project_id] = project.project_id;
        const rows = (incoming.versions || []).filter((v) => v.project_id === src.project_id);
        if (rows.length) {
          data.versions = data.versions.filter((v) => !(v.project_id === project.project_id && v.version === 1 && v.note === "Imported from a library backup"));
          for (const row of rows) {
            data.versions.push({
              project_id: project.project_id,
              version: row.version,
              system: row.system,
              context: row.context || {},
              saved_by_name: row.saved_by_name || OWNER,
              saved_at: row.saved_at || nowIso(),
              note: row.note || "",
              fixes: row.fixes || [],
              label: row.label || "",
            });
          }
          const latest = rows.reduce((a, b) => (b.version > a.version ? b : a), rows[0]);
          project.version = latest.version;
          project.system = latest.system;
          project.context = latest.context || project.context;
          project.updated_at = latest.saved_at || project.updated_at;
        }
        project.auto_fix_export = !!src.auto_fix_export;
        project.ignored_issues = Array.isArray(src.ignored_issues) ? src.ignored_issues : [];
        count += 1;
      }
      let presets = 0;
      for (const preset of incoming.presets || []) {
        const ids = (preset.project_ids || []).map((id) => map[id]).filter(Boolean);
        if (ids.length < 2) continue;
        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(String(preset.plugin_name || ""))) continue;
        data.presets.push({
          preset_id: newId("pre"),
          name: String(preset.name || "Imported preset").slice(0, 60),
          plugin_name: preset.plugin_name,
          project_ids: [...new Set(ids)].slice(0, 6),
          updated_at: nowIso(),
          owner_name: OWNER,
        });
        presets += 1;
      }
      if (!data.progress || typeof data.progress !== "object") data.progress = emptyProgress();
      const saved = incoming.progress && typeof incoming.progress === "object" ? incoming.progress : null;
      if (saved) {
        const have = new Set((data.progress.answered || []).map((item) => item.id));
        for (const item of Array.isArray(saved.answered) ? saved.answered : []) {
          if (!item || !item.id || have.has(item.id)) continue;
          data.progress.answered.push(item);
          have.add(item.id);
        }
        for (const item of Array.isArray(saved.practiced) ? saved.practiced : []) {
          if (!item?.system_name) continue;
          if (data.progress.practiced.some((row) => row.system_name === item.system_name)) continue;
          data.progress.practiced.unshift(item);
        }
        if (saved.study && typeof saved.study === "object" && !Array.isArray(saved.study)) {
          data.progress = ensureStudy(data.progress);
          data.progress.study = saved.study;
        }
      }
      return { imported: count, presets, progress: data.progress.answered.length };
    });
  });

  route("GET", "/api/progress", async () => store.data.progress || emptyProgress());

  route("POST", "/api/progress/answer", async (req) => {
    const body = await readJson(req);
    return store.update((data) => {
      data.progress = recordAnswer(data.progress, body || {});
      return data.progress;
    });
  });

  function liveStudy() {
    return ensureStudy(structuredClone(store.data.progress || {})).study;
  }

  function publicReview(item) {
    return {
      id: item.id,
      prompt: item.prompt,
      choices: item.choices,
      show_from: item.show_from,
      show_until: item.show_until,
    };
  }

  function programState(study, id) {
    return study.programs[id] || { complete: false, project_id: null, steps_done: [], tasks_passed: [] };
  }

  function programCard(program, study) {
    const state = programState(study, program.id);
    return {
      id: program.id,
      title: program.title,
      summary: program.summary,
      modules: (program.modules || []).map((mod) => ({ id: mod.id, title: mod.title, steps: (mod.steps || []).length })),
      task_count: (program.modify_tasks || []).length,
      complete: !!state.complete,
      project_id: state.project_id || null,
      steps_done: state.steps_done || [],
      tasks_passed: state.tasks_passed || [],
    };
  }

  function courseCard(course, study) {
    const saved = study.courses[course.id] || { modules: {} };
    return {
      id: course.id,
      title: course.title,
      summary: course.summary,
      pass_mark: course.pass_mark,
      modules: (course.modules || []).map((mod) => ({
        id: mod.id,
        title: mod.title,
        score: saved.modules?.[mod.id] || null,
      })),
    };
  }

  function findStep(program, stepId) {
    for (const mod of program.modules || []) {
      const step = (mod.steps || []).find((item) => item.id === stepId);
      if (step) return step;
    }
    return null;
  }

  route("GET", "/api/study", async () => {
    const study = liveStudy();
    return {
      session: study.session,
      packs: lessonPacks.files,
      problems: lessonPacks.problems || [],
      programs: lessonPacks.programs.map((program) => programCard(program, study)),
      courses: lessonPacks.courses.map((course) => courseCard(course, study)),
      reviews: dueReviews(study, study.session).map(publicReview),
    };
  });

  route("POST", "/api/study/session", async (req) => {
    const body = await readJson(req);
    return store.update((data) => {
      data.progress = ensureStudy(data.progress);
      const study = data.progress.study;
      bumpSession(study, body.launch_id);
      return { session: study.session, reviews: dueReviews(study, study.session).map(publicReview) };
    });
  });

  route("POST", "/api/study/review", async (req) => {
    const body = await readJson(req);
    return store.update((data) => {
      data.progress = ensureStudy(data.progress);
      const study = data.progress.study;
      const result = answerReview(study, body.id, body.choice);
      return { correct: result.correct, found: result.found, why: result.correct || result.found ? result.why : "" };
    });
  });

  route("GET", "/api/programs/:id", async (_req, params) => {
    const program = programById(lessonPacks, params.id);
    if (!program) throw new HttpError(404, "That program isn't in the packs.");
    const study = liveStudy();
    return { program, state: programState(study, program.id) };
  });

  route("POST", "/api/programs/:id/step", async (req, params) => {
    const program = programById(lessonPacks, params.id);
    if (!program) throw new HttpError(404, "That program isn't in the packs.");
    const body = await readJson(req);
    const step = findStep(program, body.step_id);
    if (!step) throw new HttpError(404, "That step isn't in the program.");
    const pass = acceptText(step.accept, body.answer) || (!!step.graph_check && body.graph_ok === true);
    return store.update((data) => {
      data.progress = ensureStudy(data.progress);
      const study = data.progress.study;
      const state = programState(study, program.id);
      if (pass && !(state.steps_done || []).includes(step.id)) state.steps_done = [...(state.steps_done || []), step.id];
      study.programs[program.id] = state;
      return { pass, detail: pass ? "That's the step." : "Not the answer this step is looking for.", steps_done: state.steps_done };
    });
  });

  route("POST", "/api/programs/:id/tasks/:task_id/check", async (req, params) => {
    const program = programById(lessonPacks, params.id);
    if (!program) throw new HttpError(404, "That program isn't in the packs.");
    const task = taskById(program, params.task_id);
    if (!task) throw new HttpError(404, "That task isn't in the program.");
    const body = await readJson(req);
    const result = checkTask(task, body.settings || {});
    return store.update((data) => {
      data.progress = ensureStudy(data.progress);
      const study = data.progress.study;
      const state = programState(study, program.id);
      if (result.pass && !(state.tasks_passed || []).includes(task.id)) {
        state.tasks_passed = [...(state.tasks_passed || []), task.id];
      }
      study.programs[program.id] = state;
      return { ...result, tasks_passed: state.tasks_passed };
    });
  });

  route("POST", "/api/programs/:id/complete", async (_req, params) => {
    const program = programById(lessonPacks, params.id);
    if (!program?.starter?.system_name) throw new HttpError(404, "That program has no starter project.");
    return store.update((data) => {
      data.progress = ensureStudy(data.progress);
      const study = data.progress.study;
      const state = programState(study, program.id);
      const existing = state.project_id ? findProject(data, state.project_id) : null;
      const project = existing || createProject(data, {
        name: program.title,
        system: structuredClone(program.starter),
        context: {
          prompt: program.summary || "",
          blueprint_class: "ActorComponent",
          unreal_version: "5.8",
          project_context: "",
          references: [],
          setup_done: [],
        },
        note: "Starter project from the program",
      });
      state.complete = true;
      state.project_id = project.project_id;
      study.programs[program.id] = state;
      return { ...project, complete: true };
    });
  });

  route("GET", "/api/courses/:id", async (_req, params) => {
    const course = courseById(lessonPacks, params.id);
    if (!course) throw new HttpError(404, "That course isn't in the packs.");
    const study = liveStudy();
    return { course, state: study.courses[course.id] || { modules: {} } };
  });

  route("POST", "/api/courses/:id/modules/:module_id/attempt", async (req, params) => {
    const course = courseById(lessonPacks, params.id);
    if (!course) throw new HttpError(404, "That course isn't in the packs.");
    const mod = (course.modules || []).find((item) => item.id === params.module_id);
    if (!mod) throw new HttpError(404, "That module isn't in the course.");
    const body = await readJson(req);
    const scored = scoreAttempt(mod, body || {}, course.pass_mark);
    return store.update((data) => {
      data.progress = ensureStudy(data.progress);
      const study = data.progress.study;
      if (scored.wrong.length) queueReviews(study, study.session, scored.wrong);
      if (!study.courses[course.id]) study.courses[course.id] = { modules: {} };
      const record = {
        correct: scored.correct,
        total: scored.total,
        percent: scored.percent,
        passed: scored.passed,
        assignment_ok: scored.assignment_ok,
        at: nowIso(),
      };
      study.courses[course.id].modules[mod.id] = record;
      return {
        ...record,
        takeaway: mod.takeaway,
        results: (mod.quiz || []).map((question) => ({
          id: question.id,
          correct: Number((body.answers || {})[question.id]) === question.answer,
          why: question.why,
        })),
        diff_correct: body.diff === mod.diff?.bug,
        diff_why: mod.diff?.why || "",
      };
    });
  });

  route("POST", "/api/explain", async (req) => {
    const body = await readJson(req);
    const before = String(body.before || "").slice(0, 2000);
    const after = String(body.after || "").slice(0, 2000);
    if (!before && !after) throw new HttpError(400, "There is no change to explain.");
    const llm = resolveLlm(req.headers, secrets);
    await store.update((data) => { recordUsage(data, llm.key, llm.provider, llm.model, "explain", clock); });
    let reply;
    try {
      reply = await complete({
        provider: llm.provider,
        model: llm.model,
        apiKey: llm.key,
        system: "Explain one Unreal code change in two short sentences for a learner. No JSON.",
        user: `Before:\n${before || "(nothing)"}\n\nAfter:\n${after || "(removed)"}`,
        maxTokens: 400,
        timeoutMs: 40000,
        fetchImpl,
      });
    } catch (exc) {
      throw new HttpError(502, "Couldn't explain that change. Try again.");
    }
    return { explanation: String(reply.text || "").trim().slice(0, 600) };
  });

  route("POST", "/api/graph/explain", async (req) => {
    const body = await readJson(req);
    const summary = String(body.summary || "").slice(0, 2000);
    const text = String(body.text || "").slice(0, 4000);
    if (!summary && !text) throw new HttpError(400, "There is no graph to explain.");
    const llm = resolveLlm(req.headers, secrets);
    await store.update((data) => { recordUsage(data, llm.key, llm.provider, llm.model, "explain", clock); });
    let reply;
    try {
      reply = await complete({
        provider: llm.provider,
        model: llm.model,
        apiKey: llm.key,
        system: "Explain an Unreal event graph in plain English for a learner. Say which events fire and what they do next. Two to five sentences. No JSON.",
        user: `Graph:\n${text || summary}`,
        maxTokens: 400,
        timeoutMs: 40000,
        fetchImpl,
      });
    } catch (exc) {
      return { explanation: summary };
    }
    return { explanation: String(reply.text || "").trim().slice(0, 800) || summary };
  });

  route("GET", "/api/projects/:project_id", async (_req, params) => {
    const project = requireProject(store.data, params.project_id);
    return detail(project);
  });

  route("PUT", "/api/projects/:project_id", async (req, params) => {
    const body = await readJson(req);
    if (!body.system || typeof body.system !== "object") throw new HttpError(400, "That doesn't look like a generated system");
    return store.update((data) => {
      const project = requireProject(data, params.project_id);
      const base = Number(body.base_version);
      if (project.version !== base && !body.force) {
        throw new HttpError(409, {
          message: `${project.updated_by_name} saved a newer version while you were editing.`,
          updated_by_name: project.updated_by_name,
          updated_at: project.updated_at,
          version: project.version,
        });
      }
      if (!data.versions.some((v) => v.project_id === project.project_id && v.version === project.version)) {
        snapshot(data, project);
      }
      project.system = body.system;
      project.context = body.context || {};
      project.updated_at = nowIso();
      project.updated_by_name = OWNER;
      project.version += 1;
      snapshot(data, project, body.note || "", Array.isArray(body.fixes) ? body.fixes.slice(0, 20) : []);
      claimReferences(data, project.context, project.project_id);
      return detail(project);
    });
  });

  route("PATCH", "/api/projects/:project_id/settings", async (req, params) => {
    const body = await readJson(req);
    return store.update((data) => {
      const project = requireProject(data, params.project_id);
      project.auto_fix_export = !!body.auto_fix_export;
      return { auto_fix_export: project.auto_fix_export };
    });
  });

  route("PUT", "/api/projects/:project_id/ignores", async (req, params) => {
    const body = await readJson(req);
    const ignores = (Array.isArray(body.ignores) ? body.ignores : []).slice(0, 200).map((i) => ({
      key: String(i.key || "").slice(0, 300),
      file: String(i.file || "").slice(0, 10),
      message: String(i.message || "").slice(0, 400),
      by: String(i.by || OWNER).slice(0, 120),
    })).filter((i) => i.key);
    return store.update((data) => {
      const project = requireProject(data, params.project_id);
      project.ignored_issues = ignores;
      return { ignored_issues: ignores };
    });
  });

  route("PATCH", "/api/projects/:project_id", async (req, params) => {
    const body = await readJson(req);
    const name = String(body.name || "").trim();
    if (!name || name.length > 120) throw new HttpError(400, "Give the project a name up to 120 characters.");
    return store.update((data) => {
      const project = requireProject(data, params.project_id);
      project.name = name;
      return { ok: true };
    });
  });

  route("DELETE", "/api/projects/:project_id", async (_req, params) => {
    return store.update((data) => {
      const project = requireProject(data, params.project_id);
      project.is_deleted = true;
      return { ok: true };
    });
  });

  route("GET", "/api/projects/:project_id/versions", async (_req, params) => {
    requireProject(store.data, params.project_id);
    const rows = store.data.versions
      .filter((v) => v.project_id === params.project_id)
      .sort((a, b) => b.version - a.version)
      .slice(0, 1000);
    return {
      versions: rows.map((r) => ({
        version: r.version,
        saved_by_name: r.saved_by_name,
        saved_at: r.saved_at,
        label: r.label || "",
        labeled_by_name: r.labeled_by_name || null,
        note: r.note || "",
        fixes: r.fixes || [],
        system_name: r.system?.system_name,
        summary: String(r.system?.summary || "").slice(0, 180),
        prompt: String(r.context?.prompt || "").slice(0, 180),
      })),
    };
  });

  route("GET", "/api/projects/:project_id/versions/:version", async (_req, params) => {
    requireProject(store.data, params.project_id);
    const version = Number(params.version);
    const row = store.data.versions.find((v) => v.project_id === params.project_id && v.version === version);
    if (!row) throw new HttpError(404, "Version not found");
    return { ...row, context: presentContext(row.context) };
  });

  route("PATCH", "/api/projects/:project_id/versions/:version", async (req, params) => {
    const body = await readJson(req);
    const label = String(body.label || "").trim().slice(0, 60);
    const version = Number(params.version);
    return store.update((data) => {
      requireProject(data, params.project_id);
      const row = data.versions.find((v) => v.project_id === params.project_id && v.version === version);
      if (!row) throw new HttpError(404, "Version not found");
      row.label = label;
      row.labeled_by_name = label ? OWNER : null;
      return { version, label };
    });
  });

  route("POST", "/api/projects/:project_id/versions/:version/restore", async (_req, params) => {
    const version = Number(params.version);
    return store.update((data) => {
      const project = requireProject(data, params.project_id);
      const row = data.versions.find((v) => v.project_id === params.project_id && v.version === version);
      if (!row) throw new HttpError(404, "Version not found");
      project.system = row.system;
      project.context = row.context || {};
      project.updated_at = nowIso();
      project.updated_by_name = OWNER;
      project.version += 1;
      snapshot(data, project, `Restored from v${version}`);
      return detail(project);
    });
  });

  route("GET", "/api/bundle-presets", async () => ({
    presets: [...store.data.presets].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at))).slice(0, 200).map((p) => ({
      preset_id: p.preset_id,
      name: p.name,
      plugin_name: p.plugin_name,
      project_ids: p.project_ids,
      updated_at: p.updated_at,
      owner_name: OWNER,
      mine: true,
    })),
  }));

  route("POST", "/api/bundle-presets", async (req) => {
    const body = await readJson(req);
    const name = String(body.name || "").trim().slice(0, 60);
    const plugin = String(body.plugin_name || "");
    const ids = [...new Set(Array.isArray(body.project_ids) ? body.project_ids.map(String) : [])];
    if (!name) throw new HttpError(400, "Name the preset.");
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(plugin) || plugin.length < 3 || plugin.length > 40) {
      throw new HttpError(400, "The plugin name needs to start with a letter and use only letters and numbers.");
    }
    if (ids.length < 2 || ids.length > 6) throw new HttpError(400, "A bundle preset needs 2 to 6 projects.");
    return store.update((data) => {
      for (const id of ids) requireProject(data, id);
      const row = {
        preset_id: newId("pre"),
        name,
        plugin_name: plugin,
        project_ids: ids,
        updated_at: nowIso(),
        owner_name: OWNER,
      };
      data.presets.push(row);
      return { ...row, mine: true };
    });
  });

  route("PATCH", "/api/bundle-presets/:preset_id", async (req, params) => {
    const body = await readJson(req);
    const name = String(body.name || "").trim().slice(0, 60);
    if (!name) throw new HttpError(400, "Name the preset.");
    return store.update((data) => {
      const row = data.presets.find((p) => p.preset_id === params.preset_id);
      if (!row) throw new HttpError(404, "Preset not found");
      row.name = name;
      row.updated_at = nowIso();
      return { ...row, mine: true };
    });
  });

  route("DELETE", "/api/bundle-presets/:preset_id", async (_req, params) => {
    return store.update((data) => {
      const before = data.presets.length;
      data.presets = data.presets.filter((p) => p.preset_id !== params.preset_id);
      if (data.presets.length === before) throw new HttpError(404, "Preset not found");
      return { ok: true };
    });
  });

  route("POST", "/api/files", async (req) => {
    const uploaded = await readMultipart(req);
    if (uploaded.tooBig) throw new HttpError(413, `File is larger than ${PROJECT_FILE_LIMIT / (1024 * 1024)} MB`);
    if (!uploaded.file) throw new HttpError(400, "Choose a file to upload.");
    const kind = uploaded.fields.kind;
    const projectId = uploaded.fields.project_id || null;
    if (kind !== "reference" && kind !== "project") throw new HttpError(400, "Upload kind must be reference or project.");
    if (kind === "project" && !projectId) throw new HttpError(400, "Project files need a saved project");
    if (projectId) requireProject(store.data, projectId);
    const filename = String(uploaded.file.filename || "file").trim() || "file";
    const ext = extOf(filename);
    let ctype = uploaded.file.mime || "application/octet-stream";
    const data = uploaded.file.data;
    const limit = kind === "reference" ? REF_LIMIT : PROJECT_FILE_LIMIT;
    if (data.length > limit) throw new HttpError(413, `File is larger than ${limit / (1024 * 1024)} MB`);
    let text = null;
    if (kind === "reference") {
      if (TEXT_EXT.has(ext)) ctype = "text/plain";
      else if (!REF_TYPES.has(ctype)) {
        throw new HttpError(400, "References can be images, PDFs, or code/text files (.h .cpp .txt .md .json)");
      }
      if (!ctype.startsWith("image/")) {
        text = ctype === "application/pdf" ? await pdfText(data) : textFromBytes(data);
      }
    }
    const fileId = newId("file");
    fs.writeFileSync(filePath(fileId), data);
    const record = {
      file_id: fileId,
      filename,
      content_type: ctype,
      size: data.length,
      kind,
      project_id: projectId,
      uploaded_by_name: OWNER,
      text,
      is_deleted: false,
      created_at: nowIso(),
    };
    await store.update((lib) => { lib.files.push(record); });
    return fileOut(record);
  });

  route("GET", "/api/projects/:project_id/files", async (_req, params) => {
    requireProject(store.data, params.project_id);
    const files = store.data.files
      .filter((f) => f.project_id === params.project_id && f.kind === "project" && !f.is_deleted)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return { files: files.map(fileOut) };
  });

  route("GET", "/api/files/:file_id", async (_req, params, res) => {
    const f = store.data.files.find((row) => row.file_id === params.file_id && !row.is_deleted);
    if (!f) throw new HttpError(404, "File not found");
    const bytes = fs.readFileSync(filePath(f.file_id));
    res.writeHead(200, {
      "Content-Type": f.content_type || "application/octet-stream",
      "Content-Length": bytes.length,
      "Content-Disposition": contentDisposition(f.filename),
      "Cache-Control": "no-store",
    });
    res.end(bytes);
    return undefined;
  });

  route("DELETE", "/api/files/:file_id", async (_req, params) => {
    return store.update((data) => {
      const f = data.files.find((row) => row.file_id === params.file_id && !row.is_deleted);
      if (!f) throw new HttpError(404, "File not found");
      f.is_deleted = true;
      return { ok: true };
    });
  });

  async function handle(req, res) {
    const url = new URL(req.url, "http://127.0.0.1");
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders(req));
      res.end();
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const match = url.pathname.match(r.re);
        if (!match) continue;
        const params = {};
        r.keys.forEach((key, i) => { params[key] = decodeURIComponent(match[i + 1]); });
        const result = await r.handler(req, params, res);
        if (result !== undefined && !res.writableEnded) send(res, 200, result, corsHeaders(req));
        return;
      }
      throw new HttpError(404, "Not found");
    }
    if (req.method === "GET" && staticDir) {
      serveStatic(res, staticDir, url.pathname);
      return;
    }
    throw new HttpError(404, "Not found");
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch((exc) => {
      if (res.writableEnded) return;
      const status = exc instanceof HttpError ? exc.status : 500;
      const detail = exc instanceof HttpError ? exc.detail : "Something went wrong. Please try again.";
      if (!(exc instanceof HttpError)) console.error(exc);
      send(res, status, { detail }, corsHeaders(req));
    });
  });

  const port = Number(options.port) || 0;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  return {
    server,
    port: server.address().port,
    dataDir,
    close: () => companion.close().then(() => new Promise((resolve) => server.close(resolve))),
  };
}

function corsHeaders(req) {
  return {
    "Access-Control-Allow-Origin": req.headers.origin || "*",
    "Access-Control-Allow-Headers": "Content-Type, X-LLM-Provider, X-LLM-Model, X-LLM-Key",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  };
}

function serveStatic(res, root, pathname) {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = path.resolve(root, rel);
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  let target = file;
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    target = path.join(root, "index.html");
  }
  if (!fs.existsSync(target)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = path.extname(target).toLowerCase();
  const data = fs.readFileSync(target);
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Content-Length": data.length,
    "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=3600",
  });
  res.end(data);
}

module.exports = { startServer, HttpError };
