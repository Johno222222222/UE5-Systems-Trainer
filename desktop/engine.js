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

// MSVC: File.cpp(12): error C2065: 'Nope': undeclared identifier
// Clang: File.cpp:12:3: error: use of undeclared identifier
function parseCompilerOutput(log) {
  const issues = [];
  const seen = new Set();
  for (const line of String(log || "").split(/\r?\n/)) {
    const msvc = line.match(/^(.*?)\((\d+)(?:,\d+)?\):\s*(error|warning)\s+[^:]+:\s*(.*)$/i);
    const clang = line.match(/^(.*?):(\d+):\d+:\s*(error|warning):\s*(.*)$/i);
    const hit = msvc || clang;
    if (!hit) continue;
    const file = path.basename(hit[1].trim());
    const item = {
      severity: hit[3].toLowerCase() === "warning" ? "warning" : "error",
      file: file.endsWith(".h") ? ".h" : ".cpp",
      line: Number(hit[2]),
      message: hit[4].trim(),
      fix: "This came from Unreal's compiler. Use Fix to patch it, then build again.",
    };
    const key = `${item.file}:${item.line}:${item.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push(item);
  }
  return issues;
}

function commandFor(engineRoot, uplugin, outputDir, platform) {
  const os = platform || process.platform;
  const uat = runUatFile(engineRoot, os);
  const args = ["BuildPlugin", `-Plugin=${uplugin}`, `-Package=${outputDir}`, "-Rocket"];
  if (os === "win32" && process.platform === "win32") {
    return { file: "cmd.exe", args: ["/d", "/s", "/c", uat, ...args] };
  }
  return { file: uat, args };
}

function runProcess(spec, spawnImpl) {
  return new Promise((resolve) => {
    const child = spawnImpl(spec.file, spec.args, { windowsHide: true });
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
  const spec = commandFor(detected.path, written.uplugin, outputDir, os);
  const result = await runProcess(spec, spawnImpl || spawn);
  const issues = parseCompilerOutput(result.log);
  if (result.code !== 0 && !issues.some((item) => item.severity === "error")) {
    issues.unshift({
      severity: "error",
      file: ".cpp",
      line: null,
      message: "Unreal's build tool failed before it printed a compiler line.",
      fix: "Read the log tail in this panel. A missing engine module is the usual cause.",
    });
  }
  const errors = issues.filter((item) => item.severity === "error").length;
  return {
    found: true,
    version: detected.version,
    path: detected.path,
    ok: result.code === 0 && errors === 0,
    issues,
    log: result.log.slice(-4000),
    message: result.code === 0 && errors === 0
      ? `UE ${detected.version} built this plugin.`
      : `UE ${detected.version} reported ${errors} compiler error${errors === 1 ? "" : "s"}.`,
  };
}

module.exports = {
  PREFERRED,
  detectEngine,
  parseCompilerOutput,
  commandFor,
  compilePlugin,
  runUatFile,
};
