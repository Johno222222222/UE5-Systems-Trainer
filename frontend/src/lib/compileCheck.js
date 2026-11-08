import { baseName, headerClasses } from "./zipExport";

// Blanks comments and string contents but keeps offsets and line numbers intact
function strip(code) {
  const noBlock = code.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  return noBlock.split("\n").map((l) =>
    l.replace(/"(?:\\.|[^"\\])*"/g, (m) => `"${" ".repeat(m.length - 2)}"`)
      .replace(/'(?:\\.|[^'\\])'/g, (m) => `'${" ".repeat(m.length - 2)}'`)
      .replace(/\/\/.*$/, (m) => " ".repeat(m.length))
  ).join("\n");
}

const lineOf = (text, idx) => text.slice(0, idx).split("\n").length;
const count = (s, re) => (s.match(re) || []).length;

// [symbol used in the .cpp, headers that provide it]
const INCLUDE_HINTS = [
  [/\bUGameplayStatics::/, ["Kismet/GameplayStatics.h"]],
  [/\bUKismetMathLibrary::/, ["Kismet/KismetMathLibrary.h"]],
  [/\bUKismetSystemLibrary::/, ["Kismet/KismetSystemLibrary.h"]],
  [/\bDrawDebug(?:Line|Sphere|Box|String|Point|Capsule|Arrow)\s*\(/, ["DrawDebugHelpers.h"]],
  [/\bDOREPLIFETIME/, ["Net/UnrealNetwork.h"]],
  [/\bGetWorld\(\)\s*->/, ["Engine/World.h"]],
  [/\bGetTimerManager\(\)/, ["TimerManager.h", "Engine/World.h"]],
  [/\bUNiagaraFunctionLibrary::/, ["NiagaraFunctionLibrary.h"]],
  [/\bUEnhancedInputComponent\b/, ["EnhancedInputComponent.h"]],
  [/\bUEnhancedInputLocalPlayerSubsystem\b/, ["EnhancedInputSubsystems.h"]],
  [/\bUCharacterMovementComponent\b/, ["GameFramework/CharacterMovementComponent.h"]],
  [/\bACharacter\b/, ["GameFramework/Character.h"]],
  [/\bAPlayerController\b/, ["GameFramework/PlayerController.h"]],
  [/\bAPawn\b/, ["GameFramework/Pawn.h", "GameFramework/Character.h"]],
  [/\bUCameraComponent\b/, ["Camera/CameraComponent.h"]],
  [/\bUSpringArmComponent\b/, ["GameFramework/SpringArmComponent.h"]],
  [/\bUAbilitySystemComponent\b/, ["AbilitySystemComponent.h"]],
  [/\bUAudioComponent\b/, ["Components/AudioComponent.h"]],
  [/\bUWidgetComponent\b/, ["Components/WidgetComponent.h"]],
  [/\bUCapsuleComponent\b/, ["Components/CapsuleComponent.h", "GameFramework/Character.h"]],
  [/\bUStaticMeshComponent\b/, ["Components/StaticMeshComponent.h"]],
  [/\bUSkeletalMeshComponent\b/, ["Components/SkeletalMeshComponent.h", "GameFramework/Character.h"]],
  [/\bUBoxComponent\b/, ["Components/BoxComponent.h"]],
  [/\bUSphereComponent\b/, ["Components/SphereComponent.h"]],
  [/\bUAnimInstance\b/, ["Animation/AnimInstance.h"]],
  [/\bUAnimMontage\b/, ["Animation/AnimMontage.h"]],
  [/\bCreateWidget\s*</, ["Blueprint/UserWidget.h"]],
];

const SUPER_CALLS = ["BeginPlay", "EndPlay", "TickComponent", "Tick", "GetLifetimeReplicatedProps", "InitializeComponent", "PostInitializeComponents", "SetupPlayerInputComponent"];

function bodyAt(code, from) {
  const open = code.indexOf("{", from);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < code.length; i += 1) {
    if (code[i] === "{") depth += 1;
    else if (code[i] === "}" && --depth === 0) return code.slice(open, i + 1);
  }
  return code.slice(open);
}

function balance(code, file, add) {
  [["{", "}", "braces"], ["(", ")", "parentheses"]].forEach(([o, c, name]) => {
    const n = count(code, new RegExp(`\\${o}`, "g")) - count(code, new RegExp(`\\${c}`, "g"));
    if (n) add("error", file, null, `Unbalanced ${name}: ${Math.abs(n)} ${n > 0 ? `unclosed '${o}'` : `extra '${c}'`}.`, "Check the end of each function and class body.");
  });
}

