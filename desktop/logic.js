"use strict";

// Prompts, output cleanup, and patch application.
// These follow the behavior of the previous Python service so the workspace
// keeps getting the same kind of system, review, fix, and test replies.

const crypto = require("crypto");
const { constraintText, knownLocks } = require("./constraints");

const ALLOWED_MODELS = {
  gemini: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-3.1-pro-preview"],
  openai: ["gpt-4.1-mini", "gpt-4.1", "gpt-5-mini"],
  anthropic: ["claude-sonnet-4-5", "claude-haiku-4-5"],
  openrouter: ["anthropic/claude-sonnet-4.5", "openai/gpt-4.1-mini", "google/gemini-2.5-flash"],
  ollama: ["llama3.2", "qwen2.5-coder", "mistral"],
};

const DEFAULT_PROVIDER = "gemini";
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

// Versions the workspace can target. 5.8 is the default for new work.
// Projects saved before this setting existed were written against the old
// hard-coded "UE 5.4+" prompts, so a missing version is treated as 5.4.
const UNREAL_VERSIONS = ["5.4", "5.5", "5.6", "5.7", "5.8"];
const DEFAULT_UNREAL_VERSION = "5.8";
const LEGACY_UNREAL_VERSION = "5.4";
const GITHUB_REPO = "Johno222222222/blueprint-builder";

function normalizeUnrealVersion(value) {
  const raw = String(value ?? "").trim().replace(/^UE\s*/i, "").replace(/\+$/, "");
  return UNREAL_VERSIONS.includes(raw) ? raw : null;
}

function isNewerVersion(remote, local) {
  const parse = (value) => String(value || "").trim().replace(/^v/i, "").split(".").map((part) => {
    const n = parseInt(part, 10);
    return Number.isFinite(n) ? n : 0;
  });
  const a = parse(remote);
  const b = parse(local);
  const len = Math.max(a.length, b.length, 3);
  for (let i = 0; i < len; i += 1) {
    const delta = (a[i] || 0) - (b[i] || 0);
    if (delta !== 0) return delta > 0;
  }
  return false;
}

// A GitHub release payload, or {version, url} from a test double.
// Returns null when the remote version is missing or not newer.
function releaseNotice(local, payload) {
  if (!payload || typeof payload !== "object") return null;
  const remote = String(payload.tag_name || payload.version || "").trim().replace(/^v/i, "");
  if (!remote || !isNewerVersion(remote, local)) return null;
  const url = typeof payload.html_url === "string" && payload.html_url
    ? payload.html_url
    : (typeof payload.url === "string" && payload.url
      ? payload.url
      : `https://github.com/${GITHUB_REPO}/releases/tag/v${remote}`);
  return { version: remote, url };
}

// Approximate free-tier requests per day. Google resets at midnight Pacific.
// This is a local hint for the usage chip, not an account limit.
const FREE_DAILY = {
  "gemini-3.5-flash-lite": 500,
  "gemini-3.1-flash-lite": 500,
  "gemini-3.8-flash": 250,
  "gemini-3.1-pro-preview": 0,
};

const PAID_MODEL_MSG = "{model} needs a paid API key, and this key is on the free tier. Switch back to Gemini 3.5 Flash-Lite, which works free.";

