"use strict";

// Prompts, output cleanup, and patch application.
// These follow the behavior of the previous Python service so the workspace
// keeps getting the same kind of system, review, fix, and test replies.

const crypto = require("crypto");

const ALLOWED_MODELS = {
  gemini: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-3.1-pro-preview"],
  openai: ["gpt-4.1-mini", "gpt-4.1", "gpt-5-mini"],
};

const DEFAULT_PROVIDER = "gemini";
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

// Approximate free-tier requests per day. Google resets at midnight Pacific.
// This is a local hint for the usage chip, not an account limit.
const FREE_DAILY = {
  "gemini-3.5-flash-lite": 500,
  "gemini-3.1-flash-lite": 500,
  "gemini-3.8-flash": 250,
  "gemini-3.1-pro-preview": 0,
};

const PAID_MODEL_MSG = "{model} needs a paid API key, and this key is on the free tier. Switch back to Gemini 3.5 Flash-Lite, which works free.";

const SYSTEM_PROMPT = `You are an elite Unreal Engine 5 systems architect. Given a user's system description, you emit a compact, production-ready modular architecture for UE 5.4+.

Respond with ONLY a single raw JSON object (no markdown, no code fences, no prose) matching this schema:

{
  "system_name": "Short Title Case Name",
  "summary": "1-2 sentence description of what this system does",
  "tunable_parameters": [{"key":"max_health","label":"Max Health","value":100,"min":1,"max":1000,"step":1,"unit":"HP"}],
  "modules": [{"name":"StaminaDrain","included":true,"description":"short desc"}],
  "blueprint_pseudocode": "Event BeginPlay\\n  -> Set Health = MaxHealth\\n  WHY: <reason for this specific decision>\\n  -> Bind OnTakeDamage -> HandleDamage",
  "cpp_header": "// Name.h — compilable UE5 header with UCLASS, UPROPERTY, UFUNCTION",
  "cpp_source": "// Name.cpp — matching implementation",
  "setup_guide": [{"step":1,"title":"Create Blueprint","detail":"short detail","why":"short reason this step/approach was chosen"}],
  "node_graph_nodes": [{"id":"n1","label":"Event BeginPlay","node_type":"event","x":80,"y":120,"inputs":[],"outputs":["exec"]}],
  "node_graph_edges": [{"from_node":"n1","to_node":"n2","kind":"exec"}],
  "network_notes": "Short replication notes.",
  "applied_changes": ["One line per REQUESTED CHANGE stating exactly how it was applied"],
  "shared_attributes": ["Only when stacking: attributes/interfaces shared between the stacked systems"]
}

Rules:
- node_type ∈ {event, function, variable, flow, pure}. Produce 6-9 nodes laid out left-to-right (x ∈ [40,1200], y ∈ [60,560], ~220px x-spacing, ~120px y-spacing). 4-7 edges. edge.kind = "exec" or "data".
- 4-6 setup_guide steps (keep detail <= 140 chars).
- 3-5 tunable_parameters with sensible min/max/step/unit.
- 3-5 modules. Include any user-added names (included:true) and any user-removed names (included:false).
- Never copy example text from this schema (e.g. the sample WHY line); every WHY must explain a decision specific to this system.
- system_name is human-readable Title Case with spaces (e.g. "Health And Damage Component").
- C++: use #include "CoreMinimal.h", GENERATED_BODY(), UCLASS(), UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="X"), UFUNCTION(BlueprintCallable). Each file must be 50-120 real lines (not counting blank lines): declare every tunable parameter as a UPROPERTY, every module's functions, delegates and events, and implement them fully in the .cpp. Add UPROPERTY(Replicated) + GetLifetimeReplicatedProps ONLY if network_replicated is true.
- LEARNING ANNOTATIONS: in blueprint_pseudocode, after 3-5 key decisions add an indented line starting with "WHY:" (e.g. "WHY: Replicated because state must match across all clients", "WHY: Data Asset used so designers can tweak without recompiling"). Every setup_guide step gets a "why" (<= 110 chars).
- If PROJECT CONTEXT is given, every design decision must fit it.
- If a PREVIOUS SYSTEM and REQUESTED CHANGES are given: this is a revision. Keep everything from the previous system that is not affected, apply EVERY requested change exactly (parameter values, module removals/additions, dial shifts, designer notes), and list one applied_changes entry per requested change in the same order. Otherwise applied_changes is [].
- If STACKED SYSTEMS are given: merge them into ONE integrated system. Unify duplicated attributes into a single owner (e.g. one Health attribute used by both), route cross-system calls through interfaces or delegates, rename anything that collides, and list shared_attributes. Record each conflict resolved as an applied_changes entry starting with "Conflict resolved:". Otherwise shared_attributes is [].
- Output raw JSON only, starting with { and ending with }.`;

