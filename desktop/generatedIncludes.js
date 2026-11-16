"use strict";

// Quoted includes in a generated plugin must be a header this export writes
// or a public engine header that exists in UE 5.8. .generated.h is produced
// by Unreal Header Tool for a header we do write.

const ENGINE_EXACT = new Set([
  "CoreMinimal.h",
  "Modules/ModuleManager.h",
  "TimerManager.h",
  "CollisionQueryParams.h",
  "DrawDebugHelpers.h",
  "Blueprint/UserWidget.h",
  "EnhancedInputComponent.h",
  "EnhancedInputSubsystems.h",
  "InputAction.h",
  "InputMappingContext.h",
  "AbilitySystemComponent.h",
  "NiagaraFunctionLibrary.h",
  "NavigationSystem.h",
]);

// These look like engine paths but are not public headers in UE 5.8.
const ABSENT_IN_UE58 = new Set([
  "Engine/CollisionQueryParams.h",
]);

const ENGINE_PREFIXES = [
  "Engine/",
  "GameFramework/",
  "Components/",
  "UObject/",
  "Net/",
  "Kismet/",
  "Animation/",
  "Camera/",
  "Misc/",
  "HAL/",
  "Math/",
  "Containers/",
  "Templates/",
  "Logging/",
  "Curves/",
];

