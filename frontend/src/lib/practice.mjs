// Same rules as desktop/practice.js, for the workspace. Answering a challenge
// never calls the model. Minimal never shows the Predict card.

export const LS_DRAFT = "ue5_architect_workspace_draft";

export function shouldShowPredict(level) {
  return level === "learning";
}

export function saveWorkspace(storage, draft, reveal, learnIndex = 0) {
  storage.setItem(LS_DRAFT, JSON.stringify({ draft, reveal: reveal || null, learnIndex }));
}

export function loadWorkspace(storage) {
  try {
    const raw = storage.getItem(LS_DRAFT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function readyChallenge(challenge, system) {
  if (!challenge) return null;
  const choices = Array.isArray(challenge.choices) && challenge.choices.length >= 2
    ? challenge.choices
    : [challenge.detail || "The component owns this behaviour.", "It is checked on Tick every frame."];
  const node = system?.node_graph_nodes?.[0];
  return {
    ...challenge,
    prompt: challenge.prompt || `What follows from “${challenge.title}”?`,
    choices,
    answer: Number.isInteger(challenge.answer) ? challenge.answer : 0,
    why_people_pick: challenge.why_people_pick || "The other choice looks simpler, but it does more work than this system needs.",
    reveal: challenge.reveal || {
      node_ids: node ? [node.id] : [],
      lines: parameterLines(system, system?.tunable_parameters?.[0]?.key),
      why_id: node?.id || "",
    },
    related: challenge.related || null,
  };
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

export function parameterLines(system, key) {
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

export function challengesOf(system) {
  const list = system?.learning?.challenges;
  return Array.isArray(list) ? list : [];
}

export function whatIfsOf(system) {
  const list = system?.learning?.what_ifs;
  return Array.isArray(list) ? list.filter((item) => item?.variants?.length >= 2) : [];
}

export function impactLines(system, key) {
  const listed = system?.learning?.parameter_impacts?.find((item) => item.key === key)?.lines;
  if (Array.isArray(listed) && listed.length) return listed;
  return parameterLines(system, key);
}
