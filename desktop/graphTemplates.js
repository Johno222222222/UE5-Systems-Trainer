"use strict";

// Graph templates are plain JSON files, the same idea as the lesson packs.
// A packaged app reads them from inside the app. Dev and tests read the repo copy.

const fs = require("fs");
const path = require("path");

function templateDirs({ appPath, resourcesPath } = {}) {
  const dirs = [];
  if (appPath) dirs.push(path.join(appPath, "content", "templates"));
  if (resourcesPath) {
    dirs.push(path.join(resourcesPath, "app.asar", "content", "templates"));
    dirs.push(path.join(resourcesPath, "app", "content", "templates"));
  }
  dirs.push(path.join(__dirname, "..", "content", "templates"));
  return dirs;
}

function readDir(dir) {
  const names = fs.readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
  const templates = [];
  const problems = [];
  for (const name of names) {
    const file = path.join(dir, name);
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!parsed?.id || !parsed?.title || !Array.isArray(parsed?.graph?.nodes) || !parsed.graph.nodes.length) {
        problems.push(`${name} needs an id, a title, and at least one node`);
        continue;
      }
      templates.push(parsed);
    } catch (exc) {
      problems.push(`${name} is not readable JSON (${exc.message})`);
    }
  }
  return { dir, files: names, templates, problems };
}

function loadGraphTemplates({ appPath, resourcesPath } = {}) {
  for (const dir of templateDirs({ appPath, resourcesPath })) {
    try {
      if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
      return readDir(dir);
    } catch (exc) {
      return { dir, files: [], templates: [], problems: [`${dir} could not be read (${exc.message})`] };
    }
  }
  return { dir: "", files: [], templates: [], problems: ["Graph templates were not in the app."] };
}

module.exports = { templateDirs, loadGraphTemplates };
