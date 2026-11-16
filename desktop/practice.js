"use strict";

// Stage 3 practice rules. Answering a challenge never calls the model.
// Old systems that have no practice fields still get a usable question.

function shouldShowPredict(level) {
  return level === "learning";
}

function findLine(text, needles) {
  const rows = String(text || "").split("\n");
  for (const needle of needles) {
    if (!needle) continue;
    const at = rows.findIndex((row) => row.toLowerCase().includes(String(needle).toLowerCase()));
    if (at >= 0) return at + 1;
  }
  return 0;
}

function searchNeedles(key, label) {
  const needles = [key, label];
  if (key && String(key).includes("_")) {
    const parts = String(key).split("_").filter(Boolean);
    needles.push(parts.join(""));
    needles.push(parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(""));
  }
  return needles.filter(Boolean);
}

function parameterLines(system, key) {
  if (!system || !key) return [];
  const param = (system.tunable_parameters || []).find((item) => item.key === key);
  const needles = searchNeedles(key, param?.label);
  const lines = [];
  const headerLine = findLine(system.cpp_header, needles);
  const sourceLine = findLine(system.cpp_source, needles);
  if (headerLine) lines.push({ file: ".h", line: headerLine });
  if (sourceLine) lines.push({ file: ".cpp", line: sourceLine });
  if (!lines.length && system.cpp_header) lines.push({ file: ".h", line: 1 });
  return lines;
}

function defaultReveal(system) {
  const node = (system?.node_graph_nodes || [])[0];
  const lines = parameterLines(system, system?.tunable_parameters?.[0]?.key);
  return {
    node_ids: node ? [node.id] : [],
    lines,
    why_id: node ? node.id : "",
  };
}

function defaultRelated(system, index) {
  const param = (system?.tunable_parameters || [])[index] || (system?.tunable_parameters || [])[0];
  if (param?.key) return { kind: "parameter", key: param.key, label: param.label || param.key };
  const mod = (system?.modules || [])[index] || (system?.modules || [])[0];
  if (mod?.name) return { kind: "module", name: mod.name };
  return null;
}

function defaultWhatIf(system) {
  const source = String(system?.cpp_source || "void Run() {\n  Work();\n}\n");
  return {
    title: "Tick vs timer",
    variants: [
      { id: "timer", label: "Timer", code: source },
      { id: "tick", label: "Tick", code: "void Tick(float DeltaTime) {\n  Work(); // runs every frame\n}\n" },
    ],
  };
}

function ensurePractice(learning, system) {
  const base = learning && typeof learning === "object" ? learning : {};
  const challenges = (Array.isArray(base.challenges) ? base.challenges : []).map((item, index) => {
    const title = String(item?.title || `Question ${index + 1}`).slice(0, 120);
    const detail = String(item?.detail || "").slice(0, 400);
    const choices = Array.isArray(item?.choices) && item.choices.length >= 2
      ? item.choices.slice(0, 3).map((choice) => String(choice).slice(0, 240))
      : [detail || "The owner of this behaviour does the work.", "It is checked on Tick every frame."];
    const answer = Number.isInteger(item?.answer) && item.answer >= 0 && item.answer < choices.length ? item.answer : 0;
    return {
      title,
      detail,
      prompt: String(item?.prompt || `What follows from “${title}”?`).slice(0, 240),
      choices,
      answer,
      why_people_pick: String(item?.why_people_pick || "The other choice looks simpler, but it does more work than this system needs.").slice(0, 400),
      reveal: item?.reveal && typeof item.reveal === "object" ? item.reveal : defaultReveal(system),
      related: item?.related && typeof item.related === "object" ? item.related : defaultRelated(system, index),
    };
  });
  const impacts = Array.isArray(base.parameter_impacts) ? base.parameter_impacts : [];
  const parameter_impacts = (system?.tunable_parameters || []).map((param) => {
    const found = impacts.find((item) => item?.key === param.key);
    const lines = Array.isArray(found?.lines) && found.lines.length ? found.lines : parameterLines(system, param.key);
    return { key: param.key, lines };
  });
  const what_ifs = Array.isArray(base.what_ifs) && base.what_ifs[0]?.variants?.length >= 2
    ? base.what_ifs.slice(0, 2)
    : [defaultWhatIf(system)];
  return { ...base, challenges, parameter_impacts, what_ifs };
}

function emptyProgress() {
  return { answered: [], practiced: [] };
}

function recordAnswer(progress, entry) {
  const current = progress && typeof progress === "object" ? progress : emptyProgress();
  const answered = Array.isArray(current.answered) ? current.answered.slice() : [];
  const id = `${entry.system_name || "system"}:${entry.challenge_index}`;
  const next = {
    id,
    system_name: String(entry.system_name || "System").slice(0, 120),
    project_id: entry.project_id || null,
    challenge_index: Number(entry.challenge_index) || 0,
    correct: !!entry.correct,
    asset: String(entry.asset || "").slice(0, 180),
    at: entry.at || new Date().toISOString(),
  };
  const without = answered.filter((item) => item.id !== id);
  without.push(next);
  const practiced = Array.isArray(current.practiced) ? current.practiced.slice() : [];
  const prior = practiced.find((item) => item.system_name === next.system_name);
  const rest = practiced.filter((item) => item.system_name !== next.system_name);
  rest.unshift({
    system_name: next.system_name,
    project_id: next.project_id,
    count: (prior?.count || 0) + 1,
    at: next.at,
  });
  return { answered: without, practiced: rest.slice(0, 40) };
}

function continueCards(progress) {
  const practiced = Array.isArray(progress?.practiced) ? progress.practiced : [];
  return practiced.slice(0, 4).map((item) => ({
    system_name: item.system_name,
    project_id: item.project_id || null,
    count: item.count || 1,
    label: `Continue ${item.system_name}`,
  }));
}

module.exports = {
  shouldShowPredict,
  parameterLines,
  ensurePractice,
  emptyProgress,
  recordAnswer,
  continueCards,
};