// This text is the cached prefix. OpenAI and Claude Sonnet 4.5 cache a
// prefix from 1024 tokens. Claude Haiku 4.5 starts at 4096, which this
// prefix does not reach. Stay above 1024 so a regenerate can still hit on
// OpenAI and Sonnet. The engine version lives here because a project keeps
// one version. The user's system, files, and edits stay in the user message.
const SYSTEM_PROMPT_TEMPLATE = `You are an Unreal Engine 5 systems architect. A user describes a gameplay system. You return one modular architecture for {UNREAL} as a single JSON object and nothing else: no markdown, no code fence, and no prose around it. The object is compact, with no line breaks or indentation outside of string values. Example values show the shape. They are not content to copy.

{"system_name":"Title Case Name","summary":"one or two sentences","tunable_parameters":[{"key":"id","label":"Label","value":0,"min":0,"max":1,"step":1,"unit":"unit"}],"modules":[{"name":"Name","included":true,"description":"what it adds"}],"blueprint_pseudocode":"indented event flow with a WHY: line after a decision","cpp_header":"compilable header","cpp_source":"matching source","setup_guide":[{"step":1,"title":"short","detail":"short","why":"short"}],"node_graph_nodes":[{"id":"n1","label":"Event BeginPlay","node_type":"event","x":80,"y":120,"inputs":[],"outputs":["exec"]}],"node_graph_edges":[{"from_node":"n1","to_node":"n2","kind":"exec"}],"network_notes":"short replication note","applied_changes":[],"shared_attributes":[],"confidence":"high","alternative":""}

The fields follow these definitions.
- 6 to 9 nodes, left to right. x is between 40 and 1200, y is between 60 and 560, about 220px apart in x and 120px in y. node_type is event, function, variable, flow, or pure. 4 to 7 edges. kind is exec or data.
- 4 to 6 setup steps. detail is at most 140 characters. Each step has a why of at most 110 characters.
- 3 to 5 tunable parameters, with min, max, step, and unit that fit the system.
- 3 to 5 modules. A module the user added is included true. A module the user removed is included false.
- system_name is Title Case with spaces.
- The header and the source are a pair Unreal Header Tool can compile. Each file is 50 to 120 lines, not counting blanks. Every tunable parameter is a UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="..."). Every module's functions, delegates, and events are declared and implemented. UPROPERTY(Replicated) and GetLifetimeReplicatedProps appear only when network_replicated is true. Each BlueprintNativeEvent has a Name_Implementation function in the source. A GetWorld() call includes "Engine/World.h" in the source. A widget include means the module depends on UMG. Includes are only the engine headers the code uses.
- The header's last include is the matching ".generated.h", and that header includes "CoreMinimal.h" and GENERATED_BODY(). The source's first include is its own header. The header file name is the class name without its U, A, or F prefix, and the source file uses that same name. A UFUNCTION that is not BlueprintImplementableEvent has a body in the source. An override of BeginPlay, EndPlay, Tick, or GetLifetimeReplicatedProps calls Super. When network_replicated is true, the constructor calls SetIsReplicatedByDefault(true). A replicated property with ReplicatedUsing names an OnRep function that exists, and DOREPLIFETIME uses that same property name. A delegate type is declared before it is used. The class name in the source matches the class name in the header. Braces in both files balance, and no function body is left unfinished.
- blueprint_pseudocode has an indented WHY: line after 3 to 5 decisions. Each WHY explains that decision for this system.
- Project context, when it is present, constrains the decisions.
- confidence is "low", and alternative names one other way to build it, when the parent class, the replication choice, or an engine API is uncertain. Otherwise confidence is "high" and alternative is "".
- Constraint locks are part of the design. A No Tick lock means there is no Tick or TickComponent, and bCanEverTick is not true. bCanEverTick = false is allowed. A server-authority lock means state changes use HasAuthority or a Server RPC.
- A previous system with requested changes is a revision. Keep every part a change does not touch. Apply every change, including parameter values, module additions and removals, dials, and designer notes. applied_changes has one entry per change, in the same order. Keep every constraint lock. With no requested changes, applied_changes is [].
- Stacked systems are summaries: names, parameters, modules, and declarations. They are not full source and they are not a chopped file. Merge them into one system and write complete header and source files, finished through the last function. One owner holds a duplicated attribute. Cross-system calls go through an interface or a delegate. Colliding names are renamed. shared_attributes lists what was unified. Each resolved conflict is an applied_changes entry that starts with "Conflict resolved:". With no stack, shared_attributes is [].`;

const REVIEW_PROMPT_TEMPLATE = `You are a strict {ENGINE} C++ compile reviewer. Find problems in the given .h/.cpp pair that would make it fail to compile, fail Unreal Header Tool, or fail to link: missing #includes, names that don't match between files, wrong or missing signatures, functions declared but not defined, UCLASS/UPROPERTY/UFUNCTION macro mistakes, wrong Super:: calls, replication mistakes, wrong engine API usage.
Only report real problems, never style. Do not repeat issues already listed under KNOWN ISSUES.
Respond with ONLY raw JSON: {"issues":[{"severity":"error","file":".h","line":12,"message":"what is wrong","fix":"how to fix it"}]}
severity is "error" (will not build) or "warning" (likely wrong at runtime). file is ".h" or ".cpp". line may be null. At most 12 issues. If the code looks fine, return {"issues":[]}.`;

const FIX_PROMPT_TEMPLATE = `You are an {ENGINE} C++ fixer. You get a .h/.cpp pair and a list of ISSUES. Fix exactly those issues with the smallest possible edits. Do not rewrite, reformat or rename anything else.
Respond with ONLY raw JSON:
{"edits":[{"file":".h","find":"exact text copied from the file","replace":"new text","why":"which issue this fixes, in a few words"}]}
Rules:
- "find" must be copied character-for-character from the CURRENT file (including indentation) and must appear exactly once in that file. Use one or more whole lines; include enough context to be unique.
- To insert new lines (e.g. an #include or a new function), set "find" to an existing nearby line and "replace" to that same line plus the new lines.
- To delete, set "replace" to "".
- Never return the whole file. At most 15 edits. If an issue can't be fixed safely, skip it.`;

