"use strict";

// Deterministic cleanup after a synthesis, before the result is shown.
// These are the misses that show up on most first generations.

function ensureInclude(source, headerName) {
  const text = String(source || "");
  if (text.includes(`"${headerName}"`) || text.includes(`<${headerName}>`)) return text;
  const line = `#include "${headerName}"`;
  const first = text.match(/^#include\s+.+$/m);
  if (!first) return `${line}\n${text}`;
  const at = first.index + first[0].length;
  return `${text.slice(0, at)}\n${line}${text.slice(at)}`;
}

function classBefore(header, index) {
  const matches = [...String(header).matchAll(/\bclass\s+(?:\w+_API\s+)?([UAFIE][A-Z]\w*)/g)];
  let name = "";
  for (const item of matches) {
    if (item.index < index) name = item[1];
  }
  return name;
}

function stripDefaults(args) {
  return String(args || "")
    .split(",")
    .map((part) => part.replace(/=.*$/, "").trim())
    .filter(Boolean)
    .join(", ");
}

function nativeEvents(header) {
  const out = [];
  const re = /UFUNCTION\s*\(((?:[^()]|\([^()]*\))*)\)\s*([\w:<>,\s*&]+?)\s+(\w+)\s*\(([^;{}]*)\)/g;
  let match;
  while ((match = re.exec(header))) {
    if (!/BlueprintNativeEvent/.test(match[1])) continue;
    if (/BlueprintImplementableEvent/.test(match[1]) && !/BlueprintNativeEvent/.test(match[1])) continue;
    out.push({
      index: match.index,
      ret: match[2].trim(),
      name: match[3],
      args: stripDefaults(match[4]),
    });
  }
  return out;
}

function repairCommonCpp(system) {
  if (!system || typeof system !== "object") return system;
  let header = String(system.cpp_header || "");
  let source = String(system.cpp_source || "");
  const notes = [];
  const both = `${header}\n${source}`;
  if (/\bGetWorld\s*\(/.test(both) && !/Engine\/World\.h/.test(both)) {
    source = ensureInclude(source, "Engine/World.h");
    notes.push("Added #include \"Engine/World.h\".");
  }
  for (const event of nativeEvents(header)) {
    const impl = `${event.name}_Implementation`;
    if (new RegExp(`\\b${impl}\\s*\\(`).test(source)) continue;
    const cls = classBefore(header, event.index);
    if (!cls) continue;
    const ret = event.ret || "void";
    const fallback = ret === "void" || ret === "void " ? "" : `\n\treturn ${ret.includes("*") ? "nullptr" : "{}"};`;
    source += `\n${ret} ${cls}::${impl}(${event.args})\n{${fallback}\n}\n`;
    notes.push(`Added ${cls}::${impl}().`);
  }
  if (!notes.length) return system;
  return { ...system, cpp_header: header, cpp_source: source, repair_notes: notes };
}

module.exports = { repairCommonCpp, ensureInclude };
