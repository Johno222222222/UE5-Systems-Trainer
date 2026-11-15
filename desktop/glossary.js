"use strict";

const fs = require("fs");
const path = require("path");

const FILE_NAME = "glossary.json";

function glossaryCandidates({ appPath, resourcesPath } = {}) {
  const candidates = [];
  const push = (root) => {
    if (!root) return;
    candidates.push(path.join(root, "content", FILE_NAME));
    candidates.push(path.join(root, "content", "glossary", "terms.json"));
  };
  push(appPath);
  if (resourcesPath) {
    push(path.join(resourcesPath, "app.asar"));
    push(path.join(resourcesPath, "app"));
  }
  push(path.join(__dirname, ".."));
  return candidates;
}

function readGlossaryFile(file) {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  const terms = Array.isArray(parsed?.terms) ? parsed.terms : [];
  return terms.filter((term) => term && term.term && (term.summary || term.definition));
}

function loadGlossary({ appPath, resourcesPath } = {}) {
  const tried = glossaryCandidates({ appPath, resourcesPath });
  for (const file of tried) {
    try {
      if (!file || !fs.existsSync(file)) continue;
      return { file, terms: readGlossaryFile(file), problems: [] };
    } catch (exc) {
      return { file, terms: [], problems: [`${file} is not readable JSON (${exc.message})`] };
    }
  }
  return { file: "", terms: [], problems: ["The glossary file was not in the app."] };
}

module.exports = { glossaryCandidates, loadGlossary, FILE_NAME };
