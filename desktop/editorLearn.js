"use strict";

// Teaching payload for the Architect panel. Built from the system the app
// already has. No model call.

const { buildAssetPlan } = require("./realAssets");

function objectPath(folder, asset) {
  return `${folder}/${asset}.${asset}`;
}

function noteOf(note) {
  return {
    one_line: String(note?.one_line || "").slice(0, 220),
    tradeoff: String(note?.tradeoff || "").slice(0, 400),
    common_mistake: String(note?.common_mistake || "").slice(0, 400),
  };
}

function challengesFor(plan) {
  const fields = plan.table.fields || [];
  const numeric = fields.filter((field) => field.type === "int32" || field.type === "float");
  const text = fields.find((field) => field.type === "FString" || field.type === "FName");
  const tablePath = objectPath(plan.folder, plan.table.asset);
  const dataPath = objectPath(plan.folder, plan.primary.asset);
  const blueprintPath = objectPath(plan.folder, plan.blueprint.asset);
  const list = [];
  const weight = numeric.find((field) => /weight/i.test(field.name))
    || numeric.find((field) => /health|magazine|column|damage/i.test(field.name))
    || numeric[0];
  if (weight) {
    const base = Number(weight.default);
    const floor = Number.isFinite(base) ? base : 0;
    list.push({
      id: "row-shotgun",
      title: "Add a Shotgun row",
      prompt: `Add a Shotgun row to ${plan.table.asset} with a higher ${weight.name}.`,
      asset: tablePath,
      hint: `Open ${plan.table.asset}. Add a row named Shotgun and set ${weight.name} above ${floor}.`,
      manual: false,
      check: { kind: "table-row", asset: tablePath, row: "Shotgun", property: weight.name, compare: "gt", than: floor },
    });
  } else {
    list.push({
      id: "row-shotgun",
      title: "Add a Shotgun row",
      prompt: `Add a Shotgun row to ${plan.table.asset}.`,
      asset: tablePath,
      hint: `Open ${plan.table.asset} and add a row named Shotgun.`,
      manual: false,
      check: { kind: "table-row", asset: tablePath, row: "Shotgun" },
    });
  }
  const reach = numeric.find((field) => /reach|distance|range/i.test(field.name));
  if (reach) {
    list.push({
      id: "asset-reach",
      title: `Set ${reach.name}`,
      prompt: `Set ${reach.name} on ${plan.primary.asset} to 300.`,
      asset: dataPath,
      hint: `Open ${plan.primary.asset} and set ${reach.name} to 300.`,
      manual: false,
      check: { kind: "asset-number", asset: dataPath, property: reach.name, equals: 300 },
    });
  } else if (numeric[0] && numeric[0] !== weight) {
    const goal = Math.max(Number(numeric[0].default) + 10, 1);
    list.push({
      id: "asset-number",
      title: `Set ${numeric[0].name}`,
      prompt: `Set ${numeric[0].name} on ${plan.primary.asset} to ${goal}.`,
      asset: dataPath,
      hint: `Open ${plan.primary.asset} and set ${numeric[0].name} to ${goal}.`,
      manual: false,
      check: { kind: "asset-number", asset: dataPath, property: numeric[0].name, equals: goal },
    });
  } else if (text) {
    list.push({
      id: "asset-text",
      title: `Set ${text.name}`,
      prompt: `Set ${text.name} on ${plan.primary.asset} to hand_r.`,
      asset: dataPath,
      hint: `Open ${plan.primary.asset} and set ${text.name} to hand_r.`,
      manual: false,
      check: { kind: "asset-text", asset: dataPath, property: text.name, equals: "hand_r" },
    });
  }
  list.push({
    id: "blueprint-edit",
    title: "Extend the Blueprint",
    prompt: `Add a variable or a function call in ${plan.blueprint.asset}'s event graph.`,
    asset: blueprintPath,
    hint: `Open ${plan.blueprint.asset}. Add a variable, or place a function call on the event graph.`,
    manual: false,
    check: { kind: "blueprint-edit", asset: blueprintPath },
  });
  list.push({
    id: "read-why",
    title: "Read the C++ note",
    prompt: `Read the WHY note on ${plan.types.parent || plan.stem} and decide what does not belong on Tick.`,
    asset: plan.types.parent || plan.stem,
    hint: "This one is not read from an asset. Press I did this after you have read the note.",
    manual: true,
    check: { kind: "manual" },
  });
  return list.slice(0, 4);
}

function buildEditorLearn(system, plan) {
  const assetPlan = plan || buildAssetPlan(system || {});
  const notes = Array.isArray(system?.learning?.why_notes) ? system.learning.why_notes : [];
  const fieldNames = (assetPlan.table.fields || []).map((field) => field.name.toLowerCase());
  const groups = [
    { id: "table", kind: "Data table", title: assetPlan.table.asset, notes: [] },
    { id: "data", kind: "Data asset", title: assetPlan.primary.asset, notes: [] },
    { id: "blueprint", kind: "Blueprint", title: assetPlan.blueprint.asset, notes: [] },
    { id: "cpp", kind: "C++ class", title: assetPlan.types.parent || assetPlan.stem, notes: [] },
  ];
  for (const note of notes) {
    const blob = `${note.one_line || ""} ${note.tradeoff || ""} ${note.common_mistake || ""}`.toLowerCase();
    let id = "blueprint";
    if (note.anchor?.kind === "cpp") id = "cpp";
    else if (fieldNames.some((name) => name && blob.includes(name))) id = "data";
    const group = groups.find((item) => item.id === id);
    const compact = noteOf(note);
    if (compact.one_line) group.notes.push(compact);
  }
  const summary = String(system?.summary || "").trim();
  for (const group of groups) {
    if (group.notes.length) continue;
    group.notes.push({
      one_line: summary || `${group.kind} ${group.title} is part of this system.`,
      tradeoff: "",
      common_mistake: "",
    });
  }
  return {
    systemName: assetPlan.systemName,
    folder: assetPlan.folder,
    groups,
    challenges: challengesFor(assetPlan),
  };
}

function searchGlossary(terms, query) {
  const needle = String(query || "").trim().toLowerCase();
  if (needle.length < 2) return [];
  const list = Array.isArray(terms) ? terms : [];
  const hits = list.filter((term) => {
    const names = [term.term, ...(term.aliases || []), term.summary || "", term.definition || ""];
    return names.some((name) => String(name).toLowerCase().includes(needle));
  }).slice(0, 6);
  return hits.map((term) => ({
    term: term.term,
    summary: term.summary || term.definition || "",
    detail: term.detail || "",
    see: (term.see || []).map((id) => list.find((item) => item.id === id)?.term).filter(Boolean),
  }));
}

module.exports = { buildEditorLearn, searchGlossary };
