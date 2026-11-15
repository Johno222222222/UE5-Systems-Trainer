// Stage 1 shell. The bar only shows sections with exists: true.
// A later stage adds a section by flipping that flag (and giving it a screen).

import { systemChip } from "./workspaceSession.mjs";

export const APP_VERSION = "1.13.0";

export const SECTION_REGISTRY = [
  { id: "home", label: "Home", exists: true, screen: "home", acceptsSystem: false },
  { id: "tools", label: "Tools", exists: true, screen: "tools", acceptsSystem: true },
  { id: "learn", label: "Learn", exists: true, screen: "learn", acceptsSystem: true },
  { id: "references", label: "References", exists: true, screen: "references", acceptsSystem: true },
  { id: "glossary", label: "Glossary", exists: true, screen: "glossary", acceptsSystem: false },
  { id: "programs", label: "Programs", exists: true, screen: "programs", acceptsSystem: false },
  { id: "courses", label: "Courses", exists: true, screen: "courses", acceptsSystem: false },
  { id: "community", label: "Community", exists: true, screen: "community", acceptsSystem: false },
];

export const EMPTY_ACTIONS = [
  { id: "start-new", label: "Start new" },
  { id: "load-saved", label: "Load saved" },
  { id: "browse", label: "Browse" },
];

export const RECENT_PROMINENT = 5;

export function visibleSections(registry = SECTION_REGISTRY) {
  return registry.filter((section) => section.exists);
}

export function sectionById(id, registry = SECTION_REGISTRY) {
  return registry.find((section) => section.id === id) || null;
}

// "Open in…" only when a second section can take the current system.
// With just Tools, this is empty and the menu stays hidden.
export function openInTargets(registry = SECTION_REGISTRY, currentId = null) {
  const acceptors = registry.filter((section) => section.exists && section.acceptsSystem);
  if (acceptors.length < 2) return [];
  return acceptors.filter((section) => section.id !== currentId);
}

export function sectionScreen(section, memory) {
  if (!section?.exists) return "missing";
  if (section.screen === "home" || section.screen === "tools" || section.screen === "learn" || section.screen === "references" || section.screen === "glossary" || section.screen === "programs" || section.screen === "courses" || section.screen === "community") return section.screen;
  return memory?.[section.id] ? "remembered" : "empty";
}

export function rememberOpen(memory, sectionId, item) {
  return { ...(memory || {}), [sectionId]: item || null };
}

// Leave one section and open another without dropping what the first had open.
export function switchSection(state, nextId) {
  const memory = { ...(state.memory || {}) };
  if (state.section && state.section !== nextId && state.openItem) {
    memory[state.section] = state.openItem;
  }
  return { section: nextId, memory };
}

export function rankProjects(projects, prominent = RECENT_PROMINENT) {
  const sorted = [...(projects || [])].sort((a, b) => {
    const byTime = String(b.updated_at || "").localeCompare(String(a.updated_at || ""));
    if (byTime !== 0) return byTime;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
  return {
    prominent: sorted.slice(0, prominent),
    rest: sorted.slice(prominent),
    last: sorted[0] || null,
  };
}

export { systemChip };
