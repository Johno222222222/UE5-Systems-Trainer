"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { startServer } = require("../server");
const { buildAssetPlan, assetSources } = require("../realAssets");
const { pluginFileMap } = require("../pluginFiles");

const AMMO = {
  system_name: "Weapon Ammo",
  summary: "Magazine and reserve.",
  cpp_header: `#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "WeaponAmmo.generated.h"
UCLASS()
class UWeaponAmmo : public UActorComponent
{
	GENERATED_BODY()
public:
	UPROPERTY(EditAnywhere)
	int32 Magazine = 30;
};
`,
  cpp_source: `#include "WeaponAmmo.h"\nvoid UWeaponAmmo::BeginPlay() {}\n`,
  variables: [
    { name: "Magazine", type: "int", default: "30" },
    { name: "Reserve", type: "int", default: "90" },
  ],
};

test("the asset plan names a data table, a primary asset, and a blueprint stub", () => {
  const plan = buildAssetPlan(AMMO);
  assert.equal(plan.type, "create-assets");
  assert.equal(plan.confirm, false);
  assert.equal(plan.folder, "/Game/Architect/WeaponAmmo");
  assert.equal(plan.module, "WeaponAmmoKit");
  assert.equal(plan.table.struct, "FWeaponAmmoStatsRow");
  assert.equal(plan.table.asset, "DT_WeaponAmmoStats");
  assert.deepEqual(plan.table.rows.map((row) => row.name), ["Rifle", "Sidearm"]);
  assert.equal(plan.table.rows[0].values.Magazine, "30");
  assert.equal(plan.table.rows[1].values.Reserve, "45");
  assert.equal(plan.primary.className, "UWeaponAmmoData");
  assert.equal(plan.primary.values.Magazine, "30");
  assert.equal(plan.blueprint.parent, "UWeaponAmmo");
  assert.equal(plan.blueprint.kind, "Component");
  assert.match(plan.blueprint.comment, /does not build the node graph/);
  assert.match(plan.missingMessage, /Send to Unreal and compile first/);
  assert.match(plan.missingMessage, /FWeaponAmmoStatsRow/);

  const chosen = buildAssetPlan(AMMO, { folder: "/Game/Architect/Weapons", confirm: true });
  assert.equal(chosen.folder, "/Game/Architect/Weapons");
  assert.equal(chosen.confirm, true);
  const refused = buildAssetPlan(AMMO, { folder: "/Engine/Foo" });
  assert.equal(refused.folder, "/Game/Architect/WeaponAmmo");

  const sources = assetSources(AMMO);
  const row = sources["Public/WeaponAmmoStatsRow.h"];
  const data = sources["Public/WeaponAmmoData.h"];
  const cpp = sources["Private/WeaponAmmoData.cpp"];
  assert.match(row, /struct WEAPONAMMOKIT_API FWeaponAmmoStatsRow : public FTableRowBase/);
  assert.match(row, /int32 Magazine = 30;/);
  assert.match(data, /class WEAPONAMMOKIT_API UWeaponAmmoData : public UPrimaryDataAsset/);
  assert.match(cpp, /^#include "WeaponAmmoData.h"/);
  assert.equal(/(?<![\d.])\d+f\b/.test(`${row}\n${data}\n${cpp}`), false);

  const map = pluginFileMap(AMMO);
  assert.match(map.files["Source/WeaponAmmoKit/Public/WeaponAmmoStatsRow.h"], /FTableRowBase/);
  assert.match(map.files["Source/WeaponAmmoKit/Private/WeaponAmmoData.cpp"], /GetPrimaryAssetId/);

  const inventory = buildAssetPlan({
    system_name: "Grid Weapon Inventory Component",
    cpp_header: `#pragma once
#include "CoreMinimal.h"
#include "UJFInventory.generated.h"
UCLASS()
class UJFInventory : public UActorComponent
{
	GENERATED_BODY()
public:
	UJFInventory();
	UPROPERTY(EditAnywhere) int32 InventoryColumns;
	UPROPERTY(EditAnywhere) int32 InventoryRows;
	UPROPERTY(EditAnywhere) float MaxWeightLimit;
	UPROPERTY(EditAnywhere) float InteractionReach;
	UPROPERTY(EditAnywhere) FName AttachmentSocket;
};
`,
    cpp_source: `UJFInventory::UJFInventory()
	: InventoryColumns(5)
{
	InventoryRows = 2;
	MaxWeightLimit = 100.f;
	InteractionReach = 250.f;
	AttachmentSocket = TEXT("hand_r");
}
`,
    variables: [
      { name: "InventoryColumns", type: "int", default: "0" },
      { name: "InventoryRows", type: "int", default: "0" },
      { name: "MaxWeightLimit", type: "float", default: "0" },
      { name: "InteractionReach", type: "float", default: "0" },
      { name: "AttachmentSocket", type: "name", default: "" },
    ],
  });
  const rifle = inventory.table.rows.find((row) => row.name === "Rifle").values;
  const sidearm = inventory.table.rows.find((row) => row.name === "Sidearm").values;
  assert.equal(rifle.InventoryColumns, "5");
  assert.equal(rifle.InventoryRows, "2");
  assert.equal(rifle.MaxWeightLimit, "100");
  assert.equal(rifle.InteractionReach, "250");
  assert.equal(rifle.AttachmentSocket, "hand_r");
  assert.equal(sidearm.InventoryColumns, "2");
  assert.equal(sidearm.InventoryRows, "1");
  assert.equal(sidearm.MaxWeightLimit, "50");
  assert.equal(sidearm.InteractionReach, "125");
  assert.equal(inventory.primary.values.InventoryColumns, "5");
  assert.equal(inventory.blueprint.variables.find((item) => item.name === "InventoryColumns").default, "5");
});

test("create in unreal queues the plan and open in unreal queues the asset path", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-assets-"));
  const handle = await startServer({ dataDir, port: 0 });
  try {
    const info = await (await fetch(`http://127.0.0.1:${handle.port}/api/companion`)).json();
    const unpaired = await (await fetch(`http://127.0.0.1:${handle.port}/api/companion/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: AMMO }),
    })).json();
    assert.equal(unpaired.ok, false);
    assert.equal(unpaired.message, "Not connected to Unreal — open the Architect panel and pair");
    assert.equal(unpaired.queued, false);

    const paired = await (await fetch(`http://127.0.0.1:${info.port}/v1/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: info.code }),
    })).json();
    const created = await (await fetch(`http://127.0.0.1:${handle.port}/api/companion/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: AMMO, folder: "/Game/Architect/Weapons" }),
    })).json();
    assert.equal(created.ok, true);
    assert.equal(created.queued, true);
    assert.equal(created.confirm, false);
    assert.equal(created.folder, "/Game/Architect/Weapons");

    const pending = await (await fetch(`http://127.0.0.1:${info.port}/v1/pending`, {
      headers: { "X-Companion-Token": paired.token },
    })).json();
    assert.equal(pending.command.type, "create-assets");
    assert.equal(pending.command.table.asset, "DT_WeaponAmmoStats");
    assert.equal(pending.command.primary.asset, "DA_WeaponAmmo");
    assert.equal(pending.command.blueprint.asset, "BP_WeaponAmmo");
    assert.equal(pending.command.confirm, false);

    const againPending = await (await fetch(`http://127.0.0.1:${info.port}/v1/pending`, {
      headers: { "X-Companion-Token": paired.token },
    })).json();
    assert.equal(againPending.command.id, pending.command.id);
    const posted = await fetch(`http://127.0.0.1:${info.port}/v1/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Companion-Token": paired.token },
      body: JSON.stringify({
        id: pending.command.id,
        ok: true,
        message: "Created 3 assets in /Game/Architect/Weapons.",
        assets: [
          "/Game/Architect/Weapons/DT_WeaponAmmoStats.DT_WeaponAmmoStats",
          "/Game/Architect/Weapons/DA_WeaponAmmo.DA_WeaponAmmo",
        ],
        conflicts: [],
      }),
    });
    assert.equal(posted.status, 200);
    const seen = await (await fetch(`http://127.0.0.1:${handle.port}/api/companion`)).json();
    assert.equal(seen.result.assets.length, 2);
    assert.match(seen.result.message, /Created 3 assets/);

    const replaced = await (await fetch(`http://127.0.0.1:${handle.port}/api/companion/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ system: AMMO, confirm: true }),
    })).json();
    assert.equal(replaced.confirm, true);
    const queued = await (await fetch(`http://127.0.0.1:${info.port}/v1/pending`, {
      headers: { "X-Companion-Token": paired.token },
    })).json();
    assert.equal(queued.command.confirm, true);
    assert.equal(queued.command.id, replaced.id);
    const blocked = await (await fetch(`http://127.0.0.1:${info.port}/v1/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Companion-Token": paired.token },
      body: JSON.stringify({
        id: queued.command.id,
        ok: false,
        message: "These assets already exist. Confirm in the app before replacing them.",
        assets: [],
        conflicts: ["/Game/Architect/Weapons/DT_WeaponAmmoStats.DT_WeaponAmmoStats"],
      }),
    })).json();
    assert.equal(blocked.ok, true);
    const again = await (await fetch(`http://127.0.0.1:${handle.port}/api/companion`)).json();
    assert.equal(again.result.ok, false);
    assert.equal(again.result.conflicts.length, 1);

    const opened = await (await fetch(`http://127.0.0.1:${handle.port}/api/companion/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset: "/Game/Architect/Weapons/DT_WeaponAmmoStats.DT_WeaponAmmoStats" }),
    })).json();
    assert.equal(opened.ok, true);
    const openCommand = await (await fetch(`http://127.0.0.1:${info.port}/v1/pending`, {
      headers: { "X-Companion-Token": paired.token },
    })).json();
    assert.equal(openCommand.command.type, "open-asset");
    assert.match(openCommand.command.asset, /^\/Game\//);

    const outside = await fetch(`http://127.0.0.1:${handle.port}/api/companion/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ asset: "/Engine/Foo" }),
    });
    assert.equal(outside.status, 400);
    await (await fetch(`http://127.0.0.1:${info.port}/v1/result`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Companion-Token": paired.token },
      body: JSON.stringify({ id: openCommand.command.id, ok: true, message: "Opened.", assets: [], conflicts: [] }),
    })).json();
  } finally {
    await handle.close();
  }
});

