p='/app/frontend/src/lib/zipExport.js'; s=open(p).read()
def r(a,b):
    global s
    assert a in s, a[:70]; s=s.replace(a,b,1)
r('''import JSZip from "jszip";''','''import JSZip from "jszip";
import { blueprintClipboard, tuningFiles } from "./unrealExtras";''')
r('''    Modules: modules.map((m) => ({ Name: m, Type: "Runtime", LoadingPhase: "Default" })),''','''    Modules: modules.map((m) => (typeof m === "string" ? { Name: m, Type: "Runtime", LoadingPhase: "Default" } : m)),''')
r('''  src.file(`Private/${files.cpp}`, system.cpp_source || "");
  return { files, deps, enginePlugins };''','''  src.file(`Private/${files.cpp}`, system.cpp_source || "");
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
    ts.file(`Private/${tm}Module.cpp`, `#include "Modules/ModuleManager.h"\\n\\nIMPLEMENT_MODULE(FDefaultModuleImpl, ${tm})\\n`);
    ts.file(`Private/${system.tests.file_name || `${base}Spec.cpp`}`, system.tests.code);
    modules.push({ Name: tm, Type: "Editor", LoadingPhase: "Default" });
  }
  return { files, deps, enginePlugins, modules, tuningSetup: tuning?.setup || "" };''')
r('''export async function buildPluginZip(name, system, context, issues = null) {
  const plugin = moduleName(system);
  const zip = new JSZip();
  const root = zip.folder(plugin);
  const { files, deps, enginePlugins } = writeModule(root, plugin, system);
  root.file(`${plugin}.uplugin`, upluginJson(system.system_name, system.summary, [plugin], enginePlugins));
  root.file("README.md", pluginReadme(name, system, plugin, files, deps, enginePlugins, issues));
  root.file("SETUP.md", setupMd(system));''','''const EXTRAS_README = [
  "",
  "## Extras",
  "- `Blueprints/*_EventGraph.txt`: open it, copy everything, then click inside a Blueprint Event Graph in Unreal and press Ctrl+V. Build the plugin first so the C++ nodes resolve; connect a reference to the component into each function's Target pin. Nodes the app couldn't map arrive as TODO comments.",
  "- `Data/*_Tuning.csv`: tuning values as a Data Table (see SETUP.md).",
  "- `Source/*Tests`: automation tests (if generated). Run them from Tools > Session Frontend > Automation, filter \\"SystemArchitect\\".",
  "- `COMPILE_REPORT.md`: what the app's compile check found, ignored and fixed.",
];

export async function buildPluginZip(name, system, context, issues = null, report = null) {
  const plugin = moduleName(system);
  const zip = new JSZip();
  const root = zip.folder(plugin);
  const { files, deps, enginePlugins, modules, tuningSetup } = writeModule(root, plugin, system);
  root.file(`${plugin}.uplugin`, upluginJson(system.system_name, system.summary, modules, enginePlugins));
  root.file("README.md", pluginReadme(name, system, plugin, files, deps, enginePlugins, issues) + EXTRAS_README.join("\\n"));
  root.file("SETUP.md", `${setupMd(system)}${tuningSetup ? `\\n\\n${tuningSetup}\\n` : ""}`);
  if (report) root.file("COMPILE_REPORT.md", report);''')
r('''export async function buildBundleZip(plugin, plan, checks = null) {''','''export async function buildBundleZip(plugin, plan, checks = null, report = null) {''')
r('''  const enginePlugins = [];
  const rows = plan.map((p, i) => {
    const { files, deps, enginePlugins: ep } = writeModule(root, p.module, p.system, p.uses);
    enginePlugins.push(...ep);
    const docs = root.folder(`Docs/${p.module}`);
    docs.file("SETUP.md", setupMd(p.system));''','''  const enginePlugins = [];
  const allModules = [];
  if (report) root.file("COMPILE_REPORT.md", report);
  const rows = plan.map((p, i) => {
    const { files, deps, enginePlugins: ep, modules, tuningSetup } = writeModule(root, p.module, p.system, p.uses);
    enginePlugins.push(...ep);
    allModules.push(...modules);
    const docs = root.folder(`Docs/${p.module}`);
    docs.file("SETUP.md", `${setupMd(p.system)}${tuningSetup ? `\\n\\n${tuningSetup}\\n` : ""}`);''')
r('''`Bundles ${names.join(", ")}.`, plan.map((p) => p.module), enginePlugins));''','''`Bundles ${names.join(", ")}.`, allModules, enginePlugins));''')
r('''    "_Exported from UE5 System Architect._",
  ].join("\\n"));''','''    ...EXTRAS_README,
    "",
    "_Exported from UE5 System Architect._",
  ].join("\\n"));''')
r('''  root.file("system.json", JSON.stringify({ format: "ue5-architect-project", version: 1, name, system, context }, null, 2));
  return { blob: await zip.generateAsync({ type: "blob" }), filename: `${folder}.zip` };''','''  root.file("system.json", JSON.stringify({ format: "ue5-architect-project", version: 1, name, system, context }, null, 2));
  if (report) root.file("COMPILE_REPORT.md", report);
  return { blob: await zip.generateAsync({ type: "blob" }), filename: `${folder}.zip` };''')
r('''export async function buildProjectZip(name, system, context) {''','''export async function buildProjectZip(name, system, context, issues = null, report = null) { // eslint-disable-line no-unused-vars''')
open(p,'w').write(s)
print("ok")
