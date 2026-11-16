"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { startServer } = require("../server");
const { buildPack, encodePack, decodePack, validatePack, zipStore } = require("../bbpack");
const { loadCommunityIndex } = require("../community");

const SYSTEM = {
  system_name: "Rifle",
  summary: "A rifle component.",
  cpp_header: "class URifle {};",
  cpp_source: "void URifle::Fire() {}",
  learning: { why_notes: [{ id: "why", text: "Server owns the shot." }], challenges: [{ id: "c1", prompt: "Where?" }] },
  graphs: { items: [{ id: "event", kind: "event", name: "Event Graph", nodes: [], wires: [] }] },
};

async function boot(extra = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-pack-"));
  const handle = await startServer({ dataDir, port: 0, ...extra });
  return { ...handle, dataDir };
}

test("a pack round-trips, rejects a bad schema, and refuses a path escape", () => {
  const pack = buildPack({
    kind: "project",
    name: "Rifle",
    author: "Ada",
    version: "1.2.0",
    description: "Shared rifle",
    content: { system: SYSTEM, context: { note: "keep" } },
  });
  const encoded = encodePack(pack);
  assert.equal(encoded.bytes.readUInt32LE(0), 0x04034b50);
  const decoded = decodePack(encoded.bytes);
  assert.equal(decoded.ok, true);
  assert.equal(decoded.pack.content.system.system_name, "Rifle");
  assert.equal(decoded.preview.counts.challenges, 1);
  assert.equal(decoded.preview.counts.notes, 1);

  const bad = validatePack({ format: "bbpack", schema: 2, kind: "project", name: "X", author: "A", version: "1", content: { system: SYSTEM } });
  assert.equal(bad.ok, false);
  assert.match(bad.errors.join(" "), /schema/);

  const evil = zipStore([
    { name: "../secret.txt", data: "{}" },
    { name: "manifest.json", data: "{}" },
  ]);
  assert.throws(() => decodePack(evil), /not allowed/);
});