const TESTS_PROMPT_TEMPLATE = `You write {ENGINE} automation tests. Given a component's .h/.cpp, write ONE C++ file of Automation Spec tests (BEGIN_DEFINE_SPEC / END_DEFINE_SPEC / Describe / It) that check its core behaviour, e.g. damage lowers health, values clamp at 0 and at max, regen stops at max, events fire.
Rules:
- Wrap everything in #if WITH_DEV_AUTOMATION_TESTS ... #endif.
- Include "Misc/AutomationTest.h", the component's header (exact file name given), and any engine headers you use.
- Create objects with NewObject<...>() (no world needed). Call only functions and properties that exist in the header. If behaviour needs a world, timers or Tick, test the pure logic you can reach and say so in a comment.
- Spec flags: EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter. Test name prefix: "SystemArchitect.<ClassName>".
- 4 to 8 It() cases with clear names. Use TestEqual/TestTrue/TestFalse with readable messages.
Respond with ONLY raw JSON: {"file_name":"<ClassName>Spec.cpp","code":"...","cases":["short name of each It case"]}`;

function fillPrompt(template, version) {
  const v = normalizeUnrealVersion(version) || DEFAULT_UNREAL_VERSION;
  return String(template)
    .replaceAll("{UNREAL}", `UE ${v}`)
    .replaceAll("{ENGINE}", `Unreal Engine ${v}`);
}

function promptsFor(version) {
  const v = normalizeUnrealVersion(version) || DEFAULT_UNREAL_VERSION;
  return {
    version: v,
    system: fillPrompt(SYSTEM_PROMPT_TEMPLATE, v),
    review: fillPrompt(REVIEW_PROMPT_TEMPLATE, v),
    fix: fillPrompt(FIX_PROMPT_TEMPLATE, v),
    tests: fillPrompt(TESTS_PROMPT_TEMPLATE, v),
  };
}

const SYSTEM_PROMPT = promptsFor(DEFAULT_UNREAL_VERSION).system;
const REVIEW_PROMPT = promptsFor(DEFAULT_UNREAL_VERSION).review;
const FIX_PROMPT = promptsFor(DEFAULT_UNREAL_VERSION).fix;
const TESTS_PROMPT = promptsFor(DEFAULT_UNREAL_VERSION).tests;

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

const SYSTEM_NOTES = {
  combat: ["Use this when melee hits, combos, and hit reactions should live on a component.", "A common mistake is to put the combo on Tick, or to Cast To every weapon Blueprint."],
  inventory: ["Use this when a grid of slots should read stack size from a data asset.", "A common mistake is to let the widget decide the stack, or to ignore the data table row."],
  dialogue: ["Use this when a conversation should branch from a data table instead of a chain of casts.", "A common mistake is to hardcode every line in the character."],
  ai_guard: ["Use this when a guard should patrol, chase, and search without Tick doing all of it.", "A common mistake is to replicate the whole animation instead of the state."],
  save: ["Use this when a slot should be one struct you write and read back.", "A common mistake is to save on Tick, or to Break Struct before the member is set."],
  vehicle: ["Use this when throttle, brake, and boost should be a vehicle component.", "A common mistake is to drive the mesh from Tick on every client."],
  gas: ["Use this when abilities should activate by gameplay tag through the Gameplay Ability System.", "A common mistake is a Cast To per ability, or a second health float beside the attribute."],
  interaction: ["Use this when a trace should call an interface on the actor you look at.", "A common mistake is a Cast To chain, or a trace that runs on Tick."],
};
for (const template of TEMPLATES) {
  const notes = SYSTEM_NOTES[template.id];
  if (!notes) continue;
  template.when_to_use = notes[0];
  template.common_mistakes = notes[1];
}

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

const TRUNCATED_OUTPUT_MESSAGE = "The model's answer was cut off at its length limit, so this system was not shown. Stack fewer projects, or lower Complexity, and try again.";