const SYMBOL_HEADERS = [
  [/\bFHitResult\b/, "Engine/HitResult.h"],
  [/\bFCollisionQueryParams\b/, "CollisionQueryParams.h"],
  [/\bFTimerHandle\b|\bGetTimerManager\s*\(/, "TimerManager.h"],
  [/\bAPawn\b/, "GameFramework/Pawn.h"],
  [/\bGetWorld\s*\(/, "Engine/World.h"],
  [/\bUDamageType\b/, "Engine/DamageEvents.h"],
  [/\bUPrimitiveComponent\b/, "Components/PrimitiveComponent.h"],
  [/\bDOREPLIFETIME\b/, "Net/UnrealNetwork.h"],
  [/\bUUserWidget\b/, "Blueprint/UserWidget.h"],
  [/\bUEnhancedInputComponent\b/, "EnhancedInputComponent.h"],
];

function quotedIncludes(text) {
  return [...String(text || "").matchAll(/#include\s+"([^"]+)"/g)].map((match) => match[1]);
}

function isEngineHeader(header) {
  if (ABSENT_IN_UE58.has(header)) return false;
  if (ENGINE_EXACT.has(header)) return true;
  return ENGINE_PREFIXES.some((prefix) => header.startsWith(prefix));
}

function isGeneratedHeader(header) {
  return header.endsWith(".generated.h") && !header.includes("/");
}

function ensureInclude(text, headerName) {
  const source = String(text || "");
  if (source.includes(`"${headerName}"`) || source.includes(`<${headerName}>`)) return source;
  const line = `#include "${headerName}"`;
  const generated = source.match(/#include\s+"[^"]+\.generated\.h"/);
  if (generated) return `${source.slice(0, generated.index)}${line}\n${source.slice(generated.index)}`;
  const first = source.match(/^#include\s+.+$/m);
  if (!first) return `${line}\n${source}`;
  const at = first.index + first[0].length;
  return `${source.slice(0, at)}\n${line}${source.slice(at)}`;
}

function ensureEngineIncludes(header, source) {
  let cpp = String(source || "");
  const both = () => `${header}\n${cpp}`;
  for (const [pattern, include] of SYMBOL_HEADERS) {
    if (pattern.test(both()) && !both().includes(include)) cpp = ensureInclude(cpp, include);
  }
  return cpp;
}

function retargetApi(header, macro) {
  let out = String(header || "");
  out = out.replace(/\b[A-Z0-9_]+_API\b/g, macro);
  out = out.replace(/((?:UCLASS|USTRUCT|UINTERFACE)\((?:[^()]|\([^()]*\))*\)\s*(?:class|struct)\s+)(?![A-Z0-9_]+_API\b)(?=[UAFIE][A-Z]\w*\s*(?::|\{))/g, `$1${macro} `);
  return out;
}

function interfaceNames(code, mainBase) {
  const names = new Set();
  const text = String(code || "");
  for (const match of text.matchAll(/\bI([A-Z]\w*)::Execute_/g)) names.add(match[1]);
  for (const match of text.matchAll(/\bImplementsInterface\s*\(\s*U([A-Z]\w*)::StaticClass\s*\(/g)) names.add(match[1]);
  for (const header of quotedIncludes(text)) {
    if (header.includes("/") || isGeneratedHeader(header) || isEngineHeader(header)) continue;
    const name = header.replace(/\.h$/, "");
    if (name === mainBase) continue;
    if (new RegExp(`\\b[UI]${name}\\b`).test(text)) names.add(name);
  }
  names.delete(mainBase);
  return [...names].filter((name) => !new RegExp(`\\bclass\\s+(?:\\w+_API\\s+)?[UI]${name}\\b`).test(text));
}

function methodsFor(name, code) {
  const found = [];
  const seen = new Set();
  const re = new RegExp(`\\bI${name}::Execute_(\\w+)\\s*\\(([^)]*)\\)`, "g");
  let match = re.exec(code);
  while (match) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      const args = match[2].split(",").map((part) => part.trim()).filter(Boolean).slice(1);
      const params = args.map((_, index) => (index === 0 ? "AActor* User" : `AActor* Arg${index + 1}`)).join(", ");
      found.push({ name: match[1], params });
    }
    match = re.exec(code);
  }
  if (!found.length) found.push({ name: "Interact", params: "AActor* User" });
  return found;
}

function interfaceHeader(module, name, code) {
  const api = `${String(module || "GAME").toUpperCase()}_API`;
  const methods = methodsFor(name, code).map((method) => [
    "\tUFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category=\"Interact\")",
    `\tvoid ${method.name}(${method.params});`,
  ].join("\n")).join("\n\n");
  return `#pragma once

#include "CoreMinimal.h"
#include "UObject/Interface.h"
#include "GameFramework/Actor.h"
#include "${name}.generated.h"

UINTERFACE(BlueprintType)
class ${api} U${name} : public UInterface
{
	GENERATED_BODY()
};

class ${api} I${name}
{
	GENERATED_BODY()
public:
${methods}
};
`;
}

function preparePluginSources(module, base, header, source) {
  const api = `${String(module || "GAME").toUpperCase()}_API`;
  let nextHeader = retargetApi(header, api);
  let nextSource = ensureEngineIncludes(nextHeader, source);
  const extras = {};
  const code = () => `${nextHeader}\n${nextSource}\n${Object.values(extras).join("\n")}`;
  for (const name of interfaceNames(code(), base)) {
    const include = `${name}.h`;
    if (extras[include]) continue;
    extras[include] = interfaceHeader(module, name, code());
    if (!code().includes(`"${include}"`)) nextSource = ensureInclude(nextSource, include);
  }
  for (const include of quotedIncludes(code())) {
    if (include.includes("/") || isGeneratedHeader(include) || isEngineHeader(include)) continue;
    const includeBase = include.replace(/\.h$/, "");
    if (includeBase === base || extras[include]) continue;
    if (new RegExp(`\\bclass\\s+(?:\\w+_API\\s+)?[UAFIE]${includeBase}\\b`).test(nextHeader)) continue;
    extras[include] = `#pragma once\n`;
  }
  nextSource = ownHeaderFirst(nextSource, base);
  return { header: nextHeader, source: nextSource, extras };
}

function ownHeaderFirst(source, base) {
  const own = `#include "${base}.h"`;
  const lines = String(source || "").split("\n");
  const index = lines.findIndex((line) => line.trim() === own);
  if (index < 0) return String(source || "");
  if (index === 0) return lines.join("\n");
  const [line] = lines.splice(index, 1);
  lines.unshift(line);
  return lines.join("\n");
}

function unresolvedIncludes(files) {
  const written = new Set();
  for (const rel of Object.keys(files)) {
    const base = rel.split("/").pop();
    if (base.endsWith(".h")) written.add(base);
  }
  const missing = [];
  for (const [rel, body] of Object.entries(files)) {
    if (!rel.endsWith(".h") && !rel.endsWith(".cpp")) continue;
    for (const include of quotedIncludes(body)) {
      if (isEngineHeader(include)) continue;
      if (isGeneratedHeader(include)) {
        const owner = `${include.replace(/\.generated\.h$/, "")}.h`;
        if (!written.has(owner)) missing.push({ file: rel, include });
        continue;
      }
      const base = include.split("/").pop();
      if (!written.has(base)) missing.push({ file: rel, include });
    }
  }
  return missing;
}

module.exports = {
  ENGINE_EXACT,
  ENGINE_PREFIXES,
  ABSENT_IN_UE58,
  quotedIncludes,
  isEngineHeader,
  preparePluginSources,
  unresolvedIncludes,
  interfaceHeader,
};
