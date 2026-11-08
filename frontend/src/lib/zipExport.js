import JSZip from "jszip";

const WHY_RE = /^(\s*)(?:\/\/\s*)?WHY:\s*(.*)$/i;

// UE requires the .h/.cpp names to match the "X.generated.h" include
function baseName(system) {
  const gen = (system.cpp_header || "").match(/#include\s+"([\w]+)\.generated\.h"/);
  if (gen) return gen[1];
  const cls = (system.cpp_header || "").match(/class\s+(?:\w+_API\s+)?[UAF]([A-Z]\w+)/);
  return cls ? cls[1] : (system.system_name || "System").replace(/[^A-Za-z0-9]/g, "");
}

// [code pattern, Build.cs module, engine plugin that must be enabled (if any)]
const DEPS = [
  [/GameplayTag/, "GameplayTags", null],
  [/UUserWidget|UMG|WidgetComponent/, "UMG", null],
  [/EnhancedInput|UInputAction|UInputMappingContext/, "EnhancedInput", "EnhancedInput"],
  [/AAIController|UBlackboard|UBehaviorTree|AIPerception/, "AIModule", null],
  [/Niagara/, "Niagara", "Niagara"],
  [/AbilitySystem|UGameplayAbility|UAttributeSet|GameplayEffect/, "GameplayAbilities", "GameplayAbilities"],
  [/ChaosVehicle|WheeledVehicle/, "ChaosVehicles", "ChaosVehiclesPlugin"],
  [/DOREPLIFETIME|Replicated|NetMulticast/, "NetCore", null],
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

export async function buildProjectZip(name, system, context) {
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
  return { blob: await zip.generateAsync({ type: "blob" }), filename: `${folder}.zip` };
}


// Uses the module's export macro on every UCLASS/USTRUCT so the classes are usable outside the plugin
function retargetApi(header, macro) {
  let out = header.replace(/\b[A-Z0-9_]+_API\b/g, macro);
  out = out.replace(/((?:UCLASS|USTRUCT)\((?:[^()]|\([^()]*\))*\)\s*(?:class|struct)\s+)(?![A-Z0-9_]+_API\b)(?=[UAF][A-Z]\w*\s*(?::|\{))/g, `$1${macro} `);
  return out;
}

function upluginJson(module, system, enginePlugins) {
  return JSON.stringify({
    FileVersion: 3,
    Version: 1,
    VersionName: "1.0",
    FriendlyName: system.system_name,
    Description: (system.summary || "").slice(0, 300),
    Category: "Gameplay",
    CreatedBy: "UE5 System Architect",
    CanContainContent: false,
    IsBetaVersion: false,
    Installed: false,
    EnabledByDefault: true,
    Modules: [{ Name: module, Type: "Runtime", LoadingPhase: "Default" }],
    ...(enginePlugins.length ? { Plugins: enginePlugins.map((p) => ({ Name: p, Enabled: true })) } : {}),
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

function pluginReadme(name, system, plugin, files, deps, enginePlugins) {
  const lines = [
    `# ${system.system_name} (Unreal plugin)`,
    "",
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

export async function buildPluginZip(name, system, context) {
  const base = baseName(system);
  const plugin = `${base.replace(/Component$|System$|Subsystem$/, "") || base}Kit`;
  const macro = `${plugin.toUpperCase()}_API`;
  const files = { h: `${base}.h`, cpp: `${base}.cpp` };
  const code = `${system.cpp_header || ""}\n${system.cpp_source || ""}`;
  const matched = DEPS.filter(([re]) => re.test(code));
  const deps = matched.map(([, d]) => d);
  const enginePlugins = matched.map(([, , p]) => p).filter(Boolean);
  const zip = new JSZip();
  const root = zip.folder(plugin);
  const src = root.folder(`Source/${plugin}`);
  root.file(`${plugin}.uplugin`, upluginJson(plugin, system, enginePlugins));
  src.file(`${plugin}.Build.cs`, buildCs(plugin, deps));
  src.file(`Private/${plugin}Module.cpp`, `#include "Modules/ModuleManager.h"\n\nIMPLEMENT_MODULE(FDefaultModuleImpl, ${plugin})\n`);
  src.file(`Public/${files.h}`, retargetApi(system.cpp_header || "", macro));
  src.file(`Private/${files.cpp}`, system.cpp_source || "");
  root.file("README.md", pluginReadme(name, system, plugin, files, deps, enginePlugins));
  root.file("SETUP.md", setupMd(system));
  root.file("BLUEPRINT_PSEUDOCODE.md", pseudoMd(system));
  root.file("system.json", JSON.stringify({ format: "ue5-architect-project", version: 1, name, system, context }, null, 2));
  return { blob: await zip.generateAsync({ type: "blob" }), filename: `${plugin}.zip` };
}