const REVIEW_PROMPT = `You are a strict Unreal Engine 5.4 C++ compile reviewer. Find problems in the given .h/.cpp pair that would make it fail to compile, fail Unreal Header Tool, or fail to link: missing #includes, names that don't match between files, wrong or missing signatures, functions declared but not defined, UCLASS/UPROPERTY/UFUNCTION macro mistakes, wrong Super:: calls, replication mistakes, wrong engine API usage.
Only report real problems, never style. Do not repeat issues already listed under KNOWN ISSUES.
Respond with ONLY raw JSON: {"issues":[{"severity":"error","file":".h","line":12,"message":"what is wrong","fix":"how to fix it"}]}
severity is "error" (will not build) or "warning" (likely wrong at runtime). file is ".h" or ".cpp". line may be null. At most 12 issues. If the code looks fine, return {"issues":[]}.`;

const FIX_PROMPT = `You are an Unreal Engine 5.4 C++ fixer. You get a .h/.cpp pair and a list of ISSUES. Fix exactly those issues with the smallest possible edits. Do not rewrite, reformat or rename anything else.
Respond with ONLY raw JSON:
{"edits":[{"file":".h","find":"exact text copied from the file","replace":"new text","why":"which issue this fixes, in a few words"}]}
Rules:
- "find" must be copied character-for-character from the CURRENT file (including indentation) and must appear exactly once in that file. Use one or more whole lines; include enough context to be unique.
- To insert new lines (e.g. an #include or a new function), set "find" to an existing nearby line and "replace" to that same line plus the new lines.
- To delete, set "replace" to "".
- Never return the whole file. At most 15 edits. If an issue can't be fixed safely, skip it.`;

const TESTS_PROMPT = `You write Unreal Engine 5.4 automation tests. Given a component's .h/.cpp, write ONE C++ file of Automation Spec tests (BEGIN_DEFINE_SPEC / END_DEFINE_SPEC / Describe / It) that check its core behaviour, e.g. damage lowers health, values clamp at 0 and at max, regen stops at max, events fire.
Rules:
- Wrap everything in #if WITH_DEV_AUTOMATION_TESTS ... #endif.
- Include "Misc/AutomationTest.h", the component's header (exact file name given), and any engine headers you use.
- Create objects with NewObject<...>() (no world needed). Call only functions and properties that exist in the header. If behaviour needs a world, timers or Tick, test the pure logic you can reach and say so in a comment.
- Spec flags: EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter. Test name prefix: "SystemArchitect.<ClassName>".
- 4 to 8 It() cases with clear names. Use TestEqual/TestTrue/TestFalse with readable messages.
Respond with ONLY raw JSON: {"file_name":"<ClassName>Spec.cpp","code":"...","cases":["short name of each It case"]}`;

