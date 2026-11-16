"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { writePlugin } = require("./pluginFiles");

const PREFERRED = ["5.8", "5.7"];

function runUatName(platform) {
  return platform === "win32" ? "RunUAT.bat" : "RunUAT.sh";
}

function runUatFile(engineRoot, platform) {
  return path.join(engineRoot, "Engine", "Build", "BatchFiles", runUatName(platform));
}

function versionFromRoot(engineRoot) {
  const match = String(engineRoot).match(/UE_(\d+\.\d+)/i);
  return match ? match[1] : "";
}

function looksLikeEngine(engineRoot, platform, exists) {
  if (!engineRoot) return false;
  return exists(runUatFile(engineRoot, platform));
}

function searchRoots(platform, env) {
  const home = env.HOME || env.USERPROFILE || "";
  if (platform === "win32") {
    const roots = [];
    if (env.ProgramFiles) roots.push(path.join(env.ProgramFiles, "Epic Games"));
    if (env["ProgramFiles(x86)"]) roots.push(path.join(env["ProgramFiles(x86)"], "Epic Games"));
    return roots;
  }
  if (platform === "darwin") {
    return ["/Users/Shared/Epic Games", home ? path.join(home, "Epic Games") : ""].filter(Boolean);
  }
  return ["/opt/Epic Games", home ? path.join(home, "Epic Games") : ""].filter(Boolean);
}

function detectEngine({ platform, env, override, exists, readdir } = {}) {
  const os = platform || process.platform;
  const environment = env || process.env;
  const existsFn = exists || fs.existsSync;
  const readFn = readdir || ((dir) => {
    try { return fs.readdirSync(dir); } catch { return []; }
  });
  const found = [];
  const custom = String(override || "").trim();
  if (custom && looksLikeEngine(custom, os, existsFn)) {
    found.push({ version: versionFromRoot(custom) || "custom", path: custom, source: "settings" });
  }
  for (const root of searchRoots(os, environment)) {
    for (const name of readFn(root)) {
      const version = versionFromRoot(name);
      if (!PREFERRED.includes(version)) continue;
      const full = path.join(root, name);
      if (looksLikeEngine(full, os, existsFn)) found.push({ version, path: full, source: "install" });
    }
  }
  found.sort((a, b) => PREFERRED.indexOf(a.version) - PREFERRED.indexOf(b.version));
  const preferred = found.find((item) => item.version === "5.8") || found.find((item) => item.version === "5.7") || found[0] || null;
  if (!preferred) {
    return {
      found: false,
      version: "",
      path: "",
      message: "No Unreal Engine was found. This app looks for UE 5.8, then UE 5.7. Install one of those, or set the engine folder in Settings. The folder should contain Engine/Build/BatchFiles.",
    };
  }
  return {
    found: true,
    version: preferred.version,
    path: preferred.path,
    source: preferred.source,
    message: preferred.version === "custom"
      ? `Using the engine folder from Settings.`
      : `Using UE ${preferred.version}.`,
  };
}

function shownFile(rawPath) {
  const name = path.basename(String(rawPath || "").replace(/\\/g, "/")).toLowerCase();
  if (name.endsWith(".h")) return ".h";
  if (name.endsWith(".cpp") || name.endsWith(".c")) return ".cpp";
  return "";
}

function normalizeBuildPath(value) {
  let text = String(value || "").trim();
  text = text.replace(/[\\/]+$/, "");
  if (text.startsWith("\\\\") || text.startsWith("//")) return "";
  return text;
}

function pathJoin(root, name) {
  if (!root) return name;
  const sep = root.includes("\\") ? "\\" : "/";
  return `${root}${sep}${name}`;
}

// A package folder with spaces makes RunUAT split the argument. Prefer a
// scratch folder that has none, then a short fallback.
function safePackageDir(requested, platform, scratchRoot) {
  const cleaned = normalizeBuildPath(requested);
  if (cleaned && !/\s/.test(cleaned)) return cleaned;
  const scratch = normalizeBuildPath(scratchRoot || "");
  if (scratch && !/\s/.test(scratch)) return pathJoin(scratch, "ue5-uat-out");
  if (platform === "win32") {
    const drive = "C:";
    return `${drive}\\ue5-uat-out`;
  }
  return "/tmp/ue5-uat-out";
}

function quoteCmd(value) {
  return `"${String(value).replace(/"/g, "")}"`;
}

// Node on process.platform win32 throws EINVAL if spawn is given a .bat or
// .cmd directly (CVE-2024-27980). Run it through cmd.exe instead.
// /s strips one pair of quotes around the whole line, so the line is wrapped
// once more. Paths with spaces stay quoted inside that.
function windowsBuildLaunch({ uat, pluginPath, packageDir }) {
  const bat = normalizeBuildPath(uat);
  const plugin = normalizeBuildPath(pluginPath);
  const out = normalizeBuildPath(packageDir);
  const inner = [
    quoteCmd(bat),
    "BuildPlugin",
    `-Plugin=${quoteCmd(plugin)}`,
    `-Package=${quoteCmd(out)}`,
    "-Rocket",
  ].join(" ");
  // process.platform win32 cannot spawn a .bat. cmd.exe runs the quoted line.
  return {
    file: "cmd.exe",
    args: ["/d", "/s", "/c", `"${inner}"`],
    options: { shell: false, windowsVerbatimArguments: true },
  };
}

