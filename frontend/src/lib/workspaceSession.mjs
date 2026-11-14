// App-level copy of the workspace the user is in the middle of.
// Tools reads this when it mounts and writes it back on every change,
// so leaving Tools does not throw the work away.

import { isWorkspaceDirty, resultSignature, workspaceSnapshot } from "./stage0.mjs";

export function createWorkspaceSession(initial = null) {
  let draft = initial;
  const listeners = new Set();
  const notify = () => {
    for (const fn of listeners) fn(draft);
  };
  return {
    get() {
      return draft;
    },
    replace(next) {
      const same = (draft == null && next == null)
        || (draft != null && next != null && JSON.stringify(draft) === JSON.stringify(next));
      if (same) return false;
      draft = next;
      notify();
      return true;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

// The fields a section switch has to keep. Dials, the synthesized system,
// notes, references, parameter sliders, modules, setup ticks, and the
// target Unreal version are all in here.
export const DRAFT_FIELDS = [
  "prompt",
  "bpClass",
  "complexity",
  "modularity",
  "perfFlex",
  "tickRate",
  "replicated",
  "extra",
  "newExtra",
  "result",
  "previousResult",
  "notes",
  "projectContext",
  "unrealVersion",
  "setupDone",
  "tunable",
  "baseline",
  "project",
  "references",
  "ignores",
  "fixNotes",
  "fixLog",
  "tab",
];

export function pickDraft(source) {
  const out = {};
  for (const key of DRAFT_FIELDS) out[key] = source[key];
  return out;
}

export function draftToSnapshotInput(draft) {
  const current = draft || {};
  return {
    prompt: current.prompt,
    blueprint_class: current.bpClass,
    complexity: current.complexity,
    modularity: current.modularity,
    performance_vs_flexibility: current.perfFlex,
    tick_rate: current.tickRate,
    network_replicated: current.replicated,
    extra: current.extra,
    notes: current.notes,
    new_extra: current.newExtra,
    project_context: current.projectContext,
    references: current.references,
    setup_done: current.setupDone,
    unreal_version: current.unrealVersion,
    result_sig: resultSignature(current.result, current.tunable),
    project_id: current.project?.project_id || null,
  };
}

export function isDraftDirty(draft) {
  if (!draft?.baseline) return false;
  return isWorkspaceDirty(draftToSnapshotInput(draft), draft.baseline);
}

// Same picture Save stores, so the unsaved dot clears after a successful save.
export function markDraftSaved(draft) {
  return {
    ...draft,
    baseline: workspaceSnapshot(draftToSnapshotInput(draft)),
  };
}

export function systemChip(draft) {
  const name = draft?.project?.name || draft?.result?.system_name || "Unsaved system";
  return {
    name,
    unsaved: isDraftDirty(draft),
    projectId: draft?.project?.project_id || null,
  };
}

export function openItemFromDraft(draft) {
  if (!draft) return null;
  const chip = systemChip(draft);
  return { kind: "system", id: chip.projectId, label: chip.name };
}
