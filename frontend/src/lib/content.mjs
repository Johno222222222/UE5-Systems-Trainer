// Same concept ids as desktop/content.js. Cards themselves come from the server.

export const CONCEPT_ALIASES = {
  hitstop: "tick-vs-timers",
  "line-traces": "tick-vs-timers",
  perception: "tick-vs-timers",
  timers: "tick-vs-timers",
  interfaces: "interface-vs-cast",
  focus: "interface-vs-cast",
  "ui-data": "data-assets",
  "data-tables": "data-assets",
  "designer-defaults": "data-assets",
  queries: "data-assets",
  "inventory-rules": "data-assets",
  blackboards: "data-assets",
  "combo-state": "components-vs-inheritance",
  "chaos-vehicles": "components-vs-inheritance",
  components: "components-vs-inheritance",
  gears: "components-vs-inheritance",
  "ai-states": "components-vs-inheritance",
  gas: "gameplay-tags",
  "animation-notifies": "animation-notifies",
  "save-games": "save-games",
  "async-save": "save-games",
  "quest-state": "save-games",
};

export const ABOUT = {
  is: "A UE5 architecture and learning tool. It helps you shape a system, see why it is built that way, and practice the decisions.",
  isnt: "Not a full game generator. The code needs review before you ship it.",
};

export function resolveConcept(cards, id) {
  if (!id) return null;
  const key = CONCEPT_ALIASES[id] || id;
  return (cards || []).find((card) => card.id === key) || null;
}
