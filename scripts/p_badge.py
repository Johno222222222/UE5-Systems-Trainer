p='/app/frontend/src/lib/zipExport.js'; s=open(p).read()
def r(a,b):
    global s
    assert a in s, a[:70]; s=s.replace(a,b,1)
r('''function pluginReadme(name, system, plugin, files, deps, enginePlugins) {
  const lines = [
    `# ${system.system_name} (Unreal plugin)`,
    "",''','''const errorsIn = (issues) => (issues || []).filter((i) => i.severity === "error");
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
    ...badgeLines(issues),''')
r('''export async function buildPluginZip(name, system, context) {''','''export async function buildPluginZip(name, system, context, issues = null) {''')
r('''  root.file("README.md", pluginReadme(name, system, plugin, files, deps, enginePlugins));''','''  root.file("README.md", pluginReadme(name, system, plugin, files, deps, enginePlugins, issues));''')
r('''export async function buildBundleZip(plugin, plan) {''','''export async function buildBundleZip(plugin, plan, checks = null) {''')
r('''  const rows = plan.map((p) => {''','''  const rows = plan.map((p, i) => {''')
r('''    return `| ${p.system.system_name} | \\`${p.module}\\` | \\`${files.h}\\` | ${["Core", "CoreUObject", "Engine", ...deps].join(", ")} |`;''','''    const c = checks?.[i];
    const status = !c ? "not checked" : errorsIn(c).length ? `${errorsIn(c).length} error(s)` : `✅ no errors${c.length ? ` (${c.length} warning${c.length === 1 ? "" : "s"})` : ""}`;
    return `| ${p.system.system_name} | \\`${p.module}\\` | \\`${files.h}\\` | ${["Core", "CoreUObject", "Engine", ...deps].join(", ")} | ${status} |`;''')
r('''    `# ${plugin} (Unreal plugin)`,
    "",''','''    `# ${plugin} (Unreal plugin)`,
    "",
    ...(checks && checks.length === plan.length ? badgeLines(checks.flatMap((c, i) => c.map((x) => ({ ...x, file: `${plan[i].module} ${x.file || ""}`.trim() })))) : []),''')
r('''    "| System | Module | Header | Build.cs dependencies |",
    "|---|---|---|---|",''','''    "| System | Module | Header | Build.cs dependencies | Compile check |",
    "|---|---|---|---|---|",''')
open(p,'w').write(s)
print("ok")
