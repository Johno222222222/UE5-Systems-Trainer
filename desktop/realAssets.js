"use strict";

// Plans the Unreal assets for one system. The editor plugin creates them.
// The C++ types are written into the generated plugin so a compile can see them.

function pluginNames() {
  return require("./pluginFiles");
}

function ident(value) {
  const parts = String(value || "").split(/[^A-Za-z0-9]+/).filter(Boolean);
  const joined = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
  const clean = joined.replace(/^[0-9]+/, "");
  return clean || "Value";
}

function cppType(type) {
  const name = String(type || "").replace(/\s+/g, "").toLowerCase();
  if (name === "bool" || name === "boolean") return "bool";
  if (name === "float" || name === "double") return "float";
  if (name === "string" || name === "fstring") return "FString";
  if (name === "name" || name === "fname") return "FName";
  if (name === "int" || name === "int32" || name === "integer") return "int32";
  return "";
}

function cppLiteral(type, value) {
  const raw = String(value ?? "").trim();
  if (type === "bool") return /^(1|true)$/i.test(raw) ? "true" : "false";
  if (type === "float") {
    const number = raw.replace(/f$/i, "");
    if (!number || number === "0" || number === "0.0") return "0.f";
    return number.includes(".") ? `${number}f` : `${number}.f`;
  }
  if (type === "int32") {
    const number = Number.parseInt(raw, 10);
    return Number.isFinite(number) ? String(number) : "0";
  }
  const text = raw.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  return `TEXT("${text}")`;
}

function cleanCppValue(raw) {
  let text = String(raw ?? "").trim();
  const wrapped = text.match(/^TEXT\s*\(\s*"([\s\S]*)"\s*\)$/);
  if (wrapped) text = wrapped[1];
  else if (text.startsWith("\"") && text.endsWith("\"")) text = text.slice(1, -1);
  text = text.replace(/f$/i, "");
  if (text.endsWith(".")) text = text.slice(0, -1);
  return text.trim();
}

function jsonValue(type, value) {
  const raw = cleanCppValue(value);
  if (type === "bool") return /^(1|true)$/i.test(raw) ? "true" : "false";
  if (type === "float") {
    if (!raw || raw === "0" || raw === "0.0") return "0";
    return raw;
  }
  if (type === "int32") {
    const number = Number.parseInt(raw, 10);
    return Number.isFinite(number) ? String(number) : "0";
  }
  if (type === "FName" && !raw) return "None";
  return raw;
}

function inferType(raw) {
  const text = cleanCppValue(raw);
  if (/^(true|false)$/i.test(text)) return "bool";
  if (/^-?\d+\.\d+$/.test(text)) return "float";
  if (/^-?\d+$/.test(text)) return "int32";
  return "FString";
}

function blankDefault(type, value) {
  if (value == null || value === "") return true;
  if ((type === "int32" || type === "float") && Number(value) === 0) return true;
  if ((type === "FString" || type === "FName") && (value === "Default" || value === "None")) return true;
  return false;
}

function headerFields(header) {
  const found = [];
  const pattern = /UPROPERTY\s*\((?:[^;]|\)\s)*?\)\s*(int32|int|float|bool|FString|FName)\s+([A-Za-z_]\w*)\s*(?:=\s*([^;]+))?/g;
  let match = pattern.exec(String(header || ""));
  while (match) {
    const type = cppType(match[1]);
    if (type) found.push({ name: ident(match[2]), type, default: jsonValue(type, match[3] || "") });
    match = pattern.exec(String(header || ""));
  }
  return found;
}

