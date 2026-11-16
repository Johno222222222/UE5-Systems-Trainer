"use strict";

const crypto = require("crypto");
const { isEngineHeader } = require("./generatedIncludes");

function names(header, pattern) {
  return [...String(header || "").matchAll(pattern)].map((match) => match[1]);
}

function readSystem(system) {
  const header = system?.cpp_header || "";
  return {
    name: system?.system_name || "System",
    interfaces: names(header, /\bclass\s+(?:\w+_API\s+)?(I[A-Z]\w*)\b/g),
    classes: names(header, /\bclass\s+(?:\w+_API\s+)?([UA][A-Z]\w*)\b/g),
    attributes: names(header, /UPROPERTY\s*\([^)]*\)[^;{]*?\b(\w+)\s*(?:=|;)/g),
  };
}

function grouped(rows, key) {
  const map = new Map();
  for (const row of rows) {
    for (const name of row[key]) {
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(row.name);
    }
  }
  const out = [];
  for (const [name, owners] of map) {
    const systems = [...new Set(owners)];
    if (systems.length >= 2) out.push({ name, systems });
  }
  return out;
}

// Shared interfaces and attributes, plus class-name collisions, across the
// systems being stacked. The model also lists shared_attributes; the UI shows both.
function stackMap(systems) {
  const rows = (systems || []).filter((system) => system && typeof system === "object").map(readSystem);
  const shared = [
    ...grouped(rows, "interfaces").map((item) => ({ kind: "interface", ...item })),
    ...grouped(rows, "attributes").map((item) => ({ kind: "attribute", ...item })),
  ];
  const conflicts = grouped(rows, "classes").map((item) => ({
    kind: /Component$/.test(item.name) ? "component" : "class",
    ...item,
    message: `${item.systems.join(" and ")} both declare ${item.name}.`,
  }));
  return { shared, conflicts };
}

function stackIdent(name) {
  const parts = String(name || "").split(/[^A-Za-z0-9]+/).filter(Boolean);
  const joined = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
  const clean = joined.replace(/^[0-9]+/, "");
  return clean || "Stack";
}

function textOf(system) {
  return `${system?.cpp_header || ""}\n${system?.cpp_source || ""}`;
}

function actionsIn(text) {
  return [...new Set([...String(text).matchAll(/\b(IA_[A-Za-z0-9_]+)\b/g)].map((match) => match[1]))];
}

function replicatedIn(text) {
  const found = [];
  for (const match of String(text).matchAll(/UPROPERTY\s*\(([^)]*)\)[^;{]*?\b([A-Za-z_]\w*)\s*(?:=|;)/g)) {
    if (/Replicated/i.test(match[1])) found.push(match[2]);
  }
  return found;
}

