"use strict";

// Stage 2 teaching data. Optional on a system, so a project saved before
// this stage still opens. The learning pass fills it after the system exists.

const LEARNING_PROMPT = `You are teaching a game developer who just received a finished Unreal system. The code is already written. Do not rewrite it.
Respond with ONLY a raw JSON object, no markdown, matching this shape:
{
  "challenges": [{"title":"short","detail":"one or two sentences"}],
  "why_notes": [{
    "anchor": {"kind":"node","node_id":"n1"},
    "one_line":"one sentence a designer can read at a glance",
    "tradeoff":"what you give up by doing it this way",
    "common_mistake":"the mistake people make here",
    "concept_id":"kebab-case-id",
    "concept_title":"Short Concept Name"
  }],
  "parameter_effects": [{"key":"max_health","effect":"what changing this value changes in the system"}],
  "prerequisites": ["short topic"],
  "complexity": "beginner",
  "related_concepts": [{"id":"kebab-case-id","title":"Short Concept Name"}],
  "traps": [{"title":"Common trap name","detail":"why this pattern hurts in Unreal"}],
  "module_notes": [{"name":"ModuleName","note":"what adding or removing this module changes architecturally"}]
}
Rules:
- At least 2 challenges.
- One parameter_effects entry for every parameter key you are given, using that exact key.
- why_notes: at least 3 whose anchor.kind is "node" and at least 2 whose anchor.kind is "cpp".
- A node anchor uses a node id from the list you are given. A cpp anchor is {"kind":"cpp","file":".h" or ".cpp","line":N} and N is a line number that exists in that file.
- complexity is "beginner", "intermediate", or "advanced".
- traps should name real Unreal mistakes when they apply, such as Tick overuse, Cast instead of Interface, or Get All Actors every frame.
- one_line is a single sentence. tradeoff and common_mistake are one or two sentences.`;

function asList(value) {
  return Array.isArray(value) ? value.filter((item) => item && typeof item === "object") : [];
}

function text(value, max) {
  return String(value || "").trim().slice(0, max);
}

function lineCount(value) {
  const src = String(value || "");
  if (!src) return 0;
  return src.split("\n").length;
}

function knownNodeIds(system) {
  return new Set((system?.node_graph_nodes || []).map((node) => node?.id).filter(Boolean));
}

function anchorOk(anchor, system) {
  if (!anchor || typeof anchor !== "object") return false;
  if (anchor.kind === "node") return knownNodeIds(system).has(anchor.node_id);
  if (anchor.kind === "cpp") {
    const file = anchor.file === ".cpp" ? "cpp_source" : anchor.file === ".h" ? "cpp_header" : "";
    const line = Number(anchor.line);
    if (!file || !Number.isInteger(line) || line < 1) return false;
    return line <= lineCount(system?.[file]);
  }
  return false;
}

function normalizeWhy(raw, system) {
  const notes = [];
  asList(raw).forEach((note, index) => {
    if (!anchorOk(note.anchor, system)) return;
    const one = text(note.one_line, 220);
    if (!one) return;
    const anchor = note.anchor.kind === "node"
      ? { kind: "node", node_id: String(note.anchor.node_id) }
      : { kind: "cpp", file: note.anchor.file === ".cpp" ? ".cpp" : ".h", line: Number(note.anchor.line) };
    notes.push({
      id: text(note.id, 40) || `why-${index + 1}`,
      anchor,
      one_line: one,
      tradeoff: text(note.tradeoff, 400),
      common_mistake: text(note.common_mistake, 400),
      concept_id: text(note.concept_id, 60) || "concept",
      concept_title: text(note.concept_title, 80) || "Related concept",
    });
  });
  return notes;
}

function learningGaps(raw, system) {
  const gaps = [];
  const challenges = asList(raw?.challenges).filter((item) => text(item.title, 120));
  if (challenges.length < 2) gaps.push("at least 2 challenges");
  const effects = new Set(asList(raw?.parameter_effects).map((item) => text(item.key, 60)).filter(Boolean));
  for (const param of system?.tunable_parameters || []) {
    if (param?.key && !effects.has(String(param.key))) gaps.push(`an effect note for parameter ${param.key}`);
  }
  return gaps;
}