function constructorValues(source, className) {
  const found = [];
  if (!className) return found;
  const text = String(source || "");
  const start = text.search(new RegExp(`\\b${className}::${className}\\s*\\(`));
  if (start < 0) return found;
  const after = text.slice(start);
  let depth = 0;
  let i = after.indexOf("(");
  for (; i < after.length; i += 1) {
    if (after[i] === "(") depth += 1;
    else if (after[i] === ")") {
      depth -= 1;
      if (depth === 0) { i += 1; break; }
    }
  }
  const brace = after.indexOf("{", i);
  if (brace < 0) return found;
  const init = after.slice(i, brace);
  const initList = init.includes(":") ? init.slice(init.indexOf(":") + 1) : "";
  let nest = 0;
  let end = brace;
  for (; end < after.length; end += 1) {
    if (after[end] === "{") nest += 1;
    else if (after[end] === "}") {
      nest -= 1;
      if (nest === 0) break;
    }
  }
  const body = after.slice(brace + 1, end);
  for (const match of initList.matchAll(/(\w+)\s*\(\s*([^)]+?)\s*\)/g)) found.push([match[1], cleanCppValue(match[2])]);
  for (const match of body.matchAll(/(?:this\s*->\s*)?(\w+)\s*=\s*([^;]+);/g)) {
    if (["if", "for", "while", "switch", "return"].includes(match[1])) continue;
    found.push([match[1], cleanCppValue(match[2])]);
  }
  return found;
}

function fieldsFrom(system) {
  const ranked = new Map();
  const put = (field, rank) => {
    if (!field?.name || !field.type) return;
    const prev = ranked.get(field.name);
    if (!prev || rank > prev.rank) ranked.set(field.name, { ...field, rank });
  };
  for (const item of Array.isArray(system?.variables) ? system.variables : []) {
    const type = cppType(item?.type);
    if (!type) continue;
    put({ name: ident(item.name), type, default: jsonValue(type, item.default) }, 1);
  }
  for (const field of headerFields(system?.cpp_header)) put(field, 2);
  const owner = String(system?.cpp_header || "").match(/class\s+(?:\w+_API\s+)?([UAF][A-Za-z0-9_]+)/);
  for (const [name, raw] of constructorValues(system?.cpp_source, owner ? owner[1] : "")) {
    const known = ranked.get(ident(name));
    const type = known?.type || inferType(raw);
    put({ name: ident(name), type, default: jsonValue(type, raw) }, 3);
  }
  if (!ranked.size) {
    for (const item of Array.isArray(system?.tunable_parameters) ? system.tunable_parameters : []) {
      const numeric = typeof item?.value === "number";
      const type = numeric && !Number.isInteger(item.value) ? "float" : (numeric ? "int32" : "");
      if (!type) continue;
      put({ name: ident(item.key || item.label), type, default: jsonValue(type, item.value) }, 1);
    }
  }
  const fields = [...ranked.values()].map(({ name, type, default: value }) => ({
    name,
    type,
    default: blankDefault(type, value) && type !== "int32" && type !== "float" && type !== "bool" ? value : value,
  }));
  return fields.length ? fields : [{ name: "Label", type: "FString", default: "" }];
}

function generatedClass(header) {
  const match = String(header || "").match(/class\s+(?:\w+_API\s+)?([UAF][A-Za-z0-9_]+)\s*(?:final\s*)?:\s*public\s+([UAF][A-Za-z0-9_]+)/);
  if (!match) return { name: "AActor", parent: "AActor", kind: "Actor", generated: false };
  const parent = match[2];
  let kind = "Object";
  if (/Character/.test(parent)) kind = "Character";
  else if (/Pawn/.test(parent)) kind = "Pawn";
  else if (/Component/.test(parent)) kind = "Component";
  else if (/^A/.test(parent) || /Actor/.test(parent)) kind = "Actor";
  return { name: match[1], parent, kind, generated: true };
}

function assetStem(system) {
  const { baseName, moduleName } = pluginNames();
  return moduleName(system).replace(/Kit$/, "") || baseName(system) || "System";
}

function folderFor(system, requested) {
  const fromName = ident(system?.system_name || "") || assetStem(system);
  const fallback = `/Game/Architect/${fromName}`;
  const raw = String(requested || "").trim().replace(/\/+$/, "");
  if (!raw) return fallback;
  if (!raw.startsWith("/Game/") || raw.includes("..") || raw.includes("\\") || raw.includes(" ")) return fallback;
  return raw;
}

