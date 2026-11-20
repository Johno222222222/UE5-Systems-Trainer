"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { startServer } = require("../server");
const { bundledPackCandidates, loadPackSources, userPackDir } = require("../packs");

test("the installer file list includes the lesson packs", () => {
  const pkg = require("../../package.json");
  const files = pkg.build.files.map((item) => String(item));
  assert.ok(files.some((item) => item.includes("content/packs")), files.join(", "));
  assert.equal(pkg.build.asar, true);
  assert.equal(pkg.version, "1.17.0");
});

test("pack folders resolve from the app path, not the current directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-pack-path-"));
  const appPath = path.join(root, "resources", "app.asar");
  const bundled = path.join(appPath, "content", "packs");
  fs.mkdirSync(bundled, { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, "..", "..", "content", "packs", "tactical-fps.json"),
    path.join(bundled, "tactical-fps.json"),
  );
  const resourcesPath = path.join(root, "resources");
  const candidates = bundledPackCandidates({ appPath, resourcesPath });
  assert.equal(candidates[0], path.join(appPath, "content", "packs"));
  assert.ok(candidates.some((dir) => dir.includes(`${path.sep}app.asar${path.sep}`)));

  const previous = process.cwd();
  process.chdir(os.tmpdir());
  try {
    const loaded = loadPackSources({ appPath, resourcesPath, userData: path.join(root, "absent-user") });
    assert.equal(loaded.dir, bundled);
    assert.ok(loaded.files.includes("tactical-fps.json"));
    assert.ok(loaded.programs.some((item) => item.id === "tactical-fps"));
    assert.deepEqual(loaded.problems, []);
  } finally {
    process.chdir(previous);
  }
});

test("a user pack is added and a broken pack is reported", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-pack-user-"));
  const appPath = path.join(root, "app");
  fs.mkdirSync(path.join(appPath, "content", "packs"), { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, "..", "..", "content", "packs", "tactical-fps.json"),
    path.join(appPath, "content", "packs", "tactical-fps.json"),
  );
  const userData = path.join(root, "user");
  const extra = userPackDir(userData);
  fs.mkdirSync(extra, { recursive: true });
  fs.writeFileSync(path.join(extra, "notes.json"), "{ this is not json");
  const loaded = loadPackSources({ appPath, userData });
  assert.ok(loaded.files.includes("tactical-fps.json"));
  assert.equal(loaded.files.includes("notes.json"), false);
  assert.ok(loaded.problems.some((problem) => problem.includes("notes.json")));
  assert.ok(loaded.programs.some((item) => item.id === "tactical-fps"));

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-pack-api-"));
  const handle = await startServer({
    dataDir,
    port: 0,
    appPath,
    userData: dataDir,
    staticDir: path.join(__dirname, "missing-ui"),
    fetchImpl: async () => new Response("{}", { status: 500 }),
  });
  try {
    fs.mkdirSync(path.join(dataDir, "packs"), { recursive: true });
    fs.writeFileSync(path.join(dataDir, "packs", "broken.json"), "{");
    const restarted = await startServer({
      dataDir,
      port: 0,
      appPath,
      staticDir: path.join(__dirname, "missing-ui"),
      fetchImpl: async () => new Response("{}", { status: 500 }),
    });
    try {
      const body = await (await fetch(`http://127.0.0.1:${restarted.port}/api/study`)).json();
      assert.ok(body.programs.some((item) => item.id === "tactical-fps"));
      assert.ok(body.courses.some((item) => item.id === "tactical-fps-course"));
      assert.ok(body.problems.some((problem) => problem.includes("broken.json")));
    } finally {
      await restarted.close();
    }
  } finally {
    await handle.close();
  }
});
