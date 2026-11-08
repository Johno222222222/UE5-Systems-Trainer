import JSZip from "jszip";
import { blueprintClipboard, tuningFiles } from "./unrealExtras";

const WHY_RE = /^(\s*)(?:\/\/\s*)?WHY:\s*(.*)$/i;

// UE requires the .h/.cpp names to match the "X.generated.h" include
export function baseName(system) {
  const gen = (system.cpp_header || "").match(/#include\s+"([\w]+)\.generated\.h"/);
  if (gen) return gen[1];
  const cls = (system.cpp_header || "").match(/class\s+(?:\w+_API\s+)?[UAF]([A-Z]\w+)/);
  return cls ? cls[1] : (system.system_name || "System").replace(/[^A-Za-z0-9]/g, "");
}

export function headerClasses(header) {
  const code = (header || "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  return [...code.matchAll(/\b(?:class|struct)\s+(?:\w+_API\s+)?([UAFIE][A-Z]\w*)\s*(?:final\s*)?[:{]/g)].map((m) => m[1]);
}

export const moduleName = (system) => {
  const base = baseName(system);
  return `${base.replace(/Component$|System$|Subsystem$/, "") || base}Kit`;
};

// [code pattern, Build.cs module, engine plugin that must be enabled (if any)]
const DEPS = [
  [/GameplayTag/, "GameplayTags", null],
  [/UUserWidget|UMG|WidgetComponent|WidgetLayoutLibrary|WidgetBlueprintLibrary/, "UMG", null],
  [/EnhancedInput|UInputAction|UInputMappingContext/, "EnhancedInput", "EnhancedInput"],
  [/AAIController|UBlackboard|UBehaviorTree|AIPerception/, "AIModule", null],
  [/Niagara/, "Niagara", "Niagara"],
  [/AbilitySystem|UGameplayAbility|UAttributeSet|GameplayEffect/, "GameplayAbilities", "GameplayAbilities"],
  [/ChaosVehicle|WheeledVehicle/, "ChaosVehicles", "ChaosVehiclesPlugin"],
  [/DOREPLIFETIME|Replicated|NetMulticast/, "NetCore", null],
  [/UNavigationSystemV1|UNavigationPath|NavigationSystem\.h/, "NavigationSystem", null],
  [/UPhysicalMaterial|EPhysicalSurface|PhysicsCore/, "PhysicsCore", null],
  [/\bEKeys::|FKey\b|InputCore/, "InputCore", null],
  [/UUserWidget|UMG|WidgetComponent|SNew\(|Slate/, "SlateCore", null],
  [/SNew\(|SWidget|Slate\//, "Slate", null],
];

function readme(name, system, files, apiMacro, deps) {
  const lines = [
    `# ${system.system_name}`,
    "",
    system.summary || "",
    "",
    "## Drop it into your project",
    `1. Copy \`Public/${files.h}\` and \`Private/${files.cpp}\` into your game module (e.g. \`Source/YourGame/Public\` and \`Source/YourGame/Private\`).`,
  ];
  if (apiMacro) lines.push(`2. Replace \`${apiMacro}\` in the header with your module's export macro (e.g. \`YOURGAME_API\`).`);
  else lines.push("2. Add your module's export macro (e.g. `YOURGAME_API`) after `class` if you need the class outside its module.");
  lines.push(
    deps.length
      ? `3. Add these to \`PublicDependencyModuleNames\` in your \`YourGame.Build.cs\`: ${deps.map((d) => `"${d}"`).join(", ")}.`
      : "3. No extra modules are needed beyond Core, CoreUObject and Engine.",
    "4. Right-click your .uproject → Generate Visual Studio project files, then build.",
    "5. Follow SETUP.md for the editor steps.",
    "",
    "## In this folder",
    "- `SETUP.md`: step-by-step editor setup, with the reason for each step",
    "- `BLUEPRINT_PSEUDOCODE.md`: the event graph logic, with Why notes",
    "- `system.json`: the full generated system; import it back into UE5 System Architect",
  );
  if (system.network_notes) lines.push("", "## Replication", system.network_notes);
  lines.push("", `_Exported from UE5 System Architect project "${name}"._`);
  return lines.join("\n");
}

function setupMd(system) {
  const out = [`# Setup: ${system.system_name}`, ""];
  (system.setup_guide || []).forEach((s) => {
    out.push(`## ${s.step}. ${s.title}`, "", s.detail || "");
    if (s.why) out.push("", `> **Why:** ${s.why}`);
    out.push("");
  });
  const params = system.tunable_parameters || [];
  if (params.length) {
    out.push("## Tunable parameters", "", "| Parameter | Default | Range |", "|---|---|---|");
    params.forEach((p) => out.push(`| ${p.label || p.key} | ${p.value}${p.unit ? ` ${p.unit}` : ""} | ${p.min} – ${p.max} |`));
    out.push("");
  }
  const mods = system.modules || [];
  if (mods.length) {
    out.push("## Modules", "");
    mods.forEach((m) => out.push(`- [${m.included ? "x" : " "}] **${m.name}**${m.description ? `: ${m.description}` : ""}`));
  }
  return out.join("\n");
}

function pseudoMd(system) {
  const out = [`# Blueprint pseudocode: ${system.system_name}`, "", "```"];
  const notes = [];
  (system.blueprint_pseudocode || "").split("\n").forEach((line) => {
    const m = line.match(WHY_RE);
    if (m) {
      out.push(`${m[1]}// WHY: ${m[2]}`);
      notes.push(m[2]);
    } else out.push(line);
  });
  out.push("```");
  if (notes.length) out.push("", "## Why these decisions", "", ...notes.map((n) => `- ${n}`));
  return out.join("\n");
}

export async function buildProjectZip(name, system, context, issues = null, report = null) { // eslint-disable-line no-unused-vars
  const base = baseName(system);
  const folder = base;
  const files = { h: `${base}.h`, cpp: `${base}.cpp` };
  const code = `${system.cpp_header || ""}\n${system.cpp_source || ""}`;
  const apiMacro = (system.cpp_header || "").match(/\b([A-Z0-9_]+)_API\b/)?.[0] || null;
  const deps = DEPS.filter(([re]) => re.test(code)).map(([, d]) => d).filter((d) => d !== "NetCore");
  const zip = new JSZip();
  const root = zip.folder(folder);
  root.file(`Public/${files.h}`, system.cpp_header || "");
  root.file(`Private/${files.cpp}`, system.cpp_source || "");
  root.file("README.md", readme(name, system, files, apiMacro, deps));
  root.file("SETUP.md", setupMd(system));
  root.file("BLUEPRINT_PSEUDOCODE.md", pseudoMd(system));
  root.file("system.json", JSON.stringify({ format: "ue5-architect-project", version: 1, name, system, context }, null, 2));
  if (report) root.file("COMPILE_REPORT.md", report);
  return { blob: await zip.generateAsync({ type: "blob" }), filename: `${folder}.zip` };
}


// Uses the module's export macro on every UCLASS/USTRUCT so the classes are usable outside the plugin
function retargetApi(header, macro) {
  let out = header.replace(/\b[A-Z0-9_]+_API\b/g, macro);
  out = out.replace(/((?:UCLASS|USTRUCT)\((?:[^()]|\([^()]*\))*\)\s*(?:class|struct)\s+)(?![A-Z0-9_]+_API\b)(?=[UAF][A-Z]\w*\s*(?::|\{))/g, `$1${macro} `);
  return out;
}

function upluginJson(friendly, description, modules, enginePlugins) {
  return JSON.stringify({
    FileVersion: 3,
    Version: 1,
    VersionName: "1.0",
    FriendlyName: friendly,
    Description: (description || "").slice(0, 300),
    Category: "Gameplay",
    CreatedBy: "UE5 System Architect",
    CanContainContent: false,
    IsBetaVersion: false,
    Installed: false,
    EnabledByDefault: true,
    Modules: modules.map((m) => (typeof m === "string" ? { Name: m, Type: "Runtime", LoadingPhase: "Default" } : m)),
    ...(enginePlugins.length ? { Plugins: [...new Set(enginePlugins)].map((p) => ({ Name: p, Enabled: true })) } : {}),
  }, null, 2);
}

function buildCs(module, deps) {
  const list = ["Core", "CoreUObject", "Engine", ...deps].map((d) => `"${d}"`).join(", ");
  return `using UnrealBuildTool;

public class ${module} : ModuleRules
{
\tpublic ${module}(ReadOnlyTargetRules Target) : base(Target)
\t{
\t\tPCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
\t\tPublicDependencyModuleNames.AddRange(new string[] { ${list} });
\t}
}
`;
}

// Writes Source/<module>/ (Build.cs, module entry, Public .h, Private .cpp); extraDeps are sibling modules it uses
function writeModule(root, module, system, extraDeps = []) {
  const base = baseName(system);
  const files = { h: `${base}.h`, cpp: `${base}.cpp` };
  const code = `${system.cpp_header || ""}\n${system.cpp_source || ""}`;
  const matched = DEPS.filter(([re]) => re.test(code));
  const deps = [...matched.map(([, d]) => d), ...extraDeps];
  const enginePlugins = matched.map(([, , p]) => p).filter(Boolean);
  const src = root.folder(`Source/${module}`);
  src.file(`${module}.Build.cs`, buildCs(module, deps));
  src.file(`Private/${module}Module.cpp`, `#include "Modules/ModuleManager.h"\n\nIMPLEMENT_MODULE(FDefaultModuleImpl, ${module})\n`);
  src.file(`Public/${files.h}`, retargetApi(system.cpp_header || "", `${module.toUpperCase()}_API`));
  src.file(`Private/${files.cpp}`, system.cpp_source || "");
  const tuning = tuningFiles(system, module);
  if (tuning) {
    src.file(`Public/${tuning.base}TuningRow.h`, tuning.h);
    src.file(`Private/${tuning.base}TuningRow.cpp`, tuning.cpp);
    root.file(`Data/${tuning.base}_Tuning.csv`, tuning.csv);
  }
  if ((system.node_graph_nodes || []).length) root.file(`Blueprints/${module}_EventGraph.txt`, blueprintClipboard(system).text);
  const modules = [module];
  if (system.tests?.code) {
    const tm = `${module}Tests`;
    const ts = root.folder(`Source/${tm}`);
    ts.file(`${tm}.Build.cs`, buildCs(tm, [module]));
    ts.file(`Private/${tm}Module.cpp`, `#include "Modules/ModuleManager.h"\n\nIMPLEMENT_MODULE(FDefaultModuleImpl, ${tm})\n`);
    ts.file(`Private/${system.tests.file_name || `${base}Spec.cpp`}`, system.tests.code);
    modules.push({ Name: tm, Type: "Editor", LoadingPhase: "Default" });
  }
  return { files, deps, enginePlugins, modules, tuningSetup: tuning?.setup || "" };
}

const systemJson = (name, system, context) => JSON.stringify({ format: "ue5-architect-project", version: 1, name, system, context }, null, 2);

const errorsIn = (issues) => (issues || []).filter((i) => i.severity === "error");
const BADGE = "![compile-checked](https://img.shields.io/badge/compile--checked-no%20errors-brightgreen)";
const where = (i) => `${i.file || ""}${i.line ? `:${i.line}` : ""}`;

// Only when the export had no errors (warnings allowed and listed)
function badgeLines(issues) {
  if (!issues || errorsIn(issues).length) return [];
  const warns = issues.filter((i) => i.severity !== "error");
  return [
    BADGE,
    "",
    `**Compile-checked** by UE5 System Architect on ${new Date().toISOString().slice(0, 10)}: no errors found${warns.length ? `, ${warns.length} warning${warns.length === 1 ? "" : "s"}` : ", no warnings"}.`,
    ...warns.map((w) => `- Warning ${where(w)}: ${w.message}`),
    "",
    "_Pattern check (plus any AI review run before export). It catches common mistakes but isn't a full compile, so build once in Unreal to be sure._",
    "",
  ];
}

function pluginReadme(name, system, plugin, files, deps, enginePlugins, issues) {
  const lines = [
    `# ${system.system_name} (Unreal plugin)`,
    "",
    ...badgeLines(issues),
    system.summary || "",
    "",
    "## Install (no code edits)",
    `1. Copy the \`${plugin}\` folder into your project's \`Plugins/\` folder (create it if needed): \`YourProject/Plugins/${plugin}/\`.`,
    "2. Right-click your .uproject → Generate Visual Studio project files, then build. (Blueprint-only project? Opening it will offer to build the plugin.)",
    "3. The plugin is enabled by default. Check Edit → Plugins → Gameplay if you want to confirm.",
    `4. Follow SETUP.md. The classes from \`${files.h}\` show up in the editor like any other C++ class.`,
    "",
    "## What's inside",
    `- \`${plugin}.uplugin\`: plugin descriptor${enginePlugins.length ? ` (enables ${enginePlugins.join(", ")})` : ""}`,
    `- \`Source/${plugin}/${plugin}.Build.cs\`: module rules (Core, CoreUObject, Engine${deps.length ? `, ${deps.join(", ")}` : ""})`,
    `- \`Source/${plugin}/Private/${plugin}Module.cpp\`: module entry point`,
    `- \`Source/${plugin}/Public/${files.h}\` and \`Private/${files.cpp}\`: the generated system, with its export macro set to \`${plugin.toUpperCase()}_API\``,
    "- `SETUP.md`, `BLUEPRINT_PSEUDOCODE.md`: editor setup and graph logic with Why notes",
    "- `system.json`: re-import into UE5 System Architect",
  ];
  if (system.network_notes) lines.push("", "## Replication", system.network_notes);
  lines.push("", `_Exported from UE5 System Architect project "${name}"._`);
  return lines.join("\n");
}

const EXTRAS_README = [
  "",
  "## Extras",
  "- `Blueprints/*_EventGraph.txt`: open it, copy everything, then click inside a Blueprint Event Graph in Unreal and press Ctrl+V. Build the plugin first so the C++ nodes resolve; connect a reference to the component into each function's Target pin. Nodes the app couldn't map arrive as TODO comments.",
  "- `Data/*_Tuning.csv`: tuning values as a Data Table (see SETUP.md).",
  "- `Source/*Tests`: automation tests (if generated). Run them from Tools > Session Frontend > Automation, filter \"SystemArchitect\".",
  "- `COMPILE_REPORT.md`: what the app's compile check found, ignored and fixed.",
];

export async function buildPluginZip(name, system, context, issues = null, report = null) {
  const plugin = moduleName(system);
  const zip = new JSZip();
  const root = zip.folder(plugin);
  const { files, deps, enginePlugins, modules, tuningSetup } = writeModule(root, plugin, system);
  root.file(`${plugin}.uplugin`, upluginJson(system.system_name, system.summary, modules, enginePlugins));
  root.file("README.md", pluginReadme(name, system, plugin, files, deps, enginePlugins, issues) + EXTRAS_README.join("\n"));
  root.file("SETUP.md", `${setupMd(system)}${tuningSetup ? `\n\n${tuningSetup}\n` : ""}`);
  if (report) root.file("COMPILE_REPORT.md", report);
  root.file("BLUEPRINT_PSEUDOCODE.md", pseudoMd(system));
  root.file("system.json", systemJson(name, system, context));
  return { blob: await zip.generateAsync({ type: "blob" }), filename: `${plugin}.zip` };
}

// items: [{name, system, context}] -> one module per system with unique names, plus sibling deps
export function planBundle(items) {
  const used = new Set();
  const plan = items.map((it) => {
    let mod = moduleName(it.system);
    for (let n = 2; used.has(mod); n += 1) mod = `${moduleName(it.system)}${n}`;
    used.add(mod);
    return { ...it, module: mod, classes: headerClasses(it.system.cpp_header) };
  });
  return plan.map((p) => {
    const code = `${p.system.cpp_header || ""}\n${p.system.cpp_source || ""}`;
    const uses = plan.filter((o) => o !== p && !o.classes.some((c) => p.classes.includes(c)) && (o.classes.some((c) => new RegExp(`\\b${c}\\b`).test(code))
      || code.includes(`"${baseName(o.system)}.h"`))).map((o) => o.module);
    return { ...p, uses };
  });
}

export function bundleIssues(plan) {
  const out = [];
  const seen = {};
  plan.forEach((p) => p.classes.forEach((c) => {
    if (seen[c] && seen[c] !== p) out.push({ severity: "error", file: "", line: null, message: `${seen[c].name} (${seen[c].module}) and ${p.name} (${p.module}) both declare ${c}. Unreal can't load two classes with the same name.`, fix: "Rename the class in one project and regenerate it." });
    seen[c] = seen[c] || p;
  }));
  plan.forEach((p, i) => plan.slice(i + 1).forEach((o) => {
    if (p.uses.includes(o.module) && o.uses.includes(p.module)) out.push({ severity: "error", file: "", line: null, message: `${p.name} and ${o.name} use each other's classes, which makes a circular module dependency.`, fix: "Talk through an interface or delegate in one direction, or stack them into one system." });
  }));
  const files = {};
  plan.forEach((p) => {
    const h = `${baseName(p.system)}.h`;
    if (files[h]) out.push({ severity: "warning", file: "", line: null, message: `${files[h].name} (${files[h].module}) and ${p.name} (${p.module}) both have a header named ${h}, so #include "${h}" becomes ambiguous.`, fix: "Rename one of the classes." });
    files[h] = files[h] || p;
  });
  return out;
}

export async function buildBundleZip(plugin, plan, checks = null, report = null) {
  const zip = new JSZip();
  const root = zip.folder(plugin);
  const enginePlugins = [];
  const allModules = [];
  if (report) root.file("COMPILE_REPORT.md", report);
  const rows = plan.map((p, i) => {
    const { files, deps, enginePlugins: ep, modules, tuningSetup } = writeModule(root, p.module, p.system, p.uses);
    enginePlugins.push(...ep);
    allModules.push(...modules);
    const docs = root.folder(`Docs/${p.module}`);
    docs.file("SETUP.md", `${setupMd(p.system)}${tuningSetup ? `\n\n${tuningSetup}\n` : ""}`);
    docs.file("BLUEPRINT_PSEUDOCODE.md", pseudoMd(p.system));
    docs.file("system.json", systemJson(p.name, p.system, p.context));
    const c = checks?.[i];
    const status = !c ? "not checked" : errorsIn(c).length ? `${errorsIn(c).length} error(s)` : `✅ no errors${c.length ? ` (${c.length} warning${c.length === 1 ? "" : "s"})` : ""}`;
    return `| ${p.system.system_name} | \`${p.module}\` | \`${files.h}\` | ${["Core", "CoreUObject", "Engine", ...deps].join(", ")} | ${status} |`;
  });
  const names = plan.map((p) => p.system.system_name);
  root.file(`${plugin}.uplugin`, upluginJson(plugin.replace(/([a-z0-9])([A-Z])/g, "$1 $2"), `Bundles ${names.join(", ")}.`, allModules, enginePlugins));
  root.file("README.md", [
    `# ${plugin} (Unreal plugin)`,
    "",
    ...(checks && checks.length === plan.length ? badgeLines(checks.flatMap((c, i) => c.map((x) => ({ ...x, file: `${plan[i].module} ${x.file || ""}`.trim() })))) : []),
    `One install for ${plan.length} systems: ${names.join(" + ")}. Each system is its own runtime module, so you can read, extend or remove them separately.`,
    "",
    "## Install (no code edits)",
    `1. Copy the \`${plugin}\` folder into \`YourProject/Plugins/\` (create the folder if needed).`,
    "2. Right-click your .uproject → Generate Visual Studio project files, then build.",
    "3. The plugin is enabled by default. Follow each system's SETUP.md in `Docs/<Module>/`.",
    "",
    "## Modules",
    "| System | Module | Header | Build.cs dependencies | Compile check |",
    "|---|---|---|---|---|",
    ...rows,
    "",
    "Modules that use another system's classes already list that module in their Build.cs.",
    ...(enginePlugins.length ? ["", `Enables engine plugins: ${[...new Set(enginePlugins)].join(", ")}.`] : []),
    "",
    ...EXTRAS_README,
    "",
    "_Exported from UE5 System Architect._",
  ].join("\n"));
  return { blob: await zip.generateAsync({ type: "blob" }), filename: `${plugin}.zip` };
}
