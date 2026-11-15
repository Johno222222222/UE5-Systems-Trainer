"use strict";

const fs = require("fs");
const path = require("path");

const FILE_NAME = "index.json";

function communityDirs({ appPath, resourcesPath } = {}) {
  const dirs = [];
  if (appPath) dirs.push(path.join(appPath, "content", "community"));
  if (resourcesPath) {
    dirs.push(path.join(resourcesPath, "app.asar", "content", "community"));
    dirs.push(path.join(resourcesPath, "app", "content", "community"));
  }
  dirs.push(path.join(__dirname, "..", "content", "community"));
  return dirs;
}

function readIndex(dir) {
  const file = path.join(dir, FILE_NAME);
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  const problems = [];
  const packs = Array.isArray(parsed?.packs) ? parsed.packs : [];
  if (!packs.length) problems.push("The community index has no packs.");
  const clean = [];
  for (const pack of packs) {
    if (!pack?.id || !pack?.title || !pack?.file) {
      problems.push("A community pack needs an id, a title, and a file.");
      continue;
    }
    if (String(pack.file).includes("..") || String(pack.file).includes("\\") || String(pack.file).startsWith("/")) {
      problems.push(`${pack.id} has an unsafe file name.`);
      continue;
    }
    clean.push({
      id: String(pack.id),
      title: String(pack.title),
      author: String(pack.author || "Unknown"),
      summary: String(pack.summary || ""),
      file: String(pack.file),
    });
  }
  return {
    dir,
    packs: clean,
    how_to_submit: String(parsed?.how_to_submit || ""),
    problems,
  };
}

function loadCommunityIndex({ appPath, resourcesPath, dir } = {}) {
  const candidates = dir ? [dir] : communityDirs({ appPath, resourcesPath });
  for (const folder of candidates) {
    try {
      if (!folder || !fs.existsSync(path.join(folder, FILE_NAME))) continue;
      return readIndex(folder);
    } catch (exc) {
      return { dir: folder, packs: [], how_to_submit: "", problems: [`${folder} is not a readable community index (${exc.message})`] };
    }
  }
  return { dir: "", packs: [], how_to_submit: "", problems: ["The community index was not in the app."] };
}

function settingsPath(dataDir) {
  return path.join(dataDir, "community.json");
}

function readSettings(dataDir) {
  const defaults = { enabled: false, repo: "", path: "packs" };
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsPath(dataDir), "utf8"));
    return {
      enabled: parsed.enabled === true,
      repo: String(parsed.repo || "").trim(),
      path: String(parsed.path || "packs").trim() || "packs",
    };
  } catch {
    return defaults;
  }
}

function writeSettings(dataDir, patch) {
  const current = readSettings(dataDir);
  const next = {
    enabled: patch.enabled === undefined ? current.enabled : patch.enabled === true,
    repo: patch.repo === undefined ? current.repo : String(patch.repo || "").trim(),
    path: patch.path === undefined ? current.path : (String(patch.path || "").trim() || "packs"),
  };
  if (next.repo && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(next.repo)) {
    const err = new Error("Community repo must look like owner/name.");
    err.statusCode = 400;
    throw err;
  }
  if (next.path.includes("..") || next.path.startsWith("/")) {
    const err = new Error("Community path cannot leave the repository.");
    err.statusCode = 400;
    throw err;
  }
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(settingsPath(dataDir), JSON.stringify(next, null, 2));
  return next;
}

function notesPath(dataDir) {
  return path.join(dataDir, "community-notes.json");
}

function readNotes(dataDir) {
  try {
    const parsed = JSON.parse(fs.readFileSync(notesPath(dataDir), "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNotes(dataDir, notes) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(notesPath(dataDir), JSON.stringify(notes, null, 2));
}

module.exports = {
  communityDirs,
  loadCommunityIndex,
  readSettings,
  writeSettings,
  readNotes,
  writeNotes,
};
