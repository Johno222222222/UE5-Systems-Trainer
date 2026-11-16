"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { startServer } = require("../server");
const { buildEditorLearn, searchGlossary } = require("../editorLearn");
const { recordAnswer } = require("../practice");

const INVENTORY = {
  system_name: "Grid Weapon Inventory Component",
  summary: "The component owns the grid. The widget only draws it.",
  cpp_header: `#pragma once
#include "UJFInventory.generated.h"
UCLASS()
class UJFInventory : public UActorComponent
{
  GENERATED_BODY()
public:
  UPROPERTY(EditAnywhere) int32 InventoryColumns;
  UPROPERTY(EditAnywhere) float InteractionReach;
  UPROPERTY(EditAnywhere) float MaxWeightLimit;
};
`,
  cpp_source: `UJFInventory::UJFInventory()
{
  InventoryColumns = 5;
  InteractionReach = 250.f;
  MaxWeightLimit = 100.f;
}
`,
  learning: {
    why_notes: [
      { anchor: { kind: "cpp", file: ".h", line: 1 }, one_line: "The grid lives on the component.", tradeoff: "A widget copy drifts.", common_mistake: "Writing the count in the widget." },
      { anchor: { kind: "node", node_id: "n1" }, one_line: "The Blueprint shows the grid.", tradeoff: "It should not decide the rules.", common_mistake: "Putting the check on Tick." },
    ],
  },
};

test("editor challenges point at the real assets and use constructor defaults", () => {
  const learn = buildEditorLearn(INVENTORY);
  assert.ok(learn.challenges.length >= 2 && learn.challenges.length <= 4);
  const row = learn.challenges.find((item) => item.id === "row-shotgun");
  assert.match(row.prompt, /DT_UJFInventoryStats/);
  assert.match(row.prompt, /MaxWeightLimit|InventoryColumns/);
  assert.equal(row.check.kind, "table-row");
  assert.equal(row.check.row, "Shotgun");
  assert.equal(row.check.compare, "gt");
  const reach = learn.challenges.find((item) => item.id === "asset-reach");
  assert.match(reach.prompt, /DA_UJFInventory/);
  assert.ok(reach.prompt.includes("InteractionReach"));
  assert.ok(reach.prompt.includes("300"));
  assert.equal(reach.check.equals, 300);
  const blueprint = learn.challenges.find((item) => item.id === "blueprint-edit");
  assert.match(blueprint.prompt, /BP_UJFInventory/);
  assert.equal(blueprint.check.kind, "blueprint-edit");
  assert.equal(learn.challenges.some((item) => item.manual), true);
  const cpp = learn.groups.find((group) => group.id === "cpp");
  assert.match(cpp.notes[0].one_line, /grid lives on the component/);
  assert.match(cpp.notes[0].tradeoff, /drifts/);
  const terms = searchGlossary([
    { id: "replication", term: "Replication", summary: "The server copies state.", detail: "Mark the fields.", see: ["onrep"] },
    { id: "onrep", term: "OnRep", summary: "Runs when a value arrives.", detail: "Do not decide the value here.", see: [] },
  ], "replic");
  assert.equal(terms[0].term, "Replication");
  assert.equal(terms[0].see[0], "OnRep");
  const progress = recordAnswer(null, { system_name: learn.systemName, challenge_index: 100, correct: true, asset: reach.asset });
  assert.equal(progress.answered[0].asset, reach.asset);
  assert.equal(progress.practiced[0].count, 1);
});

test("create sends the learn payload, glossary search answers, and a check is recorded", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-learn-"));
  const handle = await startServer({ dataDir, port: 0 });
  try {
    const info = await (await fetch(`http://127.0.0.1:${handle.port}/api/companion`)).json();
    const paired = await (await fetch(`http://127.0.0.1:${info.port}/v1/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: info.code }),
    })).json();
    const headers = { "Content-Type": "application/json", "X-Companion-Token": paired.token };
    const created = await (await fetch(`http://127.0.0.1:${handle.port}/api/companion/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: INVENTORY }),
    })).json();
    assert.equal(created.ok, true);
    const pending = await (await fetch(`http://127.0.0.1:${info.port}/v1/pending`, { headers })).json();
    assert.equal(pending.command.learn.systemName, "Grid Weapon Inventory Component");
    assert.ok(pending.command.learn.challenges.length >= 2);
    const found = await (await fetch(`http://127.0.0.1:${info.port}/v1/glossary?q=replication`, { headers })).json();
    assert.ok(found.terms.some((term) => term.term === "Replication"));
    assert.ok(found.terms[0].summary);
    const posted = await (await fetch(`http://127.0.0.1:${info.port}/v1/result`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        id: "learn-check-1",
        ok: true,
        message: "1 of 3 checks passed.",
        assets: [],
        conflicts: [],
        checks: [{ id: "asset-reach", pass: true, manual: false, asset: pending.command.learn.challenges.find((item) => item.id === "asset-reach").asset, systemName: pending.command.learn.systemName, hint: "InteractionReach is 300." }],
      }),
    })).json();
    assert.equal(posted.ok, true);
    const seen = await (await fetch(`http://127.0.0.1:${handle.port}/api/companion`)).json();
    assert.equal(seen.result.checks[0].pass, true);
    const progress = await (await fetch(`http://127.0.0.1:${handle.port}/api/progress`)).json();
    assert.equal(progress.answered[0].system_name, "Grid Weapon Inventory Component");
    assert.match(progress.answered[0].asset, /DA_UJFInventory/);
    assert.equal(progress.practiced[0].count, 1);
  } finally {
    await handle.close();
  }
});
