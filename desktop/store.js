"use strict";

const fs = require("fs");
const path = require("path");

function emptyLibrary() {
  return { projects: [], versions: [], presets: [], files: [], usage: [] };
}

function createStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let data = emptyLibrary();
  if (fs.existsSync(file)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      data = { ...emptyLibrary(), ...parsed };
      for (const key of Object.keys(emptyLibrary())) {
        if (!Array.isArray(data[key])) data[key] = [];
      }
    } catch (exc) {
      const broken = `${file}.broken-${Date.now()}`;
      try { fs.renameSync(file, broken); } catch { /* keep going with an empty library */ }
      console.error(`Library file could not be read. The old file was moved aside. ${exc.message}`);
      data = emptyLibrary();
    }
  }

  let chain = Promise.resolve();

  function save() {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
  }

  function update(mutator) {
    const run = chain.then(() => {
      const backup = structuredClone(data);
      try {
        const result = mutator(data);
        save();
        return result;
      } catch (exc) {
        data.projects = backup.projects;
        data.versions = backup.versions;
        data.presets = backup.presets;
        data.files = backup.files;
        data.usage = backup.usage;
        throw exc;
      }
    });
    chain = run.then(() => {}, () => {});
    return run;
  }

  return {
    update,
    get data() {
      return data;
    },
  };
}

module.exports = { createStore, emptyLibrary };
