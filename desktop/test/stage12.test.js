"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { startServer } = require("../server");
const { summarizeProject } = require("../companion");

const SYSTEM = {
  system_name: "Health And Damage",
  summary: "Tracks health.",
  cpp_header: "UCLASS()\nclass UHealth : public UActorComponent {\n  GENERATED_BODY()\npublic:\n  UPROPERTY() int32 MaxHealth;\n};\n",
  cpp_source: "void UHealth::BeginPlay() { MaxHealth = 100; }\n",
};

async function boot() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-companion-"));
  const handle = await startServer({ dataDir, port: 0 });
  return handle;
}

test("pairing rejects a bad code and then accepts a project report", async () => {
  const handle = await boot();
  try {
    const info = await (await fetch(`http://127.0.0.1:${handle.port}/api/companion`)).json();
    assert.equal(info.host, "127.0.0.1");
    assert.equal(info.paired, false);
    const bad = await fetch(`http://127.0.0.1:${info.port}/v1/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "NOPE" }),
    });
    assert.equal(bad.status, 401);
    const paired = await (await fetch(`http://127.0.0.1:${info.port}/v1/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: info.code }),
    })).json();
    assert.ok(paired.token);
    const denied = await fetch(`http://127.0.0.1:${info.port}/v1/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: "Game" }),
    });
    assert.equal(denied.status, 401);
    const report = await fetch(`http://127.0.0.1:${info.port}/v1/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Companion-Token": paired.token },
      body: JSON.stringify({
        project: "Game",
        engine: "5.8.0-0+UE5",
        plugins: ["GameplayAbilities", "EnhancedInput"],
        classes: [
          { name: "BP_Hero", parent: "Character", kind: "Blueprint" },
          { name: "BP_Menu", parent: "UserWidget", kind: "Blueprint" },
        ],
      }),
    });
    assert.equal(report.status, 200);
    const seen = await (await fetch(`http://127.0.0.1:${handle.port}/api/companion`)).json();
    assert.equal(seen.paired, true);
    assert.equal(seen.project, "Game");
    assert.match(seen.summary, /BP_Hero/);
    assert.ok(seen.summary.length <= 700);
    const context = await (await fetch(`http://127.0.0.1:${handle.port}/api/companion/context`, { method: "POST" })).json();
    assert.match(context.summary, /Engine 5\.8/);
    assert.match(context.summary, /GameplayAbilities/);
  } finally {
    await handle.close();
  }
});

test("send to unreal writes the module, refuses an edited file, and queues a reload", async () => {
  const handle = await boot();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-uproject-"));
  const uproject = path.join(dir, "Game.uproject");
  fs.writeFileSync(uproject, JSON.stringify({ FileVersion: 3, EngineAssociation: "5.8" }));
  try {
    const info = await (await fetch(`http://127.0.0.1:${handle.port}/api/companion`)).json();
    const paired = await (await fetch(`http://127.0.0.1:${info.port}/v1/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: info.code }),
    })).json();
    const first = await (await fetch(`http://127.0.0.1:${handle.port}/api/companion/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uproject, system: SYSTEM }),
    })).json();
    assert.equal(first.ok, true);
    assert.equal(first.queued, true);
    assert.match(fs.readFileSync(path.join(first.path, "Source", first.plugin, "Public", "Health.h"), "utf8"), /MaxHealth/);
    const headerPath = path.join(first.path, "Source", first.plugin, "Public", "Health.h");
    fs.writeFileSync(headerPath, "/* player edit */\n");
    const blocked = await (await fetch(`http://127.0.0.1:${handle.port}/api/companion/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uproject, system: SYSTEM }),
    })).json();
    assert.equal(blocked.ok, false);
    assert.ok(blocked.conflicts.some((item) => item.endsWith("Health.h")));
    assert.match(fs.readFileSync(headerPath, "utf8"), /player edit/);
    const pending = await (await fetch(`http://127.0.0.1:${info.port}/v1/pending`, {
      headers: { "X-Companion-Token": paired.token },
    })).json();
    assert.equal(pending.command.type, "reload");
    const summary = summarizeProject({
      project: "Game",
      engine: "5.8",
      classes: Array.from({ length: 40 }, (_, index) => ({ name: `AActor${index}`, parent: "Actor" })),
    }, 180);
    assert.ok(summary.length <= 180);
    assert.match(summary, /AActor0/);
  } finally {
    await handle.close();
  }
});

test("install copies the companion plugin and enables it on the uproject", async () => {
  const handle = await boot();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-install-"));
  const uproject = path.join(dir, "Game.uproject");
  fs.writeFileSync(uproject, JSON.stringify({ FileVersion: 3 }));
  try {
    const installed = await (await fetch(`http://127.0.0.1:${handle.port}/api/companion/install`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uproject }),
    })).json();
    assert.equal(installed.ok, true);
    assert.equal(fs.existsSync(path.join(installed.path, "ArchitectCompanion.uplugin")), true);
    const project = JSON.parse(fs.readFileSync(uproject, "utf8"));
    assert.ok(project.Plugins.some((item) => item.Name === "ArchitectCompanion" && item.Enabled));
  } finally {
    await handle.close();
  }
});
