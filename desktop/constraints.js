"use strict";

// Locks the user pins on a project. They go into the prompt and are checked
// again after the model replies, so a re-synthesis that ignores them is flagged.

const LOCKS = [
  {
    id: "server_authority",
    label: "Must stay server-authoritative",
    rule: "Every change to game state must run on the server. Use HasAuthority() or a Server RPC before writing replicated or gameplay values. Do not let a client write them.",
  },
  {
    id: "no_tick",
    label: "No Tick",
    rule: "Do not declare or define Tick or TickComponent, and do not set bCanEverTick = true. Setting bCanEverTick = false is allowed. Drive the system with events, notifies, and timers. Ignore tick_rate.",
  },
];

const BY_ID = new Map(LOCKS.map((lock) => [lock.id, lock]));

function knownLocks(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const id of value) {
    const key = String(id);
    if (BY_ID.has(key) && !out.includes(key)) out.push(key);
  }
  return out;
}

function constraintText(ids) {
  const locks = knownLocks(ids).map((id) => BY_ID.get(id));
  if (!locks.length) return "";
  return [
    "CONSTRAINT LOCKS (these survive re-synthesis; do not break them):",
    ...locks.map((lock) => `- ${lock.label}: ${lock.rule}`),
  ].join("\n");
}

function strip(code) {
  return String(code || "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, "\"\"");
}

function hasTick(header, source) {
  const h = strip(header);
  const c = strip(source);
  const override = /\bvoid\s+Tick\s*\(|\bvoid\s+TickComponent\s*\(|::Tick\s*\(|::TickComponent\s*\(/;
  const enabled = /\bbCanEverTick\s*=\s*true\b/;
  return override.test(h) || override.test(c) || enabled.test(h) || enabled.test(c);
}

function hasAuthority(header, source) {
  const code = `${header || ""}\n${source || ""}`;
  return /\bHasAuthority\s*\(/.test(code)
    || /\bROLE_Authority\b/.test(code)
    || /UFUNCTION\s*\([^)]*\bServer\b/.test(code);
}

function checkConstraints(system, ids) {
  const locks = knownLocks(ids);
  const header = system?.cpp_header || "";
  const source = system?.cpp_source || "";
  const violations = [];
  if (locks.includes("no_tick") && hasTick(header, source)) {
    violations.push({
      id: "no_tick",
      severity: "error",
      file: ".cpp",
      line: null,
      message: "No Tick is locked, and this system still has a Tick function.",
      fix: "Remove Tick and TickComponent. Use a timer or an event instead.",
    });
  }
  if (locks.includes("server_authority") && !hasAuthority(header, source)) {
    violations.push({
      id: "server_authority",
      severity: "error",
      file: ".cpp",
      line: null,
      message: "Server authority is locked, and the code never checks HasAuthority or uses a Server RPC.",
      fix: "Write gameplay state on the server, or mark the function as a Server RPC.",
    });
  }
  return violations;
}

module.exports = { LOCKS, knownLocks, constraintText, checkConstraints, hasTick };