function tagsIn(text) {
  const found = new Set();
  for (const match of String(text).matchAll(/Gameplay tag:\s*"([^"]+)"/g)) found.add(match[1]);
  for (const match of String(text).matchAll(/RequestGameplayTag\(\s*(?:FName\()?TEXT\(\s*"([^"]+)"/g)) found.add(match[1]);
  return [...found];
}

function blocksOf(header) {
  return String(header || "")
    .split(/(?=^\s*(?:UCLASS|USTRUCT|UENUM|UINTERFACE)\b)/m)
    .map((part) => part.trim())
    .filter((part) => /^(UCLASS|USTRUCT|UENUM|UINTERFACE)\b/.test(part));
}

function declaredNames(block) {
  return [...String(block).matchAll(/\bclass\s+(?:\w+_API\s+)?([UAI][A-Za-z0-9_]+)/g)].map((match) => match[1]);
}

function blockKey(block) {
  return String(block).replace(/\b[A-Za-z0-9_]+_API\b/g, "API").replace(/\s+/g, " ").trim();
}

function blockRank(block) {
  if (block.startsWith("UCLASS")) return 0;
  if (block.startsWith("USTRUCT")) return 1;
  if (block.startsWith("UENUM")) return 2;
  return 3;
}

function includesOf(text) {
  return [...String(text || "").matchAll(/^\s*#include\s+"([^"]+)"/gm)].map((match) => match[1]);
}

function stripIncludes(text) {
  return String(text || "").replace(/^\s*#include\s+"[^"]+"\s*$/gm, "").replace(/^\s*#pragma\s+once\s*$/gm, "").trim();
}

function repairFloats(text) {
  return String(text).replace(/(?<![\d.])(\d+)f\b/g, "$1.f");
}

function uniqueName(base, taken) {
  let name = base;
  let index = 2;
  while (taken.has(name)) {
    name = `${base}${index}`;
    index += 1;
  }
  taken.add(name);
  return name;
}

function dependenciesOf(block, systemName) {
  const out = [];
  for (const match of String(block).matchAll(/\bclass\s+(?:\w+_API\s+)?([UAI][A-Za-z0-9_]+)\s*(?:final\s*)?:\s*public\s+([A-Za-z0-9_]+)/g)) {
    out.push({ name: match[1], base: match[2], system: systemName });
  }
  return out;
}

function ownersOf(rows) {
  const map = new Map();
  for (const row of rows) {
    for (const name of row.values) {
      if (!map.has(name)) map.set(name, []);
      map.get(name).push(row.system);
    }
  }
  return map;
}

// Merge several systems into one plugin module. Identical interfaces and
// components are kept once. A class that differs is renamed so the C++ still
// compiles. Input actions and replicated property names are reported with a fix.
function composeStack(systems, { name } = {}) {
  const list = (systems || []).filter((system) => system && typeof system === "object").slice(0, 4);
  if (list.length < 2) {
    const err = new Error("Tick at least two systems to stack.");
    err.statusCode = 400;
    throw err;
  }
  const display = String(name || list.map((system) => system.system_name || "System").join(" + ")).trim() || "Stack";
  const base = stackIdent(display);
  const kept = [];
  const keptKeys = new Set();
  const taken = new Set();
  const sources = [];
  const engineIncludes = [];
  const renames = [];
  const deduped = [];

  const rememberInclude = (include) => {
    if (!include || include.endsWith(".generated.h")) return;
    if (!isEngineHeader(include)) return;
    if (!engineIncludes.includes(include)) engineIncludes.push(include);
  };

  for (const system of list) {
    for (const include of [...includesOf(system.cpp_header), ...includesOf(system.cpp_source)]) rememberInclude(include);
    let source = stripIncludes(system.cpp_source);
    for (const block of blocksOf(system.cpp_header)) {
      let text = block;
      const originalNames = declaredNames(text);
      const clash = originalNames.filter((item) => taken.has(item));
      if (clash.length && keptKeys.has(blockKey(text))) {
        const kind = text.startsWith("UINTERFACE") ? "interface" : (/Component$/.test(clash[0]) ? "component" : "class");
        for (const item of clash) deduped.push({ name: item, kind, system: system.system_name || "System" });
        continue;
      }
      if (clash.length) {
        const suffix = stackIdent(system.system_name || "Copy");
        for (const item of clash) {
          const next = uniqueName(`${item}_${suffix}`, taken);
          const pattern = new RegExp(`\\b${item}\\b`, "g");
          text = text.replace(pattern, next);
          source = source.replace(pattern, next);
          renames.push({ from: item, to: next, system: system.system_name || "System" });
        }
      }
      for (const item of declaredNames(text)) taken.add(item);
      keptKeys.add(blockKey(text));
      kept.push({ text, system: system.system_name || "System" });
    }
    if (source) sources.push(repairFloats(source));
  }

  if (!engineIncludes.includes("CoreMinimal.h")) engineIncludes.unshift("CoreMinimal.h");
  kept.sort((a, b) => blockRank(a.text) - blockRank(b.text));
  const header = repairFloats(`#pragma once
${engineIncludes.map((include) => `#include "${include}"`).join("\n")}
#include "${base}.generated.h"

${kept.map((item) => item.text).join("\n\n")}
`);
  const source = repairFloats(`#include "${base}.h"
${sources.join("\n\n")}
`);

  const map = stackMap(list);
  const dedupedNames = new Set(deduped.map((item) => item.name));
  const keptConflicts = [];
  for (const conflict of map.conflicts) {
    if (!dedupedNames.has(conflict.name)) {
      keptConflicts.push(conflict);
      continue;
    }
    if (!map.shared.some((item) => item.name === conflict.name)) {
      const kind = deduped.find((item) => item.name === conflict.name)?.kind || conflict.kind;
      map.shared.push({ kind, name: conflict.name, systems: conflict.systems });
    }
  }
  map.conflicts = keptConflicts;
  const renameByName = new Map(renames.map((item) => [item.from, item]));
  for (const conflict of map.conflicts) {
    const applied = renameByName.get(conflict.name);
    conflict.fix = applied
      ? `Renamed the copy in ${applied.system} to ${applied.to} so both can compile. Prefer one component and delete the extra.`
      : `Keep one ${conflict.name} and rename the other.`;
  }

  const actionRows = list.map((system) => ({ system: system.system_name || "System", values: actionsIn(textOf(system)) }));
  for (const [action, owners] of ownersOf(actionRows)) {
    const systemsNamed = [...new Set(owners)];
    if (systemsNamed.length < 2) continue;
    map.conflicts.push({
      kind: "input",
      name: action,
      systems: systemsNamed,
      message: `${systemsNamed.join(" and ")} both use ${action}.`,
      fix: `Share ${action}. Point both systems at one Enhanced Input action.`,
    });
  }

  const replicatedRows = list.map((system) => ({ system: system.system_name || "System", values: replicatedIn(textOf(system)) }));
  for (const [property, owners] of ownersOf(replicatedRows)) {
    const systemsNamed = [...new Set(owners)];
    if (systemsNamed.length < 2) continue;
    map.conflicts.push({
      kind: "replicated",
      name: property,
      systems: systemsNamed,
      message: `${systemsNamed.join(" and ")} both replicate ${property}.`,
      fix: `Replicate ${property} on one component, or rename the other property.`,
    });
  }

  const tagRows = list.map((system) => ({ system: system.system_name || "System", values: tagsIn(textOf(system)) }));
  for (const [tag, owners] of ownersOf(tagRows)) {
    const systemsNamed = [...new Set(owners)];
    if (systemsNamed.length < 2) continue;
    if (!map.shared.some((item) => item.kind === "tag" && item.name === tag)) {
      map.shared.push({ kind: "tag", name: tag, systems: systemsNamed });
    }
  }

  const dependencies = kept.flatMap((item) => dependenciesOf(item.text, item.system));
  const folder = `/Game/Architect/${base}`;
  map.dependencies = dependencies;
  map.fixes = map.conflicts.map((item) => item.fix).filter(Boolean);
  map.folder = folder;
  map.renames = renames;

  const system = {
    id: crypto.randomUUID(),
    system_name: display,
    summary: `Stacked ${list.map((item) => item.system_name || "System").join(", ")}. Shared interfaces stay once. Conflicts are listed before Create in Unreal.`,
    when_to_use: "Use a stack when several systems should ship as one component set, with one interface and one Gameplay Tag list.",
    common_mistakes: "A common mistake is to keep two replicated copies of the same property, or to bind the same Enhanced Input action twice.",
    context_glossary: ["interface", "replication", "enhanced-input", "gameplay-tag"],
    tunable_parameters: [],
    modules: list.map((item) => ({
      name: item.system_name || "System",
      included: true,
      description: item.summary || item.system_name || "Stacked system",
    })),
    blueprint_pseudocode: list.map((item) => `Function ${item.system_name || "System"}\n  Keep this component on the pawn.\nWHY: Stacking shares the interface and does not make a new character class.`).join("\n\n"),
    cpp_header: header,
    cpp_source: source,
    setup_guide: [{
      step: 1,
      title: "Create the stack in Unreal",
      detail: `Create in Unreal writes the data table, data asset, and Blueprint under ${folder}.`,
      why: "One request builds the whole stack. Existing assets stay until you confirm overwrite.",
    }],
    node_graph_nodes: dependencies.map((item, index) => ({
      id: `dep-${index}`,
      label: item.name,
      node_type: "class",
      x: 40 + (index % 4) * 200,
      y: 80 + Math.floor(index / 4) * 140,
      inputs: item.base ? [item.base] : [],
      outputs: ["uses"],
    })),
    node_graph_edges: [],
    network_notes: "Replicated properties that share a name are listed as conflicts. The server still owns the copy you keep.",
    applied_changes: renames.map((item) => `Renamed ${item.from} to ${item.to}.`),
    shared_attributes: map.shared.filter((item) => item.kind === "attribute" || item.kind === "tag").map((item) => item.name),
    confidence: "high",
    alternative: "",
    stacked_from: list.map((item) => item.system_name || "System"),
    stack_map: map,
    generated_at: new Date().toISOString(),
  };

  return { system, folder, stack_map: map };
}

module.exports = { stackMap, composeStack, stackIdent };
