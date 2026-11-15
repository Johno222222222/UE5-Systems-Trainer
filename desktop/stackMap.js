"use strict";

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
    kind: "class",
    ...item,
    message: `${item.systems.join(" and ")} both declare ${item.name}.`,
  }));
  return { shared, conflicts };
}

module.exports = { stackMap };