// A stack used to send the first 4000 characters of the header and nothing of the
// source. A second stack then started from a file that ended mid-declaration.
// This keeps the shape of the system and leaves the source out.
function stackSummary(sys) {
  const header = String(sys?.cpp_header || "");
  const declarations = header.split("\n").map((line) => line.trim()).filter((line) => (
    /^(class |struct |enum |UCLASS|UPROPERTY|UFUNCTION|GENERATED_BODY|virtual |void |bool |int|float |double |FString |FName |FText |TArray|TMap|TSubclassOf)/.test(line)
  )).slice(0, 40);
  return {
    system_name: sys?.system_name || "",
    summary: String(sys?.summary || "").slice(0, 400),
    modules: (sys?.modules || []).slice(0, 12).map((m) => ({
      name: m?.name,
      included: !!m?.included,
      description: String(m?.description || "").slice(0, 120),
    })),
    tunable_parameters: (sys?.tunable_parameters || []).slice(0, 12).map((p) => ({
      key: p?.key, label: p?.label, value: p?.value, unit: p?.unit,
    })),
    setup_titles: (sys?.setup_guide || []).slice(0, 8).map((step) => step?.title).filter(Boolean),
    declarations,
    network_notes: String(sys?.network_notes || "").slice(0, 240),
  };
}

function braceDelta(text) {
  let depth = 0;
  let quote = "";
  const src = String(text || "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") { i += 1; continue; }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
  }
  return depth;
}

// Valid JSON can still hold C++ that stops mid-function. Balanced braces mean
// the files were finished, not sliced off.
function codeLooksCut(data) {
  if (!data || typeof data !== "object") return true;
  const files = [data.cpp_header, data.cpp_source];
  for (const file of files) {
    const text = String(file || "").trim();
    if (!text) return true;
    if (braceDelta(text) !== 0) return true;
  }
  return false;
}

// What to do with one model reply. "append" continues a cut JSON string.
// "replace" asks for the whole system again when the C++ itself is unfinished.
function assessReply(raw, { truncated = false } = {}) {
  let data = null;
  try { data = extractJson(raw); } catch { data = null; }
  const jsonOk = !!data && typeof data === "object" && !Array.isArray(data);
  const cut = jsonOk && codeLooksCut(data);
  if (jsonOk && !cut) return { action: "accept", data };
  if (!jsonOk) return { action: "append" };
  if (truncated || cut) return { action: "replace" };
  return { action: "accept", data };
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
  return JSON.stringify(keep);
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
  const unreal = normalizeUnrealVersion(req.unreal_version) || DEFAULT_UNREAL_VERSION;
  sections.push(`TARGET ENGINE: UE ${unreal}. Write C++, Blueprint steps, includes, and project setup for this Unreal version.`);
  if (String(req.project_context || "").trim()) {
    sections.push(`PROJECT CONTEXT (steer every decision by this): ${String(req.project_context).trim()}`);
  }
  if (req.stack_systems?.length) {
    const stacked = req.stack_systems.map((s, i) => `[System ${i + 1}]\n${JSON.stringify(stackSummary(s))}`).join("\n\n");
    sections.push(`STACKED SYSTEMS (summaries only — write complete files, do not copy a chopped excerpt):\n${stacked}`);
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
  const locks = constraintText(req.locks);
  if (locks) sections.push(locks);
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

Reply with the compact JSON object.`;
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
    confidence: data.confidence === "low" ? "low" : "high",
    alternative: data.confidence === "low" ? str(data.alternative).slice(0, 400) : "",
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
    project_context: String(body.project_context || "").slice(0, 800),
    unreal_version: normalizeUnrealVersion(body.unreal_version) || DEFAULT_UNREAL_VERSION,
    designer_notes: String(body.designer_notes || "").slice(0, 1000),
    change_requests: asStringList(body.change_requests, 40),
    previous_system: body.previous_system && typeof body.previous_system === "object" ? body.previous_system : null,
    stack_systems: stack,
    reference_file_ids: asStringList(body.reference_file_ids, 5),
    locks: knownLocks(body.locks),
  };
}

module.exports = {
  ALLOWED_MODELS,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  FREE_DAILY,
  UNREAL_VERSIONS,
  DEFAULT_UNREAL_VERSION,
  LEGACY_UNREAL_VERSION,
  GITHUB_REPO,
  SYSTEM_PROMPT,
  REVIEW_PROMPT,
  FIX_PROMPT,
  TESTS_PROMPT,
  TEMPLATES,
  normalizeUnrealVersion,
  isNewerVersion,
  releaseNotice,
  promptsFor,
  usageDay,
  keyFingerprint,
  extractJson,
  stackSummary,
  codeLooksCut,
  assessReply,
  TRUNCATED_OUTPUT_MESSAGE,
  buildUserText,
  classifyError,
  friendlyError,
  redact,
  normalizeSystem,
  replaceLinesLoose,
  applyEdits,
  normalizeGenerateRequest,
};
