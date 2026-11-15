// Client helpers for the bundled library. The cards and the Start Here
// system live on the local server. These rules match desktop/references.js.

export const LS_INTRO = "ue5_architect_intro_seen";

export const INTRO = {
  is: "This is a UE5 architecture and learning tool.",
  isnt: "It is not a full game generator. Review the code before you ship it.",
};

export function introSeen(storage) {
  try { return storage.getItem(LS_INTRO) === "1"; }
  catch { return false; }
}

export function markIntroSeen(storage) {
  try { storage.setItem(LS_INTRO, "1"); }
  catch { /* a blocked store should not trap the welcome */ }
}

export function resolveConcept(concepts, id) {
  const key = String(id || "").trim();
  if (!key || !Array.isArray(concepts)) return null;
  return concepts.find((card) => card?.id === key || (Array.isArray(card?.aliases) && card.aliases.includes(key))) || null;
}

export function keyDecisions(system) {
  const notes = system?.learning?.why_notes;
  if (!Array.isArray(notes)) return [];
  return notes
    .map((note) => ({
      id: note?.id || "",
      decision: String(note?.one_line || ""),
      tradeoff: String(note?.tradeoff || ""),
      concept_id: String(note?.concept_id || ""),
      concept_title: String(note?.concept_title || ""),
    }))
    .filter((item) => item.decision);
}

export function exampleById(examples, id) {
  if (!Array.isArray(examples)) return null;
  return examples.find((item) => item?.id === id) || null;
}