export function checkSystem(system) {
  const issues = [];
  const add = (severity, file, line, message, fix = "") => issues.push({ severity, file, line, message, fix });
  const rawH = system?.cpp_header || "";
  const rawC = system?.cpp_source || "";
  if (!rawH.trim() || !rawC.trim()) {
    add("error", rawH.trim() ? ".cpp" : ".h", null, "This file is empty.", "Regenerate the system.");
    return issues;
  }
  const h = strip(rawH);
  const c = strip(rawC);
  const base = baseName(system);
  const includes = [...`${rawH}\n${rawC}`.matchAll(/#include\s+[<"]([^>"]+)[>"]/g)].map((m) => m[1]);
  const hasInclude = (paths) => paths.some((p) => includes.some((i) => i === p || i.endsWith(`/${p}`) || p.endsWith(`/${i}`)));

  // Header structure
  if (!/#include\s+"CoreMinimal\.h"/.test(rawH)) add("warning", ".h", 1, "CoreMinimal.h is not included.", 'Add #include "CoreMinimal.h" as the first include.');
  const reflected = count(h, /\bUCLASS\s*\(/g) + count(h, /\bUSTRUCT\s*\(/g) + 2 * count(h, /\bUINTERFACE\s*\(/g);
  const genInc = [...rawH.matchAll(/#include\s+"(\w+)\.generated\.h"/g)];
  if (reflected && !genInc.length) add("error", ".h", null, `Missing #include "${base}.generated.h".`, "Unreal Header Tool needs it for every UCLASS/USTRUCT.");
  if (genInc.length) {
    const lastInc = [...rawH.matchAll(/#include\s+[<"][^>"]+[>"]/g)].pop();
    if (lastInc && !lastInc[0].includes(".generated.h")) add("error", ".h", lineOf(rawH, lastInc.index), `The .generated.h include must be the last #include (found ${lastInc[0].replace("#include", "").trim()} after it).`, "Move other includes above it.");
  }
  const generated = count(h, /\bGENERATED_(?:U?CLASS_|USTRUCT_|IINTERFACE_|UINTERFACE_)?BODY\s*\(/g);
  if (generated < reflected) add("error", ".h", null, `${reflected - generated} reflected class/struct${reflected - generated > 1 ? "es are" : " is"} missing GENERATED_BODY().`, "Add GENERATED_BODY() as the first line inside each UCLASS/USTRUCT.");

  // .cpp includes its own header
  if (!new RegExp(`#include\\s+"(?:[\\w/]*/)?${base}\\.h"`).test(rawC)) add("error", ".cpp", 1, `The .cpp doesn't include its header "${base}.h".`, `Add #include "${base}.h" as the first line.`);

  balance(h, ".h", add);
  balance(c, ".cpp", add);

  const classes = new Set(headerClasses(rawH));
  const declared = new Set([...h.matchAll(/\b(\w+)\s*\(/g)].map((m) => m[1]));
  // Definitions may be indented (namespaces); indented calls like Super::X( have no return type, so they're skipped
  const defs = [...c.matchAll(/^([ \t]*)((?:[\w<>,*&:]+[ \t*&]+)*?)(\w+)::(~?\w+)\s*\(/gm)]
    .filter((m) => !/;\s*$/.test(c.slice(m.index, c.indexOf("\n", m.index) >>> 0)))
    .filter((m) => !/\b(?:return|else|case|new|delete|throw|co_return)\b/.test(m[2]))
    .filter((m) => !m[1] || m[2].trim() || m[3] === m[4].replace(/^~/, ""))
    .map((m) => Object.assign([m[0], m[3], m[4]], { index: m.index }));
  const defined = new Set(defs.map((m) => m[2]));
  const definedIn = new Set(defs.map((m) => `${m[1]}::${m[2]}`));
  const classDecls = [...h.matchAll(/\b(?:class|struct)\s+(?:\w+_API\s+)?([UAFIE][A-Z]\w*)\s*(?:final\s*)?[:{]/g)];
  const classAt = (idx) => classDecls.filter((d) => d.index < idx && idx < d.index + bodyAt(h, d.index).length + (h.indexOf("{", d.index) - d.index)).pop()?.[1];
  const has = (idx, fn) => (classAt(idx) ? definedIn.has(`${classAt(idx)}::${fn}`) : defined.has(fn));

  defs.forEach((m) => {
    const [, cls, fn] = m;
    const line = lineOf(c, m.index);
    if (!classes.has(cls)) add("error", ".cpp", line, `${cls}::${fn} is defined, but the header has no class named ${cls}.`, `Check the class name; the header declares ${[...classes].join(", ") || "no classes"}.`);
    else if (!declared.has(fn.replace(/^~/, "").replace(/_(Implementation|Validate)$/, ""))) add("error", ".cpp", line, `${cls}::${fn} is defined but never declared in the header.`, `Declare ${fn.replace(/_(Implementation|Validate)$/, "")}(...) in the class.`);
    if (SUPER_CALLS.includes(fn) && !new RegExp(`Super::${fn}\\s*\\(`).test(bodyAt(c, m.index))) add("warning", ".cpp", line, `${cls}::${fn} doesn't call Super::${fn}().`, "Call the parent version first so engine behaviour still runs.");
  });

  // UFUNCTIONs the linker will need
  for (const m of h.matchAll(/UFUNCTION\s*\(((?:[^()]|\([^()]*\))*)\)\s*(?:[\w<>,*&:]+[\s*&]+)*?(\w+)\s*\(/g)) {
    const [, spec, fn] = m;
    const after = h.slice(m.index + m[0].length);
    const end = after.search(/[;{]/);
    if (end >= 0 && (after[end] === "{" || /=\s*0\s*$/.test(after.slice(0, end)))) continue;
    if (/BlueprintImplementableEvent/.test(spec)) continue;
    const needs = /BlueprintNativeEvent|\bServer\b|\bClient\b|NetMulticast/.test(spec) ? `${fn}_Implementation` : fn;
    if (!has(m.index, needs)) add("error", ".h", lineOf(h, m.index), `UFUNCTION ${classAt(m.index) ? `${classAt(m.index)}::` : ""}${fn} is declared but ${needs}() is never defined in the .cpp (linker error).`, `Implement ${needs}() in the .cpp${needs !== fn ? `, not ${fn}()` : ""}.`);
    if (/WithValidation/.test(spec) && !has(m.index, `${fn}_Validate`)) add("error", ".h", lineOf(h, m.index), `${fn} uses WithValidation but ${fn}_Validate() is missing.`, `Add bool ${fn}_Validate(...) to the .cpp.`);
  }

  // Replication
  const replicated = /UPROPERTY\s*\([^)]*\bReplicated(?:Using)?\b/.test(h);
  if (replicated && !defined.has("GetLifetimeReplicatedProps")) add("error", ".cpp", null, "Replicated properties exist but GetLifetimeReplicatedProps() isn't implemented.", "Implement it and register each property with DOREPLIFETIME.");
  if (replicated && /:\s*public\s+UActorComponent\b/.test(h) && !/SetIsReplicated(?:ByDefault)?\s*\(\s*true/.test(c)) add("warning", ".cpp", null, "This component has replicated properties but never turns replication on.", "Call SetIsReplicatedByDefault(true) in the constructor.");
  for (const m of h.matchAll(/ReplicatedUsing\s*=\s*(\w+)/g)) {
    if (!defined.has(m[1])) add("error", ".h", lineOf(h, m.index), `RepNotify ${m[1]} is referenced but not defined in the .cpp.`, `Declare it as a UFUNCTION() and implement ${m[1]}().`);
  }
  for (const m of c.matchAll(/DOREPLIFETIME(?:_CONDITION(?:_NOTIFY)?)?\s*\(\s*(\w+)\s*,\s*(\w+)/g)) {
    if (!classes.has(m[1])) add("error", ".cpp", lineOf(c, m.index), `DOREPLIFETIME uses ${m[1]}, which isn't the class in the header.`, `Use ${[...classes][0] || "the header class"}.`);
    else if (!new RegExp(`\\b${m[2]}\\b`).test(h)) add("error", ".cpp", lineOf(c, m.index), `DOREPLIFETIME registers ${m[2]}, which isn't declared in the header.`, "Check the property name.");
  }

  // Delegates
  for (const m of h.matchAll(/UPROPERTY\s*\([^)]*BlueprintAssignable[^)]*\)\s*(F\w+)/g)) {
    if (!new RegExp(`DECLARE_\\w*DELEGATE\\w*\\s*\\(\\s*${m[1]}\\b`).test(h)) add("error", ".h", lineOf(h, m.index), `Delegate type ${m[1]} is used but never declared.`, `Add DECLARE_DYNAMIC_MULTICAST_DELEGATE...(${m[1]}, ...) above the class.`);
  }
  if (defined.has("TickComponent") && !/bCanEverTick\s*=\s*true/.test(c)) add("warning", ".cpp", null, "TickComponent is implemented but ticking is never enabled, so it won't run.", "Set PrimaryComponentTick.bCanEverTick = true in the constructor.");

  // Likely missing includes
  INCLUDE_HINTS.forEach(([re, paths]) => {
    const m = c.match(re);
    if (m && !hasInclude(paths)) add("warning", ".cpp", lineOf(c, m.index), `Uses ${m[0].match(/\w+/)[0]} but doesn't include ${paths[0]}.`, `Add #include "${paths[0]}" to the .cpp.`);
  });

  const order = { error: 0, warning: 1 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity]);
}

export const issueText = (i) => `${i.file}${i.line ? `:${i.line}` : ""} ${i.message}`;

const fileText = (system, file) => (file === ".cpp" ? system?.cpp_source : system?.cpp_header) || "";

// Exact line if known, otherwise the first line mentioning the class/function the message names
export function locateIssue(issue, system) {
  const file = issue.file === ".cpp" ? ".cpp" : ".h";
  const lines = fileText(system, file).split("\n");
  if (issue.line > 0 && issue.line <= lines.length) return { file, line: issue.line };
  const tokens = [...(issue.message || "").matchAll(/\b(?:[UAFIE][A-Z]\w*::~?\w+|[A-Za-z_]\w*\.h|[A-Z]\w*_\w+|[A-Z][a-z0-9]+[A-Z]\w*|[A-Z]{3,}\w*)\b/g)]
    .map((m) => m[0]).sort((a, b) => b.includes("::") - a.includes("::"));
  for (const t of tokens) {
    const probe = file === ".h" && t.includes("::") ? t.split("::")[1] : t;
    const idx = lines.findIndex((l) => l.includes(probe));
    if (idx >= 0) return { file, line: idx + 1 };
  }
  return { file, line: 1 };
}

const hash = (s) => { let x = 5381; for (let i = 0; i < s.length; i += 1) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0; return x.toString(36); };

// Stable across regenerations unless the issue's own line text changes
export function issueKey(issue, system) {
  const { file, line } = locateIssue(issue, system);
  const text = issue.line || line > 1 ? (fileText(system, file).split("\n")[line - 1] || "").trim() : "";
  return `${file}|${hash(`${issue.message}|${text}`)}|${issue.message.slice(0, 200)}`;
}

export const issuesToText = (issues) => issues.map((i) => `${issueText(i)}${i.fix ? `\n    Fix: ${i.fix}` : ""}`).join("\n");

// Lighter check for the generated automation-test file
export function checkTests(code, base) {
  const issues = [];
  const add = (severity, line, message, fix = "") => issues.push({ severity, file: ".cpp", line, message, fix });
  const raw = code || "";
  const c = strip(raw);
  if (!raw.trim()) return [{ severity: "error", file: ".cpp", line: null, message: "The test file is empty.", fix: "Generate tests again." }];
  if (!/WITH_DEV_AUTOMATION_TESTS/.test(raw)) add("warning", 1, "Tests aren't wrapped in #if WITH_DEV_AUTOMATION_TESTS, so they'd compile into shipping builds.", "Wrap the file in #if WITH_DEV_AUTOMATION_TESTS ... #endif.");
  if (!/#include\s+"Misc\/AutomationTest\.h"/.test(raw)) add("error", 1, 'Missing #include "Misc/AutomationTest.h".', "Add it near the top.");
  if (!new RegExp(`#include\\s+"(?:[\\w/]*/)?${base}\\.h"`).test(raw)) add("error", 1, `The tests don't include the component header "${base}.h".`, `Add #include "${base}.h".`);
  if (!/BEGIN_DEFINE_SPEC|IMPLEMENT_SIMPLE_AUTOMATION_TEST|IMPLEMENT_COMPLEX_AUTOMATION_TEST/.test(c)) add("error", null, "No automation test or spec definition found.", "Use BEGIN_DEFINE_SPEC / END_DEFINE_SPEC.");
  if (/BEGIN_DEFINE_SPEC/.test(c) && !/::Define\s*\(\s*\)/.test(c)) add("error", null, "The spec has no Define() function, so it has no test cases.", "Add void <Spec>::Define() with Describe/It blocks.");
  [["{", "}", "braces"], ["(", ")", "parentheses"]].forEach(([o, cl, name]) => {
    const n = count(c, new RegExp(`\\${o}`, "g")) - count(c, new RegExp(`\\${cl}`, "g"));
    if (n) add("error", null, `Unbalanced ${name}: ${Math.abs(n)} ${n > 0 ? `unclosed '${o}'` : `extra '${cl}'`}.`);
  });
  INCLUDE_HINTS.forEach(([re, paths]) => {
    const m = c.match(re);
    if (m && !paths.some((p) => raw.includes(p))) add("warning", lineOf(c, m.index), `Uses ${m[0].match(/\w+/)[0]} but doesn't include ${paths[0]}.`, `Add #include "${paths[0]}".`);
  });
  return issues;
}