function fillLearning(raw, system) {
  const challenges = asList(raw?.challenges)
    .map((item) => ({ title: text(item.title, 120), detail: text(item.detail, 400) }))
    .filter((item) => item.title);
  const name = text(system?.system_name, 80) || "This system";
  while (challenges.length < 2) {
    const n = challenges.length + 1;
    challenges.push({
      title: n === 1 ? `Where ${name} should live` : `What ${name} should not do`,
      detail: n === 1
        ? "Decide which actor owns this behaviour before you add it to a Blueprint."
        : "Keep this component from reaching into unrelated actors every frame.",
    });
  }
  const effects = asList(raw?.parameter_effects)
    .map((item) => ({ key: text(item.key, 60), effect: text(item.effect, 400) }))
    .filter((item) => item.key && item.effect);
  const have = new Set(effects.map((item) => item.key));
  for (const param of system?.tunable_parameters || []) {
    const key = text(param?.key, 60);
    if (!key || have.has(key)) continue;
    effects.push({
      key,
      effect: `Changes the default for ${text(param.label, 60) || key} in the generated component.`,
    });
    have.add(key);
  }
  const complexity = ["beginner", "intermediate", "advanced"].includes(raw?.complexity) ? raw.complexity : "intermediate";
  return {
    challenges: challenges.slice(0, 8),
    why_notes: normalizeWhy(raw?.why_notes, system).slice(0, 16),
    parameter_effects: effects.slice(0, 20),
    prerequisites: (Array.isArray(raw?.prerequisites) ? raw.prerequisites : []).map((item) => text(item, 80)).filter(Boolean).slice(0, 8),
    complexity,
    related_concepts: asList(raw?.related_concepts)
      .map((item) => ({ id: text(item.id, 60), title: text(item.title, 80) }))
      .filter((item) => item.id && item.title)
      .slice(0, 8),
    traps: asList(raw?.traps)
      .map((item) => ({ title: text(item.title, 80), detail: text(item.detail, 400) }))
      .filter((item) => item.title && item.detail)
      .slice(0, 6),
    module_notes: asList(raw?.module_notes)
      .map((item) => ({ name: text(item.name, 80), note: text(item.note, 400) }))
      .filter((item) => item.name && item.note)
      .slice(0, 12),
  };
}

function learningUserText(system, unrealVersion) {
  const nodes = (system?.node_graph_nodes || []).map((node) => `${node.id}: ${node.label || node.node_type || "node"}`).join("\n") || "(no nodes)";
  const params = (system?.tunable_parameters || []).map((param) => `${param.key}: ${param.label || param.key}`).join("\n") || "(no parameters)";
  const modules = (system?.modules || []).map((mod) => mod.name).filter(Boolean).join(", ") || "(none)";
  const numbered = (src) => String(src || "").split("\n").map((line, i) => `${i + 1}|${line}`).join("\n");
  return `Target Unreal version: UE ${unrealVersion || "5.8"}
System: ${system?.system_name || "System"}
Summary: ${system?.summary || ""}
Modules: ${modules}

NODE IDS (use these exact ids):
${nodes}

PARAMETER KEYS (one effect each):
${params}

HEADER with line numbers:
${numbered(system?.cpp_header)}

SOURCE with line numbers:
${numbered(system?.cpp_source)}

Write the teaching JSON now.`;
}

function numberOf(fileText, line) {
  const rows = String(fileText || "").split("\n");
  return line >= 1 && line <= rows.length && String(rows[line - 1]).trim() ? true : false;
}

// Used by the template bundle and the tests. Throws if a note points at nothing.
function assertLearningAnchors(system) {
  const learning = system?.learning;
  if (!learning) throw new Error("missing learning");
  const nodes = (learning.why_notes || []).filter((note) => note.anchor?.kind === "node");
  const cpp = (learning.why_notes || []).filter((note) => note.anchor?.kind === "cpp");
  if (nodes.length < 3) throw new Error(`need 3 graph notes, have ${nodes.length}`);
  if (cpp.length < 2) throw new Error(`need 2 C++ notes, have ${cpp.length}`);
  const ids = knownNodeIds(system);
  for (const note of nodes) {
    if (!ids.has(note.anchor.node_id)) throw new Error(`missing node ${note.anchor.node_id}`);
  }
  for (const note of cpp) {
    const file = note.anchor.file === ".cpp" ? system.cpp_source : system.cpp_header;
    if (!numberOf(file, note.anchor.line)) throw new Error(`missing ${note.anchor.file} line ${note.anchor.line}`);
  }
  if ((learning.challenges || []).length < 2) throw new Error("need 2 challenges");
  const effects = new Set((learning.parameter_effects || []).map((item) => item.key));
  for (const param of system.tunable_parameters || []) {
    if (!effects.has(param.key)) throw new Error(`missing effect ${param.key}`);
  }
  return true;
}

module.exports = {
  LEARNING_PROMPT,
  learningGaps,
  fillLearning,
  learningUserText,
  normalizeWhy,
  assertLearningAnchors,
};