function halved(field) {
  if (field.type === "int32") {
    const number = Number.parseInt(field.default, 10);
    if (!Number.isFinite(number) || number <= 0) return "0";
    return String(Math.max(1, Math.floor(number / 2)));
  }
  if (field.type === "float") {
    const number = Number.parseFloat(field.default);
    if (!Number.isFinite(number)) return "0";
    return String(number / 2);
  }
  return field.default;
}

function starterRows(system, fields) {
  const blob = `${system?.system_name || ""} ${fields.map((field) => field.name).join(" ")}`;
  const ammo = /ammo|weapon|magazine|reserve|damage/i.test(blob);
  const values = (pick) => Object.fromEntries(fields.map((field) => [field.name, pick(field)]));
  if (!ammo) return [{ name: "Default", values: values((field) => field.default) }];
  return [
    { name: "Rifle", values: values((field) => field.default) },
    { name: "Sidearm", values: values(halved) },
  ];
}

function rowHeader(module, stem, fields) {
  const api = `${String(module).toUpperCase()}_API`;
  const lines = fields.map((field) => `\tUPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Architect")\n\t${field.type} ${field.name} = ${cppLiteral(field.type, field.default)};`);
  return `#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "${stem}StatsRow.generated.h"

USTRUCT(BlueprintType)
struct ${api} F${stem}StatsRow : public FTableRowBase
{
	GENERATED_BODY()

${lines.join("\n\n")}
};
`;
}

function dataHeader(module, stem, fields) {
  const api = `${String(module).toUpperCase()}_API`;
  const lines = fields.map((field) => `\tUPROPERTY(EditAnywhere, BlueprintReadOnly, Category="Architect")\n\t${field.type} ${field.name} = ${cppLiteral(field.type, field.default)};`);
  return `#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "${stem}Data.generated.h"

UCLASS(BlueprintType)
class ${api} U${stem}Data : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
${lines.join("\n\n")}

	virtual FPrimaryAssetId GetPrimaryAssetId() const override;
};
`;
}

function dataSource(stem) {
  return `#include "${stem}Data.h"

FPrimaryAssetId U${stem}Data::GetPrimaryAssetId() const
{
	return FPrimaryAssetId(TEXT("${stem}Data"), GetFName());
}
`;
}

function assetSources(system) {
  const { moduleName } = pluginNames();
  const module = moduleName(system);
  const stem = assetStem(system);
  const fields = fieldsFrom(system);
  return {
    [`Public/${stem}StatsRow.h`]: rowHeader(module, stem, fields),
    [`Public/${stem}Data.h`]: dataHeader(module, stem, fields),
    [`Private/${stem}Data.cpp`]: dataSource(stem),
  };
}

function buildAssetPlan(system, { folder, confirm = false } = {}) {
  const { moduleName } = pluginNames();
  const module = moduleName(system);
  const stem = assetStem(system);
  const owner = generatedClass(system?.cpp_header);
  const fields = fieldsFrom(system);
  const destination = folderFor(system, folder);
  const row = `F${stem}StatsRow`;
  const data = `U${stem}Data`;
  const parent = owner.generated ? owner.name : "";
  const needed = [row, data, parent].filter(Boolean);
  return {
    type: "create-assets",
    confirm: confirm === true,
    folder: destination,
    systemName: String(system?.system_name || stem),
    module,
    stem,
    types: { row, data, parent, kind: owner.kind },
    missingMessage: `Send to Unreal and compile first. The editor does not have these types yet: ${needed.join(", ")}.`,
    table: {
      asset: `DT_${stem}Stats`,
      struct: row,
      fields,
      rows: starterRows(system, fields),
    },
    primary: {
      asset: `DA_${stem}`,
      className: data,
      values: Object.fromEntries(fields.map((field) => [field.name, field.default])),
    },
    blueprint: {
      asset: `BP_${stem}`,
      parent,
      kind: owner.kind,
      variables: fields,
      comment: `Build ${String(system?.system_name || stem)} on this Blueprint. The C++ parent owns the rules. Variables: ${fields.map((field) => `${field.name} (${field.type}) = ${field.default}`).join(", ")}. This stub does not build the node graph.`,
    },
  };
}

module.exports = { buildAssetPlan, assetSources, folderFor, fieldsFrom, ident };
