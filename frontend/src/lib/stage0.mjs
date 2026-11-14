// Stage 0 helpers shared by the workspace and the node tests.
// The server keeps its own copy of the version list in desktop/logic.js.
// desktop/test/stage0.test.js checks the two lists still match.

export const UNREAL_VERSIONS = ["5.4", "5.5", "5.6", "5.7", "5.8"];
export const DEFAULT_UNREAL_VERSION = "5.8";
export const LEGACY_UNREAL_VERSION = "5.4";
export const GITHUB_REPO = "Johno222222222/blueprint-builder";
export const FEEDBACK_CATEGORIES = ["Bug", "Idea", "Question"];

export const LS_CONTEXT = "ue5_architect_project_context";
export const LS_UNREAL_VERSION = "ue5_architect_unreal_version";

export function normalizeUnrealVersion(value) {
  const raw = String(value ?? "").trim().replace(/^UE\s*/i, "").replace(/\+$/, "");
  return UNREAL_VERSIONS.includes(raw) ? raw : null;
}

export function setupDoneList(map) {
  return Object.entries(map || {})
    .filter(([, on]) => on)
    .map(([key]) => Number(key))
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);
}

export function setupDoneMap(list) {
  const out = {};
  for (const n of list || []) {
    const step = Number(n);
    if (Number.isInteger(step) && step > 0) out[step] = true;
  }
  return out;
}

export function resultSignature(result, tunable) {
  if (!result) return "";
  const params = (result.tunable_parameters || [])
    .map((p) => `${p.key}:${tunable && tunable[p.key] !== undefined ? tunable[p.key] : p.value}`)
    .join(",");
  const modules = (result.modules || []).map((m) => `${m.name}:${m.included ? 1 : 0}`).join(",");
  return [
    result.id || "",
    result.cpp_header || "",
    result.cpp_source || "",
    result.blueprint_pseudocode || "",
    params,
    modules,
  ].join("\n");
}

// A stable picture of the workspace. New project compares against this.
export function workspaceSnapshot(input) {
  const references = [...(input.references || [])]
    .map((item) => (typeof item === "string" ? item : item?.file_id))
    .filter(Boolean)
    .sort();
  return {
    prompt: String(input.prompt ?? ""),
    blueprint_class: input.blueprint_class || "ActorComponent",
    complexity: Number(input.complexity),
    modularity: Number(input.modularity),
    performance_vs_flexibility: Number(input.performance_vs_flexibility),
    tick_rate: Number(input.tick_rate),
    network_replicated: !!input.network_replicated,
    extra: [...(input.extra || [])].map(String).sort(),
    notes: String(input.notes ?? ""),
    new_extra: String(input.new_extra ?? "").trim(),
    project_context: String(input.project_context ?? ""),
    references,
    setup_done: setupDoneList(Array.isArray(input.setup_done) ? setupDoneMap(input.setup_done) : input.setup_done),
    unreal_version: normalizeUnrealVersion(input.unreal_version) || DEFAULT_UNREAL_VERSION,
    result_sig: String(input.result_sig ?? ""),
    project_id: input.project_id || null,
  };
}

export function isWorkspaceDirty(current, baseline) {
  return JSON.stringify(workspaceSnapshot(current)) !== JSON.stringify(workspaceSnapshot(baseline));
}

export const DIAL_DEFAULTS = {
  prompt: "",
  blueprint_class: "ActorComponent",
  complexity: 55,
  modularity: 75,
  performance_vs_flexibility: 50,
  tick_rate: 30,
  network_replicated: false,
};

export function blankSnapshot({ project_context = "", unreal_version = DEFAULT_UNREAL_VERSION } = {}) {
  return workspaceSnapshot({
    ...DIAL_DEFAULTS,
    project_context,
    unreal_version,
    extra: [],
    notes: "",
    new_extra: "",
    references: [],
    setup_done: [],
    result_sig: "",
    project_id: null,
  });
}

// Save adds a version only when a project is open and the user can edit it.
// After New project, project_id is null, so the next save creates a project.
export function saveRequest(projectId, readOnly) {
  return projectId && !readOnly ? "update" : "create";
}

export function compileHeadline(patternIssues, ai) {
  const list = Array.isArray(patternIssues) ? patternIssues : [];
  const status = ai && ai.status;
  const aiIssues = status === "done" && Array.isArray(ai.issues) ? ai.issues : [];
  const all = [...list, ...aiIssues];
  const errors = all.filter((issue) => issue.severity === "error").length;
  const warnings = all.length - errors;
  const count = `${errors} error${errors === 1 ? "" : "s"} · ${warnings} warning${warnings === 1 ? "" : "s"}`;
  if (status === "running") {
    return {
      text: all.length ? `${count} · AI review running` : "Pattern check is clean · AI review running",
      clean: false,
      errors,
      warnings,
    };
  }
  if (status === "error") {
    return {
      text: all.length ? `${count} · AI review failed` : "Pattern check is clean · AI review failed",
      clean: false,
      errors,
      warnings,
    };
  }
  if (all.length === 0) {
    return { text: "No likely mistakes found", clean: true, errors: 0, warnings: 0 };
  }
  return { text: count, clean: false, errors, warnings };
}

export function feedbackUrl({ repo = GITHUB_REPO, version = "0.0.0", category = "Bug" } = {}) {
  const title = `[${category}] `;
  const body = `App version: ${version}\nCategory: ${category}\n\nWhat happened:\n\nWhat you expected:\n\n`;
  return `https://github.com/${repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}