test("several companion requests stay queued until each one is answered", async () => {
  const { createCompanion } = require("../companion");
  let now = 1000;
  const link = await createCompanion({ now: () => now, timeoutMs: 50 });
  try {
    const paired = await (await fetch(`http://127.0.0.1:${link.port}/v1/pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: link.code }),
    })).json();
    const headers = { "Content-Type": "application/json", "X-Companion-Token": paired.token };
    const first = link.queue({ type: "create-assets", folder: "/Game/Architect/One" });
    const second = link.queue({ type: "create-assets", folder: "/Game/Architect/Two" });
    const third = link.queue({ type: "open-asset", asset: "/Game/Architect/One/BP_One.BP_One" });
    const take = async () => (await fetch(`http://127.0.0.1:${link.port}/v1/pending`, { headers })).json();
    const ack = async (id, message) => fetch(`http://127.0.0.1:${link.port}/v1/result`, {
      method: "POST",
      headers,
      body: JSON.stringify({ id, ok: true, message, assets: [], conflicts: [] }),
    });
    const one = await take();
    const oneAgain = await take();
    assert.equal(one.command.id, first.id);
    assert.equal(oneAgain.command.id, first.id);
    assert.equal(one.command.folder, "/Game/Architect/One");
    await ack(first.id, "Created one.");
    const two = await take();
    assert.equal(two.command.id, second.id);
    assert.equal(two.command.folder, "/Game/Architect/Two");
    await ack(second.id, "Created two.");
    const open = await take();
    assert.equal(open.command.id, third.id);
    assert.equal(open.command.type, "open-asset");
    now = 5000;
    link.sweep();
    assert.match(link.lastResult.message, /did not answer/);
    const after = await take();
    assert.equal(after.command, null);
  } finally {
    await link.close();
  }
});