const TEMPLATES = [
  {
    id: "combat",
    title: "Advanced Combat System",
    tagline: "Combo attacks, hitstop, damage types",
    accent: "red",
    icon: "swords",
    prompt: "A third-person melee combat system with combo chains, directional attacks, hit reactions, hitstop, and a damage type enum. Uses an ActorComponent attached to the player Character.",
    default_class: "ActorComponent",
  },
  {
    id: "inventory",
    title: "Grid Inventory",
    tagline: "Slot grid, stacking, tooltips",
    accent: "orange",
    icon: "package",
    prompt: "A slot-based grid inventory system (like Resident Evil) with stackable items, item tooltips, drag-and-drop between slots, and a lightweight DataAsset for item definitions.",
    default_class: "ActorComponent",
  },
  {
    id: "dialogue",
    title: "Branching Dialogue & Quests",
    tagline: "Nodes, choices, flags",
    accent: "blue",
    icon: "messages-square",
    prompt: "A branching dialogue system with speaker lines, player choices, condition-gated branches, quest-stage flag updates, and a DataTable-driven conversation graph.",
    default_class: "Actor",
  },
  {
    id: "ai_guard",
    title: "Behavior Tree AI Guard",
    tagline: "Patrol, chase, search",
    accent: "purple",
    icon: "shield",
    prompt: "An AI guard pawn using a Behavior Tree and Blackboard with patrol route, sight/hearing perception, chase, investigate-last-known-position, and return-to-post states.",
    default_class: "Character",
  },
  {
    id: "save",
    title: "Save / Load Game State",
    tagline: "Slots, versioning, async",
    accent: "green",
    icon: "hard-drive",
    prompt: "A robust save/load subsystem with multiple save slots, autosave timer, versioned USaveGame struct, async disk I/O, and a Blueprint-friendly API.",
    default_class: "GameInstanceSubsystem",
  },
  {
    id: "vehicle",
    title: "Vehicle Physics Controller",
    tagline: "Chaos vehicles, gears, drift",
    accent: "cyan",
    icon: "car",
    prompt: "A Chaos Vehicles arcade car controller with throttle, brake, handbrake drift, automatic gear shifting, boost ability, and tire smoke VFX hooks.",
    default_class: "WheeledVehiclePawn",
  },
  {
    id: "gas",
    title: "Gameplay Ability System",
    tagline: "GAS attributes & abilities",
    accent: "orange",
    icon: "sparkles",
    prompt: "A Gameplay Ability System setup with an AttributeSet (Health, Mana, Stamina), three granted GameplayAbilities (Dash, Fireball, Heal), cooldown & cost GEs, and a tag-driven cancellation policy.",
    default_class: "Character",
  },
  {
    id: "interaction",
    title: "Interaction System",
    tagline: "Line trace, prompts, outlines",
    accent: "blue",
    icon: "hand",
    prompt: "A first-person interaction system using a line trace from the camera, a BPI_Interactable interface, dynamic prompt widgets, and a post-process outline on focused actors.",
    default_class: "ActorComponent",
  },
];

function usageDay(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function keyFingerprint(key) {
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
}

function extractJson(raw) {
  let text = String(raw || "").trim();
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fence) text = fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("No JSON object found in model response");
  }
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    // Models sometimes emit raw newlines inside strings. Drop unprintable controls and retry.
    return JSON.parse(slice.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, " "));
  }
}

function compactSystem(sys, headerChars, full = false) {
  const keep = {
    system_name: sys?.system_name,
    summary: sys?.summary,
    modules: (sys?.modules || []).map((m) => ({ name: m?.name, included: m?.included })),
    tunable_parameters: (sys?.tunable_parameters || []).map((p) => ({
      key: p?.key, label: p?.label, value: p?.value, unit: p?.unit,
    })),
    network_notes: sys?.network_notes,
    cpp_header_excerpt: String(sys?.cpp_header || "").slice(0, headerChars),
  };
  if (full) {
    keep.cpp_source = String(sys?.cpp_source || "").slice(0, 12000);
    keep.blueprint_pseudocode = String(sys?.blueprint_pseudocode || "").slice(0, 6000);
    keep.setup_guide = sys?.setup_guide || [];
    keep.node_graph = { nodes: sys?.node_graph_nodes || [], edges: sys?.node_graph_edges || [] };
  }
  return JSON.stringify(keep, null, 1);
}

function buildUserText(req, refs) {
  const sections = [];
  if (refs?.length) {
    const parts = refs.map((r) => {
      const body = r.image_bytes ? "(image attached below)" : (r.text || "");
      return `--- ${r.filename} ---\n${body}`;
    });
    sections.push("REFERENCE FILES (use as source material: extend existing code, match screenshots and specs):\n" + parts.join("\n\n"));
  }
  if (String(req.project_context || "").trim()) {
    sections.push(`PROJECT CONTEXT (steer every decision by this): ${String(req.project_context).trim()}`);
  }
  if (req.stack_systems?.length) {
    const stacked = req.stack_systems.map((s, i) => `[System ${i + 1}]\n${compactSystem(s, 4000)}`).join("\n\n");
    sections.push(`STACKED SYSTEMS (merge into one integrated system):\n${stacked}`);
  }
  if (req.previous_system) {
    sections.push(`PREVIOUS SYSTEM (revise this, do not start over):\n${compactSystem(req.previous_system, 8000, true)}`);
  }
  if (req.change_requests?.length) {
    const numbered = req.change_requests.map((c, i) => `${i + 1}. ${c}`).join("\n");
    sections.push(`REQUESTED CHANGES (apply every one, report each in applied_changes):\n${numbered}`);
  }
  if (String(req.designer_notes || "").trim()) {
    sections.push(`DESIGNER NOTES: ${String(req.designer_notes).trim()}`);
  }
  const prefix = sections.length ? sections.join("\n\n") + "\n\n" : "";
  return prefix + `User request:
"""${req.prompt}"""

Target UE5 Blueprint class: ${req.blueprint_class}
System name hint: ${req.system_name || "(auto-generate)"}
Network replicated: ${!!req.network_replicated}

Tunable architecture dials (0-100 unless noted):
  complexity=${req.complexity}  (higher = more features, deeper logic)
  modularity=${req.modularity}  (higher = split into more ActorComponents / Interfaces)
  performance_vs_flexibility=${req.performance_vs_flexibility}  (0=max perf, 100=max flexibility)
  tick_rate=${req.tick_rate} Hz  (0 = event-driven only)

User-added modules to INCLUDE: ${req.extra_modules?.length ? JSON.stringify(req.extra_modules) : "(none)"}
User-removed modules to mark excluded: ${req.removed_modules?.length ? JSON.stringify(req.removed_modules) : "(none)"}
User-tuned parameter values (keep these keys and use these exact values in code defaults): ${req.parameter_overrides && Object.keys(req.parameter_overrides).length ? JSON.stringify(req.parameter_overrides) : "(none)"}

Generate the full modular UE5 system now. Respond with raw JSON only.`;
}