// MSVC: File.cpp(12): error C2065: 'Nope': undeclared identifier
// Clang: File.cpp:12:3: error: use of undeclared identifier
// UHT: File.h(8): Error: missing implementation
// Linker: error LNK2019
function parseCompilerOutput(log) {
  const issues = [];
  const seen = new Set();
  const push = (item) => {
    const key = `${item.file}:${item.line}:${item.message}`;
    if (seen.has(key) || !item.message) return;
    seen.add(key);
    issues.push(item);
  };
  for (const line of String(log || "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const msvc = trimmed.match(/^(.*?)\((\d+)(?:,\d+)?\):\s*(error|warning)\s*:?\s*(.*)$/i);
    const clang = trimmed.match(/^(.*?):(\d+):\d+:\s*(error|warning):\s*(.*)$/i);
    const link = trimmed.match(/error\s+LNK\d+:\s*(.*)$/i);
    const hit = msvc || clang;
    if (hit) {
      const where = shownFile(hit[1]);
      push({
        severity: hit[3].toLowerCase() === "warning" ? "warning" : "error",
        file: where || path.basename(String(hit[1]).replace(/\\/g, "/")),
        line: where ? Number(hit[2]) : null,
        message: hit[4].trim() || trimmed.slice(0, 300),
        fix: "This came from Unreal's compiler. Use Fix, or edit that line in the C++ view.",
      });
      continue;
    }
    if (link) {
      push({
        severity: "error",
        file: ".cpp",
        line: null,
        message: link[1].trim(),
        fix: "A linker error. The function is declared and not defined, or a module is missing from Build.cs.",
      });
      continue;
    }
    if (/^ERROR:/i.test(trimmed)) {
      push({
        severity: "error",
        file: "",
        line: null,
        message: trimmed.replace(/^ERROR:\s*/i, "").slice(0, 400),
        fix: "This is from RunUAT, before the compiler. The log below has the rest.",
      });
    }
  }
  return issues.slice(0, 40);
}

function commandFor(engineRoot, uplugin, outputDir, platform, scratchRoot) {
  const os = platform || process.platform;
  const uat = runUatFile(engineRoot, os);
  const packaged = safePackageDir(outputDir, os, scratchRoot);
  if (os === "win32") {
    return windowsBuildLaunch({ uat, pluginPath: uplugin, packageDir: packaged });
  }
  return {
    file: uat,
    args: ["BuildPlugin", `-Plugin=${uplugin}`, `-Package=${packaged}`, "-Rocket"],
    options: { shell: false },
  };
}

function runProcess(spec, spawnImpl) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawnImpl(spec.file, spec.args, { windowsHide: true, ...(spec.options || {}) });
    } catch (exc) {
      resolve({ code: 1, log: exc?.message || String(exc) });
      return;
    }
    let log = "";
    const take = (chunk) => { log += chunk.toString(); };
    child.stdout?.on("data", take);
    child.stderr?.on("data", take);
    child.on("error", (exc) => resolve({ code: 1, log: `${log}\n${exc.message}` }));
    child.on("close", (code) => resolve({ code: code == null ? 1 : code, log }));
  });
}

async function compilePlugin({ system, engineRoot, platform, workDir, spawnImpl }) {
  const os = platform || process.platform;
  const detected = detectEngine({ platform: os, override: engineRoot });
  if (!detected.found) return { ...detected, issues: [], log: "" };
  const pluginDir = path.join(workDir, "plugin");
  const outputDir = path.join(workDir, "packaged");
  fs.mkdirSync(pluginDir, { recursive: true });
  const written = writePlugin(pluginDir, system);
  const spec = commandFor(detected.path, written.uplugin, outputDir, os, workDir);
  const result = await runProcess(spec, spawnImpl || spawn);
  const command = `${spec.file} ${spec.args.join(" ")}`;
  const fullLog = `Command:\n${command}\n\n${result.log || "(no output)"}`;
  const issues = parseCompilerOutput(result.log);
  const compilerLines = issues.filter((item) => item.line);
  if (result.code !== 0 && !compilerLines.length && !issues.some((item) => item.severity === "error")) {
    const lines = String(result.log || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const first = lines.find((line) => /error|exception|failed|not found|enoent/i.test(line)) || lines[0];
    issues.unshift({
      severity: "error",
      file: "",
      line: null,
      message: first
        ? `Unreal's build tool failed: ${first.slice(0, 300)}`
        : "Unreal's build tool failed and printed no compiler line. The log is below.",
      fix: "Open the build log. A path with spaces, a missing module, or RunUAT exiting first are the usual causes.",
    });
  }
  const errors = issues.filter((item) => item.severity === "error").length;
  return {
    found: true,
    version: detected.version,
    path: detected.path,
    ok: result.code === 0 && errors === 0,
    issues,
    command,
    log: fullLog.slice(-12000),
    message: result.code === 0 && errors === 0
      ? `UE ${detected.version} built this plugin.`
      : `UE ${detected.version}: ${(issues.find((item) => item.severity === "error") || issues[0] || {}).message || "The build failed."}`,
  };
}

module.exports = {
  PREFERRED,
  detectEngine,
  parseCompilerOutput,
  commandFor,
  compilePlugin,
  runUatFile,
  windowsBuildLaunch,
  safePackageDir,
  normalizeBuildPath,
  shownFile,
};
