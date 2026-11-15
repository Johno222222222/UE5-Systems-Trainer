// What the workspace shows for each help level. The default is Learning.
// Minimal makes no learning-pass request.

export const HELP_LEVELS = ["learning", "standard", "minimal"];
export const LS_HELP = "ue5_architect_help_level";

export function normalizeHelpLevel(value) {
  return HELP_LEVELS.includes(value) ? value : "learning";
}

export function shouldRunLearningPass(level) {
  return normalizeHelpLevel(level) !== "minimal";
}

export function createHelpLevelStore(storage) {
  return {
    get() {
      try { return normalizeHelpLevel(storage.getItem(LS_HELP)); }
      catch { return "learning"; }
    },
    set(value) {
      const next = normalizeHelpLevel(value);
      storage.setItem(LS_HELP, next);
      return next;
    },
  };
}

export function readLearning(system) {
  const learning = system?.learning;
  if (!learning || typeof learning !== "object" || Array.isArray(learning)) return null;
  return learning;
}

export function visibleWhyNotes(system, level) {
  if (normalizeHelpLevel(level) === "minimal") return [];
  const learning = readLearning(system);
  return Array.isArray(learning?.why_notes) ? learning.why_notes : [];
}

export function whyForNode(system, level, nodeId) {
  return visibleWhyNotes(system, level).filter((note) => note?.anchor?.kind === "node" && note.anchor.node_id === nodeId);
}

export function whyForCpp(system, level, file) {
  return visibleWhyNotes(system, level).filter((note) => note?.anchor?.kind === "cpp" && note.anchor.file === file);
}

export function showWhyDepth(level) {
  return normalizeHelpLevel(level) === "learning";
}

export function showChallenges(level) {
  return normalizeHelpLevel(level) === "learning";
}

export function showTraps(level) {
  return normalizeHelpLevel(level) === "learning";
}

export function showModuleNotes(level) {
  return normalizeHelpLevel(level) !== "minimal";
}

export function moduleNote(system, level, name) {
  if (!showModuleNotes(level)) return "";
  const notes = readLearning(system)?.module_notes || [];
  const found = notes.find((item) => item?.name === name);
  return found?.note || "";
}

export function parameterEffect(system, level, key) {
  if (normalizeHelpLevel(level) === "minimal") return "";
  const notes = readLearning(system)?.parameter_effects || [];
  const found = notes.find((item) => item?.key === key);
  return found?.effect || "";
}