function classifyError(exc, model = "") {
  const low = String(exc && (exc.message || exc)).toLowerCase();
  const status = exc && exc.status_code;
  if (low.includes("free_tier") && low.includes("limit: 0")) {
    return { code: "paid_model_required", message: PAID_MODEL_MSG.replace("{model}", model || "This model") };
  }
  if (low.includes("insufficient_quota")) {
    return { code: "no_credits", message: "This OpenAI key has no credits left (free credits expire after 30 days). Add billing to your OpenAI account, or switch to a free Gemini key." };
  }
  if ((exc && exc.name === "AbortError") || low.includes("timeout") || low.includes("timed out")) {
    return { code: "busy", message: "The model took too long to answer. Try again, or switch to Gemini 3.5 Flash-Lite." };
  }
  if ([500, 502, 503, 504].includes(status) || low.includes("serviceunavailable") || low.includes("unavailable") || low.includes("high demand") || low.includes("overloaded")) {
    return { code: "busy", message: "That model is overloaded right now. Try again in a minute, or switch to Gemini 3.5 Flash-Lite." };
  }
  return { code: "error", message: friendlyError(exc) };
}

function friendlyError(exc) {
  const msg = String(exc && (exc.message || exc));
  const low = msg.toLowerCase();
  if (["api key not valid", "invalid api key", "incorrect api key", "api_key_invalid", "authenticationerror", "permission_denied", "unauthorized"].some((k) => low.includes(k)) || exc?.status_code === 401) {
    return "Your AI key was rejected. Open Settings and check it's correct for the selected provider.";
  }
  if (["resource_exhausted", "ratelimit", "rate limit", "quota", "429"].some((k) => low.includes(k)) || exc?.status_code === 429) {
    return "Your AI key hit its rate limit or free quota. Wait a minute and try again, or switch to a lighter model.";
  }
  if (low.includes("not found") && low.includes("model")) {
    return "That model isn't available for your key. Pick another model in Settings.";
  }
  return `AI provider error: ${msg.slice(0, 300)}`;
}

function redact(text, key) {
  if (!key) return String(text || "");
  return String(text || "").split(key).join("***");
}

function normalizeSystem(data, stackSystems) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("not an object");
  const str = (v) => (typeof v === "string" ? v : v == null ? "" : String(v));
  const out = {
    id: crypto.randomUUID(),
    system_name: str(data.system_name).trim(),
    summary: str(data.summary),
    tunable_parameters: Array.isArray(data.tunable_parameters) ? data.tunable_parameters : [],
    modules: Array.isArray(data.modules) ? data.modules : [],
    blueprint_pseudocode: str(data.blueprint_pseudocode),
    cpp_header: str(data.cpp_header),
    cpp_source: str(data.cpp_source),
    setup_guide: Array.isArray(data.setup_guide) ? data.setup_guide : [],
    node_graph_nodes: Array.isArray(data.node_graph_nodes) ? data.node_graph_nodes : [],
    node_graph_edges: Array.isArray(data.node_graph_edges) ? data.node_graph_edges : [],
    network_notes: str(data.network_notes),
    applied_changes: Array.isArray(data.applied_changes) ? data.applied_changes.map((x) => str(x)) : [],
    shared_attributes: Array.isArray(data.shared_attributes) ? data.shared_attributes.map((x) => str(x)) : [],
    stacked_from: (stackSystems || []).map((s) => s?.system_name || ""),
    generated_at: new Date().toISOString(),
    tests: data.tests && typeof data.tests === "object" ? data.tests : undefined,
  };
  if (!out.tests) delete out.tests;
  const missing = ["system_name", "blueprint_pseudocode", "cpp_header", "cpp_source"].filter((f) => !String(out[f]).trim());
  if (missing.length || !out.node_graph_nodes.length || !out.setup_guide.length) {
    throw new Error(`empty fields: ${missing.join(", ") || "graph/setup"}`);
  }
  return out;
}