test("import previews a conflict, renames, and keeps community notes", async () => {
  const handle = await boot();
  try {
    const created = await (await fetch(`http://127.0.0.1:${handle.port}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Rifle", system: SYSTEM }),
    })).json();
    const exported = await (await fetch(`http://127.0.0.1:${handle.port}/api/packs/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "project", project_id: created.project_id, author: "Ada" }),
    })).json();
    assert.match(exported.filename, /\.bbpack$/);
    const preview = await (await fetch(`http://127.0.0.1:${handle.port}/api/packs/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: exported.base64 }),
    })).json();
    assert.equal(preview.ok, true);
    assert.equal(preview.conflicts.length, 1);
    const blocked = await (await fetch(`http://127.0.0.1:${handle.port}/api/packs/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: exported.base64 }),
    })).json();
    assert.equal(blocked.needsChoice, true);
    const imported = await (await fetch(`http://127.0.0.1:${handle.port}/api/packs/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: exported.base64, mode: "rename" }),
    })).json();
    assert.equal(imported.ok, true);
    const projects = await (await fetch(`http://127.0.0.1:${handle.port}/api/projects`)).json();
    assert.ok(projects.mine.some((item) => item.name === "Rifle (2)"));

    const sample = fs.readFileSync(path.join(__dirname, "..", "..", "content", "community", "sample-notes.bbpack"));
    const notesPack = await (await fetch(`http://127.0.0.1:${handle.port}/api/packs/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: sample.toString("base64"), mode: "rename" }),
    })).json();
    assert.equal(notesPack.applied.notes, 2);
    const notes = await (await fetch(`http://127.0.0.1:${handle.port}/api/community-notes`)).json();
    assert.ok(notes.notes.some((item) => item.topic === "authority-and-rpcs" && item.author === "Blueprint Builder"));
  } finally {
    await handle.close();
  }
});

test("the community index is bundled, off by default, and a fixture folder parses", async () => {
  const bundled = loadCommunityIndex();
  assert.deepEqual(bundled.problems, []);
  assert.ok(bundled.packs.some((item) => item.id === "sample-notes"));
  assert.match(bundled.how_to_submit, /pull request/);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-community-"));
  fs.writeFileSync(path.join(dir, "index.json"), JSON.stringify({
    how_to_submit: "Send a file.",
    packs: [{ id: "local", title: "Local pack", author: "Sam", summary: "Fixture", file: "local.bbpack" }],
  }));
  const fixture = loadCommunityIndex({ dir });
  assert.equal(fixture.packs[0].title, "Local pack");
  assert.deepEqual(fixture.problems, []);

  const handle = await boot({
    fetchImpl: async (url) => new Response(JSON.stringify([
      { name: "hello.bbpack", download_url: "https://example.test/hello.bbpack" },
    ]), { status: 200, headers: { "content-type": "application/json" } }),
  });
  try {
    const off = await (await fetch(`http://127.0.0.1:${handle.port}/api/community`)).json();
    assert.equal(off.enabled, false);
    assert.equal(off.source, "bundled");
    const sample = await (await fetch(`http://127.0.0.1:${handle.port}/api/community/packs/sample-notes`)).json();
    assert.match(sample.filename, /sample-notes\.bbpack/);
    assert.ok(sample.base64.length > 20);
    const saved = await (await fetch(`http://127.0.0.1:${handle.port}/api/community/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true, repo: "example/packs", path: "packs" }),
    })).json();
    assert.equal(saved.enabled, true);
    const on = await (await fetch(`http://127.0.0.1:${handle.port}/api/community`)).json();
    assert.equal(on.source, "github");
    assert.equal(on.packs[0].id, "hello");
  } finally {
    await handle.close();
  }
});

test("planned items and real resource links load", async () => {
  const handle = await boot();
  try {
    const planned = await (await fetch(`http://127.0.0.1:${handle.port}/api/planned`)).json();
    assert.ok(planned.items.some((item) => item.id === "ue-companion"));
    assert.ok(planned.items.some((item) => item.id === "community-repo"));
    const resources = await (await fetch(`http://127.0.0.1:${handle.port}/api/resources`)).json();
    const ids = resources.resources.map((item) => item.id);
    assert.ok(ids.includes("action-roguelike"));
    assert.ok(ids.includes("lyra"));
    assert.ok(ids.includes("gas-docs"));
    for (const item of resources.resources) {
      assert.match(item.url, /^https:\/\/(github\.com|dev\.epicgames\.com)\//);
      assert.ok(item.look && item.systems.length);
    }
  } finally {
    await handle.close();
  }
});

test("the installer workflow builds macOS and Linux apart from Windows", () => {
  const text = fs.readFileSync(path.join(__dirname, "..", "..", ".github", "workflows", "desktop-installer.yml"), "utf8");
  assert.match(text, /name: Windows installer/);
  assert.match(text, /name: macOS archive/);
  assert.match(text, /name: Linux packages/);
  assert.match(text, /electron-builder --mac dmg zip/);
  assert.match(text, /electron-builder --linux AppImage deb/);
  assert.match(text, /name: GitHub Release/);
  assert.match(text, /actions\/checkout@v5/);
  assert.match(text, /GH_REPO: \$\{\{ github\.repository \}\}/);
  assert.match(text, /gh release view "\$tag" --repo "\$GH_REPO"/);
  assert.match(text, /gh release upload "\$tag" out\/\* --clobber --repo "\$GH_REPO"/);
  assert.match(text, /gh release create "\$tag" out\/\* --title "\$tag" --generate-notes --verify-tag --repo "\$GH_REPO"/);
  assert.equal(/windows:[\s\S]*?needs:\s*\[macos/.test(text), false);
  const pkg = require("../../package.json");
  assert.ok(pkg.build.files.some((item) => String(item).includes("content/community")));
  assert.equal(pkg.version, "1.15.0");
});