function replaceLinesLoose(text, find, repl) {
  const lines = String(text).split("\n");
  const want = String(find).replace(/^\n+|\n+$/g, "").split("\n").map((w) => w.trim());
  const starts = [];
  for (let i = 0; i <= lines.length - want.length; i++) {
    const got = lines.slice(i, i + want.length).map((x) => x.trim());
    if (want.every((w, n) => w === got[n])) starts.push(i);
  }
  if (starts.length !== 1) throw new Error(`text to change was found ${starts.length} times`);
  const i = starts[0];
  const indent = lines[i].slice(0, lines[i].length - lines[i].trimStart().length);
  const newLines = repl
    ? String(repl).split("\n").map((r) => (r.trim() && !r.startsWith(" ") && !r.startsWith("\t") ? indent + r.trim() : r))
    : [];
  return lines.slice(0, i).concat(newLines, lines.slice(i + want.length)).join("\n");
}

function applyEdits(files, edits) {
  const applied = [];
  for (const e of edits) {
    if (!e || typeof e !== "object") continue;
    const name = String(e.file || "").endsWith("cpp") ? ".cpp" : ".h";
    const find = e.find;
    const repl = e.replace == null ? "" : e.replace;
    if (typeof find !== "string" || !find.trim() || typeof repl !== "string") {
      throw new Error("edit without find text");
    }
    const hits = files[name].split(find).length - 1;
    if (hits === 1) {
      files[name] = files[name].replace(find, repl);
    } else {
      files[name] = replaceLinesLoose(files[name], find, repl);
    }
    applied.push({ file: name, why: String(e.why || "").slice(0, 200) });
  }
  return applied;
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function asStringList(value, max) {
  if (!Array.isArray(value)) return [];
  return value.map((x) => String(x)).slice(0, max);
}

function normalizeGenerateRequest(body) {
  const prompt = String(body?.prompt || "");
  if (prompt.trim().length < 3 || prompt.length > 2000) {
    const err = new Error("Describe the system in 3 to 2000 characters.");
    err.statusCode = 400;
    throw err;
  }
  const stack = Array.isArray(body.stack_systems) ? body.stack_systems.filter((s) => s && typeof s === "object").slice(0, 4) : [];
  return {
    prompt,
    system_name: body.system_name ? String(body.system_name).slice(0, 120) : null,
    blueprint_class: String(body.blueprint_class || "ActorComponent").slice(0, 80),
    complexity: clampInt(body.complexity, 50, 0, 100),
    modularity: clampInt(body.modularity, 70, 0, 100),
    performance_vs_flexibility: clampInt(body.performance_vs_flexibility, 50, 0, 100),
    tick_rate: clampInt(body.tick_rate, 30, 0, 120),
    network_replicated: !!body.network_replicated,
    extra_modules: asStringList(body.extra_modules, 20),
    removed_modules: asStringList(body.removed_modules, 20),
    parameter_overrides: body.parameter_overrides && typeof body.parameter_overrides === "object" ? body.parameter_overrides : {},
    project_context: String(body.project_context || "").slice(0, 300),
    designer_notes: String(body.designer_notes || "").slice(0, 1000),
    change_requests: asStringList(body.change_requests, 40),
    previous_system: body.previous_system && typeof body.previous_system === "object" ? body.previous_system : null,
    stack_systems: stack,
    reference_file_ids: asStringList(body.reference_file_ids, 5),
  };
}

module.exports = {
  ALLOWED_MODELS,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  FREE_DAILY,
  SYSTEM_PROMPT,
  REVIEW_PROMPT,
  FIX_PROMPT,
  TESTS_PROMPT,
  TEMPLATES,
  usageDay,
  keyFingerprint,
  extractJson,
  buildUserText,
  classifyError,
  friendlyError,
  redact,
  normalizeSystem,
  replaceLinesLoose,
  applyEdits,
  normalizeGenerateRequest,
};
