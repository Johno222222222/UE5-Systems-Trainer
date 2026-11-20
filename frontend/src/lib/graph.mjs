// One graph document. kind is "event" in this version.
// A later stage adds graphs with kind "function" or "macro" using the same nodes, wires, and comments.

export const PIN_COLORS = {
  exec: "#ffffff",
  bool: "#e02424",
  int: "#1fd4c8",
  float: "#e6d24a",
  string: "#e040a0",
  name: "#c44bd4",
  object: "#2f7dff",
  wildcard: "#8b93a7",
};

export const GROUP_ORDER = [
  "Lifecycle",
  "Input",
  "Collision",
  "Damage",
  "Timers",
  "Networking",
  "Custom Event",
  "Event Dispatchers",
  "Actions",
  "Flow",
  "Math",
];

const pin = (name, dir, type) => ({ name, dir, type });

export const CATALOG = [
  { id: "begin-play", group: "Lifecycle", label: "Begin Play", visual: "event", pins: [pin("Exec", "out", "exec")] },
  { id: "end-play", group: "Lifecycle", label: "End Play", visual: "event", pins: [pin("Exec", "out", "exec")] },
  { id: "tick", group: "Lifecycle", label: "Tick", visual: "event", pins: [pin("Exec", "out", "exec"), pin("Delta Seconds", "out", "float")] },
  { id: "enhanced-input", group: "Input", label: "Enhanced Input Action", visual: "event", pins: [pin("Triggered", "out", "exec"), pin("Value", "out", "float")], data: { action: "IA_Action" } },
  { id: "begin-overlap", group: "Collision", label: "On Component Begin Overlap", visual: "event", pins: [pin("Exec", "out", "exec"), pin("Other Actor", "out", "object")] },
  { id: "line-trace", group: "Collision", label: "Line Trace", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Exec", "out", "exec"), pin("Hit", "out", "bool"), pin("Hit Actor", "out", "object")], data: { hit: true, actor: "HitActor" } },
  { id: "end-overlap", group: "Collision", label: "On Component End Overlap", visual: "event", pins: [pin("Exec", "out", "exec"), pin("Other Actor", "out", "object")] },
  { id: "hit", group: "Collision", label: "On Hit", visual: "event", pins: [pin("Exec", "out", "exec"), pin("Other Actor", "out", "object")] },
  { id: "any-damage", group: "Damage", label: "Any Damage", visual: "event", pins: [pin("Exec", "out", "exec"), pin("Damage", "out", "float")] },
  { id: "point-damage", group: "Damage", label: "Point Damage", visual: "event", pins: [pin("Exec", "out", "exec"), pin("Damage", "out", "float")] },
  { id: "set-timer", group: "Timers", label: "Set Timer", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Time", "in", "float"), pin("Exec", "out", "exec")], data: { seconds: 1 } },
  { id: "set-timer-event", group: "Timers", label: "Set Timer by Event", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Time", "in", "float"), pin("Exec", "out", "exec")], data: { seconds: 1, event: "TimerEvent" } },
  { id: "set-timer-function", group: "Timers", label: "Set Timer by Function", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Time", "in", "float"), pin("Exec", "out", "exec")], data: { seconds: 1, function: "OnTimer" } },
  { id: "timeline", group: "Timers", label: "Timeline", visual: "function", pins: [pin("Play", "in", "exec"), pin("Update", "out", "exec"), pin("Finished", "out", "exec"), pin("Alpha", "out", "float")] },
  { id: "on-rep", group: "Networking", label: "OnRep", visual: "event", pins: [pin("Exec", "out", "exec")], data: { variable: "Value" } },
  { id: "server-rpc", group: "Networking", label: "Server RPC", visual: "event", pins: [pin("Exec", "out", "exec")] },
  { id: "client-rpc", group: "Networking", label: "Client RPC", visual: "event", pins: [pin("Exec", "out", "exec")] },
  { id: "multicast-rpc", group: "Networking", label: "Multicast RPC", visual: "event", pins: [pin("Exec", "out", "exec")] },
  { id: "has-authority", group: "Networking", label: "Has Authority", visual: "flow", pins: [pin("Exec", "in", "exec"), pin("Exec", "out", "exec"), pin("Authority", "out", "bool")] },
  { id: "custom-event", group: "Custom Event", label: "Custom Event", visual: "event", pins: [pin("Exec", "out", "exec")], data: { name: "CustomEvent" } },
  { id: "dispatcher-bind", group: "Event Dispatchers", label: "Bind Event Dispatcher", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Event", "in", "object"), pin("Exec", "out", "exec")], data: { name: "OnChanged" } },
  { id: "dispatcher-call", group: "Event Dispatchers", label: "Call Event Dispatcher", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Exec", "out", "exec")], data: { name: "OnChanged" } },
  { id: "branch", group: "Actions", label: "Branch", visual: "flow", pins: [pin("Exec", "in", "exec"), pin("Condition", "in", "bool"), pin("Then", "out", "exec"), pin("Else", "out", "exec")] },
  { id: "sequence", group: "Actions", label: "Sequence", visual: "flow", pins: [pin("Exec", "in", "exec"), pin("Then 0", "out", "exec"), pin("Then 1", "out", "exec")] },
  { id: "delay", group: "Actions", label: "Delay", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Duration", "in", "float"), pin("Completed", "out", "exec")], data: { seconds: 0.5 } },
  { id: "print-string", group: "Actions", label: "Print String", visual: "function", pins: [pin("Exec", "in", "exec"), pin("In String", "in", "string"), pin("Exec", "out", "exec")], data: { text: "Hello" } },
  { id: "interface-call", group: "Actions", label: "Interface Call", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Target", "in", "object"), pin("Exec", "out", "exec")], data: { function: "Interact" } },
  { id: "placeholder", group: "Actions", label: "Unknown Node", visual: "flow", pins: [pin("Exec", "in", "exec"), pin("Exec", "out", "exec")], data: { unrealClass: "" } },
  { id: "set-variable", group: "Actions", label: "Set Variable", visual: "variable", pins: [pin("Exec", "in", "exec"), pin("Value", "in", "float"), pin("Exec", "out", "exec")], data: { variable: "Value", varType: "float" } },
  { id: "get-variable", group: "Actions", label: "Get Variable", visual: "pure", pins: [pin("Value", "out", "float")], data: { variable: "Value", varType: "float" } },
  { id: "call-function", group: "Actions", label: "Call Function", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Exec", "out", "exec")], data: { function: "Function" } },
  { id: "spawn-actor", group: "Actions", label: "Spawn Actor", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Class", "in", "object"), pin("Exec", "out", "exec"), pin("Return Value", "out", "object")], data: { className: "AActor" } },
  { id: "cast-to", group: "Actions", label: "Cast To", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Object", "in", "object"), pin("Exec", "out", "exec"), pin("As", "out", "object")], data: { className: "AActor" } },
  { id: "foreach", group: "Flow", label: "ForEach", visual: "flow", pins: [pin("Exec", "in", "exec"), pin("Array", "in", "wildcard"), pin("Loop Body", "out", "exec"), pin("Element", "out", "wildcard"), pin("Completed", "out", "exec")] },
  { id: "forloop", group: "Flow", label: "ForLoop", visual: "flow", pins: [pin("Exec", "in", "exec"), pin("First", "in", "int"), pin("Last", "in", "int"), pin("Loop Body", "out", "exec"), pin("Index", "out", "int"), pin("Completed", "out", "exec")] },
  { id: "while", group: "Flow", label: "While", visual: "flow", pins: [pin("Exec", "in", "exec"), pin("Condition", "in", "bool"), pin("Loop Body", "out", "exec"), pin("Completed", "out", "exec")] },
  { id: "select", group: "Flow", label: "Select", visual: "pure", pins: [pin("Pick", "in", "bool"), pin("A", "in", "wildcard"), pin("B", "in", "wildcard"), pin("Return", "out", "wildcard")] },
  { id: "switch-enum", group: "Flow", label: "Switch on Enum", visual: "flow", pins: [pin("Exec", "in", "exec"), pin("Selection", "in", "name"), pin("Default", "out", "exec")], data: { cases: ["A", "B"] } },
  { id: "break-struct", group: "Flow", label: "Break Struct", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Struct", "in", "object"), pin("Exec", "out", "exec")], data: { struct: "FHitResult" } },
  { id: "make-struct", group: "Flow", label: "Make Struct", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Exec", "out", "exec"), pin("Struct", "out", "object")], data: { struct: "FVector" } },
  { id: "do-once", group: "Flow", label: "DoOnce", visual: "flow", pins: [pin("Exec", "in", "exec"), pin("Reset", "in", "exec"), pin("Completed", "out", "exec")] },
  { id: "gate", group: "Flow", label: "Gate", visual: "flow", pins: [pin("Enter", "in", "exec"), pin("Open", "in", "exec"), pin("Close", "in", "exec"), pin("Exit", "out", "exec")] },
  { id: "flipflop", group: "Flow", label: "FlipFlop", visual: "flow", pins: [pin("Exec", "in", "exec"), pin("A", "out", "exec"), pin("B", "out", "exec"), pin("Is A", "out", "bool")] },
  { id: "add", group: "Math", label: "Add", visual: "pure", pins: [pin("A", "in", "float"), pin("B", "in", "float"), pin("Result", "out", "float")] },
  { id: "subtract", group: "Math", label: "Subtract", visual: "pure", pins: [pin("A", "in", "float"), pin("B", "in", "float"), pin("Result", "out", "float")] },
  { id: "multiply", group: "Math", label: "Multiply", visual: "pure", pins: [pin("A", "in", "float"), pin("B", "in", "float"), pin("Result", "out", "float")] },
  { id: "divide", group: "Math", label: "Divide", visual: "pure", pins: [pin("A", "in", "float"), pin("B", "in", "float"), pin("Result", "out", "float")] },
  { id: "clamp", group: "Math", label: "Clamp", visual: "pure", pins: [pin("Value", "in", "float"), pin("Min", "in", "float"), pin("Max", "in", "float"), pin("Result", "out", "float")] },
  { id: "lerp", group: "Math", label: "Lerp", visual: "pure", pins: [pin("A", "in", "float"), pin("B", "in", "float"), pin("Alpha", "in", "float"), pin("Result", "out", "float")] },
  { id: "equal", group: "Math", label: "Equal", visual: "pure", pins: [pin("A", "in", "wildcard"), pin("B", "in", "wildcard"), pin("Result", "out", "bool")] },
  { id: "greater", group: "Math", label: "Greater", visual: "pure", pins: [pin("A", "in", "float"), pin("B", "in", "float"), pin("Result", "out", "bool")] },
  { id: "less", group: "Math", label: "Less", visual: "pure", pins: [pin("A", "in", "float"), pin("B", "in", "float"), pin("Result", "out", "bool")] },
  { id: "and", group: "Math", label: "AND", visual: "pure", pins: [pin("A", "in", "bool"), pin("B", "in", "bool"), pin("Result", "out", "bool")] },
  { id: "or", group: "Math", label: "OR", visual: "pure", pins: [pin("A", "in", "bool"), pin("B", "in", "bool"), pin("Result", "out", "bool")] },
  { id: "not", group: "Math", label: "NOT", visual: "pure", pins: [pin("A", "in", "bool"), pin("Result", "out", "bool")] },
  { id: "literal", group: "Math", label: "Literal", visual: "pure", pins: [pin("Value", "out", "float")], data: { varType: "float", value: "0" } },
  { id: "entry", group: "Tunnel", label: "Entry", visual: "event", pins: [pin("Exec", "out", "exec")] },
  { id: "return", group: "Tunnel", label: "Return", visual: "function", pins: [pin("Exec", "in", "exec")] },
  { id: "macro-in", group: "Tunnel", label: "Macro Inputs", visual: "event", pins: [pin("Exec", "out", "exec")] },
  { id: "macro-out", group: "Tunnel", label: "Macro Outputs", visual: "function", pins: [pin("Exec", "in", "exec")] },
  { id: "call-user", group: "Tunnel", label: "Call Function", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Exec", "out", "exec")] },
  { id: "call-macro", group: "Tunnel", label: "Call Macro", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Exec", "out", "exec")] },
];

const NODE_NOTES = {
  timeline: {
    whenToUse: "Use a Timeline when a door or a fade should follow a curve instead of jumping.",
    commonMistakes: "A common mistake is to drive the mesh on Tick after the Timeline finishes, or to forget the curve is not replicated.",
  },
  delay: {
    whenToUse: "Use Delay for a short pause before the next exec, such as a prompt that waits.",
    commonMistakes: "A common mistake is to stack Delay nodes where a timer or a Timeline would be easier to cancel.",
  },
  "set-timer": {
    whenToUse: "Use Set Timer when work should repeat without Tick.",
    commonMistakes: "A common mistake is to start the timer on Tick, so you get a new timer every frame.",
  },
  "set-timer-event": {
    whenToUse: "Use Set Timer by Event when a custom event should fire after a delay.",
    commonMistakes: "A common mistake is to name an event that does not exist, so the timer never calls it.",
  },
  "set-timer-function": {
    whenToUse: "Use Set Timer by Function when a named function should run once or on a loop.",
    commonMistakes: "A common mistake is to point it at a function that still touches replicated state on a client.",
  },
  "dispatcher-bind": {
    whenToUse: "Use Bind Event Dispatcher when a widget should hear a change without polling.",
    commonMistakes: "A common mistake is to bind on Tick, or to bind and never unbind.",
  },
  "dispatcher-call": {
    whenToUse: "Use Call Event Dispatcher when listeners should hear that something changed.",
    commonMistakes: "A common mistake is to call the dispatcher from Tick instead of when the value changes.",
  },
  "interface-call": {
    whenToUse: "Use an interface message when a door and a pickup should answer the same call.",
    commonMistakes: "A common mistake is to Cast To every Blueprint instead of calling the interface.",
  },
  "cast-to": {
    whenToUse: "Use Cast To when you truly need one class, after an interface was not enough.",
    commonMistakes: "A common mistake is a long Cast To chain. Prefer an interface.",
  },
  "break-struct": {
    whenToUse: "Use Break Struct to read one member, such as a hit distance, without copying the whole struct around.",
    commonMistakes: "A common mistake is to Break Struct on Tick when you only needed the value once.",
  },
  "make-struct": {
    whenToUse: "Use Make Struct when you are building a save row or a hit payload in one place.",
    commonMistakes: "A common mistake is to Make Struct with default zeros and forget the member you meant to set.",
  },
};

for (const entry of CATALOG) {
  const notes = NODE_NOTES[entry.id] || {
    whenToUse: `Use ${entry.label} when this ${entry.group} step should be visible in the graph instead of hidden in Tick.`,
    commonMistakes: `A common mistake is to Cast To a Blueprint here instead of calling an interface, or to run ${entry.label} on Tick.`,
  };
  entry.whenToUse = notes.whenToUse;
  entry.commonMistakes = notes.commonMistakes;
}

const BY_ID = new Map(CATALOG.map((entry) => [entry.id, entry]));
const MARKER_BEGIN = "// graph:begin event";
const MARKER_END = "// graph:end event";
const RPCS = new Set(["server-rpc", "client-rpc", "multicast-rpc"]);

let seq = 1;
export function uid(prefix = "n") {
  seq += 1;
  return `${prefix}_${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function pinSlug(dir, name) {
  return `${dir}-${String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function ident(value, fallback = "Value") {
  const raw = String(value || "").replace(/[^A-Za-z0-9_]/g, "");
  if (!raw) return fallback;
  return /^[0-9]/.test(raw) ? `N${raw}` : raw;
}

export function pinColor(type) {
  return PIN_COLORS[type] || PIN_COLORS.wildcard;
}

export function emptyGraph({ kind = "event", name = "Event Graph", id = "event" } = {}) {
  return { schema: 1, id, kind, name, nodes: [], wires: [], comments: [] };
}

export function catalogGroups(query = "") {
  const needle = String(query || "").trim().toLowerCase();
  const groups = GROUP_ORDER.map((name) => ({
    name,
    items: CATALOG.filter((entry) => entry.id !== "placeholder" && entry.group === name && (!needle || entry.label.toLowerCase().includes(needle))),
  })).filter((group) => group.items.length);
  return groups;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pinsFromSpec(entry, data) {
  if (entry.id === "break-struct" || entry.id === "make-struct") return structPins(entry.id, data);
  return entry.pins.map((item) => {
    const type = (entry.id === "set-variable" || entry.id === "get-variable" || entry.id === "literal") && item.name === "Value"
      ? (data.varType || item.type || "float")
      : item.type;
    return { id: pinSlug(item.dir, item.name), name: item.name, dir: item.dir, type };
  });
}

export const ENGINE_STRUCTS = [
  { name: "FVector", construct: "FVector::ZeroVector", members: [{ name: "X", type: "float" }, { name: "Y", type: "float" }, { name: "Z", type: "float" }] },
  { name: "FRotator", construct: "FRotator::ZeroRotator", members: [{ name: "Pitch", type: "float" }, { name: "Yaw", type: "float" }, { name: "Roll", type: "float" }] },
  { name: "FTransform", construct: "FTransform::Identity", members: [{ name: "Location", type: "vector" }, { name: "Rotation", type: "rotator" }, { name: "Scale", type: "vector" }] },
  { name: "FHitResult", construct: "FHitResult()", members: [{ name: "bBlockingHit", type: "bool" }, { name: "Distance", type: "float" }, { name: "Time", type: "float" }, { name: "Location", type: "vector" }, { name: "ImpactPoint", type: "vector" }, { name: "Normal", type: "vector" }] },
];

export function structsInHeader(header) {
  const out = [];
  const typeMap = { bool: "bool", int32: "int", float: "float", FString: "string", FName: "name", FVector: "vector", FRotator: "rotator", FTransform: "object" };
  for (const match of String(header || "").matchAll(/struct\s+(?:\w+_API\s+)?(F[A-Za-z0-9_]+)\s*(?::\s*public\s+[A-Za-z0-9_]+)?\s*\{([^}]*)\}/g)) {
    if (ENGINE_STRUCTS.some((item) => item.name === match[1])) continue;
    const members = [];
    for (const line of match[2].split("\n")) {
      const field = line.match(/\b(bool|int32|float|FString|FName|FVector|FRotator|FTransform)\s+([A-Za-z_]\w*)\s*(?:=|;)/);
      if (field) members.push({ name: field[2], type: typeMap[field[1]] || "float" });
    }
    if (members.length) out.push({ name: match[1], members, construct: `${match[1]}()`, source: "header" });
  }
  return out;
}

export function structChoices(doc, header) {
  const list = ENGINE_STRUCTS.map((item) => ({ ...item, source: "engine" }));
  for (const item of structsInHeader(header)) {
    if (!list.some((entry) => entry.name === item.name)) list.push(item);
  }
  for (const variable of doc?.variables || []) {
    if (variable?.type !== "struct" || !variable.structName) continue;
    const name = ident(variable.structName, "FCustomStruct");
    if (list.some((entry) => entry.name === name)) continue;
    const members = Array.isArray(variable.members) && variable.members.length ? variable.members : [{ name: "Value", type: "float" }];
    list.push({ name, members, construct: `${name}()`, source: "variable" });
  }
  return list;
}

export function resolveStruct(data, choices) {
  const name = ident(data?.struct || "FVector", "FVector");
  const known = (choices || ENGINE_STRUCTS).find((item) => item.name === name) || ENGINE_STRUCTS.find((item) => item.name === name);
  if (known) return known;
  const members = Array.isArray(data?.members) && data.members.length ? data.members : [{ name: "Value", type: "float" }];
  return { name, members, construct: `${name}()` };
}

function structPins(catalogId, data) {
  const spec = resolveStruct(data);
  const memberDir = catalogId === "break-struct" ? "out" : "in";
  const pins = [pin("Exec", "in", "exec")];
  if (catalogId === "break-struct") pins.push(pin("Struct", "in", "object"));
  for (const member of spec.members) pins.push(pin(member.name, memberDir, member.type || "float"));
  pins.push(pin("Exec", "out", "exec"));
  if (catalogId === "make-struct") pins.push(pin("Struct", "out", "object"));
  return pins.map((item) => ({ id: pinSlug(item.dir, item.name), name: item.name, dir: item.dir, type: item.type }));
}

export function createNode(catalogId, x, y, extra = {}) {
  const entry = BY_ID.get(catalogId);
  if (!entry) throw new Error(`Unknown graph node ${catalogId}`);
  const data = { ...(entry.data || {}), ...(extra.data || {}) };
  const node = {
    id: extra.id || uid("n"),
    catalog: entry.id,
    kind: entry.visual,
    label: extra.label || labelFor(entry.id, data, entry.label),
    x: Number(x) || 0,
    y: Number(y) || 0,
    pins: entry.id === "switch-enum" ? switchEnumPins(data.cases) : pinsFromSpec(entry, data),
    data,
    whenToUse: entry.whenToUse || "",
    commonMistakes: entry.commonMistakes || "",
  };
  return node;
}

function switchEnumPins(cases) {
  const names = Array.isArray(cases) && cases.length ? cases : ["A", "B"];
  const specs = [
    pin("Exec", "in", "exec"),
    pin("Selection", "in", "name"),
    ...names.map((name) => pin(String(name), "out", "exec")),
    pin("Default", "out", "exec"),
  ];
  return specs.map((item) => ({ id: pinSlug(item.dir, item.name), name: item.name, dir: item.dir, type: item.type }));
}

function labelFor(catalog, data, fallback) {
  if (catalog === "set-variable") return `Set ${data.variable || "Variable"}`;
  if (catalog === "get-variable") return `Get ${data.variable || "Variable"}`;
  if (catalog === "literal") return String(data.value ?? data.varType ?? fallback);
  if (catalog === "interface-call") return data.function || fallback;
  if (catalog === "cast-to") return `Cast To ${data.className || "AActor"}`;
  if (catalog === "break-struct" || catalog === "make-struct") return `${catalog === "break-struct" ? "Break" : "Make"} ${data.struct || "Struct"}`;
  if (catalog === "line-trace") return "Line Trace";
  if (catalog === "call-function") return data.function || fallback;
  if (catalog === "custom-event") return data.name || "Custom Event";
  if (catalog === "on-rep") return `OnRep ${data.variable || ""}`.trim();
  if (catalog === "enhanced-input") return data.action || "Enhanced Input Action";
  return fallback;
}

export function normalizeGraph(graph) {
  const source = graph && typeof graph === "object" ? graph : {};
  return {
    schema: 1,
    id: source.id || (source.kind === "function" || source.kind === "macro" ? uid("g") : "event"),
    kind: source.kind || "event",
    name: source.name || (source.kind === "function" ? "Function" : source.kind === "macro" ? "Macro" : "Event Graph"),
    nodes: Array.isArray(source.nodes) ? source.nodes.map(normalizeNode) : [],
    wires: Array.isArray(source.wires) ? source.wires.map(normalizeWire).filter(Boolean) : [],
    comments: Array.isArray(source.comments) ? source.comments.map(normalizeComment).filter(Boolean) : [],
    pure: !!source.pure,
    callable: source.callable !== false,
    inputs: Array.isArray(source.inputs) ? source.inputs : [],
    outputs: Array.isArray(source.outputs) ? source.outputs : [],
  };
}

function canonicalType(type, name) {
  if (/^exec$/i.test(String(name || ""))) return "exec";
  const raw = String(type || "float").toLowerCase();
  const map = {
    int32: "int", integer: "int", boolean: "bool", fstring: "string", fname: "name",
    fvector: "vector", frotator: "rotator", actor: "object",
  };
  return map[raw] || raw;
}

function normalizeNode(node) {
  const catalog = BY_ID.get(node?.catalog);
  const data = { ...(node?.data || {}) };
  const pins = Array.isArray(node?.pins) && node.pins.length
    ? node.pins.map((item, index) => ({
      id: item.id || pinSlug(item.dir || "out", item.name || index),
      name: String(item.name || "Pin"),
      dir: item.dir === "in" ? "in" : "out",
      type: canonicalType(item.type, item.name),
    }))
    : (catalog ? pinsFromSpec(catalog, data) : []);
  return {
    id: String(node?.id || uid("n")),
    catalog: catalog ? catalog.id : (node?.catalog || ""),
    kind: node?.kind || catalog?.visual || "flow",
    label: String(node?.label || catalog?.label || "Node"),
    x: Number(node?.x) || 0,
    y: Number(node?.y) || 0,
    pins,
    data,
  };
}

function normalizeWire(wire) {
  if (!wire?.from?.node || !wire?.from?.pin || !wire?.to?.node || !wire?.to?.pin) return null;
  return {
    id: String(wire.id || uid("w")),
    from: { node: String(wire.from.node), pin: String(wire.from.pin) },
    to: { node: String(wire.to.node), pin: String(wire.to.pin) },
  };
}

function normalizeComment(comment) {
  if (!comment) return null;
  return {
    id: String(comment.id || uid("c")),
    x: Number(comment.x) || 0,
    y: Number(comment.y) || 0,
    w: Number(comment.w) || 280,
    h: Number(comment.h) || 140,
    text: String(comment.text || "Comment"),
  };
}

function legacyPins(names, dir) {
  return (Array.isArray(names) ? names : []).map((name, index) => ({
    id: pinSlug(dir, name || index),
    name: String(name),
    dir,
    type: String(name).toLowerCase() === "exec" ? "exec" : "wildcard",
  }));
}

export function fromLegacy(nodes = [], edges = []) {
  const graph = emptyGraph();
  graph.nodes = (nodes || []).map((node) => {
    if (node?.catalog && BY_ID.has(node.catalog)) {
      return createNode(node.catalog, node.x, node.y, { id: node.id, label: node.label, data: node.data || {} });
    }
    const inputs = legacyPins(node?.inputs, "in");
    const outputs = legacyPins(node?.outputs, "out");
    return {
      id: String(node?.id || uid("n")),
      catalog: "",
      kind: node?.node_type || "flow",
      label: String(node?.label || "Node"),
      x: Number(node?.x) || 0,
      y: Number(node?.y) || 0,
      pins: [...inputs, ...outputs],
      data: {},
    };
  });
  for (const edge of edges || []) {
    const from = graph.nodes.find((node) => node.id === edge.from_node);
    const to = graph.nodes.find((node) => node.id === edge.to_node);
    if (!from || !to) continue;
    const fromPin = edge.from_pin
      || from.pins.find((item) => item.dir === "out" && (edge.kind === "data" ? item.type !== "exec" : item.type === "exec"))?.id;
    const toPin = edge.to_pin
      || to.pins.find((item) => item.dir === "in" && (edge.kind === "data" ? item.type !== "exec" : item.type === "exec"))?.id;
    if (!fromPin || !toPin) continue;
    graph.wires.push({
      id: edge.id || uid("w"),
      from: { node: from.id, pin: fromPin },
      to: { node: to.id, pin: toPin },
    });
  }
  return normalizeGraph(graph);
}

export function toLegacyNodes(graph) {
  return (graph?.nodes || []).map((node) => ({
    id: node.id,
    label: node.label,
    node_type: node.kind || "flow",
    catalog: node.catalog || "",
    x: node.x,
    y: node.y,
    data: node.data || {},
    inputs: (node.pins || []).filter((item) => item.dir === "in").map((item) => item.name),
    outputs: (node.pins || []).filter((item) => item.dir === "out").map((item) => item.name),
  }));
}

export function toLegacyEdges(graph) {
  return (graph?.wires || []).map((wire) => {
    const from = findPin(graph, wire.from.node, wire.from.pin);
    const to = findPin(graph, wire.to.node, wire.to.pin);
    const exec = from?.type === "exec" && to?.type === "exec";
    return {
      id: wire.id,
      from_node: wire.from.node,
      to_node: wire.to.node,
      from_pin: wire.from.pin,
      to_pin: wire.to.pin,
      kind: exec ? "exec" : "data",
    };
  });
}

export function readEventGraph(system) {
  const items = system?.graphs?.items;
  if (Array.isArray(items)) {
    const found = items.find((item) => item && (item.kind === "event" || item.id === "event"));
    if (found) return normalizeGraph(found);
  }
  if (system?.event_graph?.nodes) return normalizeGraph(system.event_graph);
  return fromLegacy(system?.node_graph_nodes, system?.node_graph_edges);
}

export function writeEventGraph(system, graph) {
  const eventGraph = normalizeGraph({ ...graph, id: graph?.id || "event", kind: "event", name: graph?.name || "Event Graph" });
  const others = Array.isArray(system?.graphs?.items)
    ? system.graphs.items.filter((item) => item && item.kind !== "event" && item.id !== "event")
    : [];
  return {
    ...(system || {}),
    graphs: { schema: 1, active: eventGraph.id, items: [eventGraph, ...others], variables: system?.graphs?.variables || [] },
    event_graph: eventGraph,
    node_graph_nodes: toLegacyNodes(eventGraph),
    node_graph_edges: toLegacyEdges(eventGraph),
  };
}

export function addNode(graph, node) {
  return { ...graph, nodes: [...graph.nodes, node] };
}

export function findPin(graph, nodeId, pinId) {
  const node = graph.nodes.find((item) => item.id === nodeId);
  return node?.pins?.find((item) => item.id === pinId) || null;
}

export function typesMatch(fromType, toType) {
  if (fromType === "exec" || toType === "exec") return fromType === "exec" && toType === "exec";
  if (fromType === "wildcard" || toType === "wildcard") return true;
  return fromType === toType;
}

export function canConnect(graph, fromNode, fromPin, toNode, toPin) {
  if (!fromNode || !toNode || fromNode === toNode) return { ok: false, reason: "A pin cannot connect to itself." };
  const source = findPin(graph, fromNode, fromPin);
  const target = findPin(graph, toNode, toPin);
  if (!source || !target) return { ok: false, reason: "That pin is missing." };
  let out = source;
  let inn = target;
  let outNode = fromNode;
  let outPin = fromPin;
  let inNode = toNode;
  let inPin = toPin;
  if (source.dir === "in" && target.dir === "out") {
    out = target;
    inn = source;
    outNode = toNode;
    outPin = toPin;
    inNode = fromNode;
    inPin = fromPin;
  }
  if (out.dir !== "out" || inn.dir !== "in") return { ok: false, reason: "Connect an output pin to an input pin." };
  if (!typesMatch(out.type, inn.type)) {
    return { ok: false, reason: `${typeLabel(out.type)} does not connect to ${typeLabel(inn.type)}.` };
  }
  return { ok: true, reason: "", from: { node: outNode, pin: outPin }, to: { node: inNode, pin: inPin }, exec: out.type === "exec" };
}

function typeLabel(type) {
  if (type === "exec") return "Execution";
  return String(type || "value").slice(0, 1).toUpperCase() + String(type || "value").slice(1);
}

export const GRAPH_LAYOUT = {
  nodeW: 210,
  header: 28,
  bodyPad: 8,
  row: 22,
  hitPx: 20,
};

export function nodeSize(node) {
  const rows = Math.max(
    (node?.pins || []).filter((item) => item.dir === "in").length,
    (node?.pins || []).filter((item) => item.dir === "out").length,
    1,
  );
  return { w: GRAPH_LAYOUT.nodeW, h: GRAPH_LAYOUT.header + GRAPH_LAYOUT.bodyPad + rows * GRAPH_LAYOUT.row + 8 };
}

export function pinCenter(node, pin) {
  const list = (node.pins || []).filter((item) => item.dir === pin.dir);
  const index = Math.max(0, list.findIndex((item) => item.id === pin.id));
  return {
    x: pin.dir === "in" ? node.x + 12 : node.x + GRAPH_LAYOUT.nodeW - 12,
    y: node.y + GRAPH_LAYOUT.header + GRAPH_LAYOUT.bodyPad + index * GRAPH_LAYOUT.row + GRAPH_LAYOUT.row / 2,
  };
}

// clientX/clientY and rect are viewport coordinates. scrollX/scrollY is the
// canvas's own scroll, which matters when the window is not fullscreen.
export function clientToGraphPoint({ clientX, clientY, rect, pan, zoom, scrollX = 0, scrollY = 0 }) {
  const scale = zoom || 1;
  return {
    x: (Number(clientX) - Number(rect?.left || 0) + Number(scrollX || 0) - Number(pan?.x || 0)) / scale,
    y: (Number(clientY) - Number(rect?.top || 0) + Number(scrollY || 0) - Number(pan?.y || 0)) / scale,
  };
}

function firstCompatiblePin(graph, fromNode, fromPin, node) {
  const source = findPin(graph, fromNode, fromPin);
  if (!source) return null;
  const want = source.dir === "out" ? "in" : "out";
  const pins = (node.pins || []).filter((item) => item.dir === want);
  const ordered = source.type === "exec" ? [...pins.filter((item) => item.type === "exec"), ...pins] : pins;
  return ordered.find((item) => canConnect(graph, fromNode, fromPin, node.id, item.id).ok) || null;
}

function rowPins(node) {
  const inputs = (node?.pins || []).filter((item) => item.dir === "in");
  const outputs = (node?.pins || []).filter((item) => item.dir === "out");
  const count = Math.max(inputs.length, outputs.length, 1);
  const rows = [];
  for (let index = 0; index < count; index += 1) rows.push({ input: inputs[index] || null, output: outputs[index] || null });
  return rows;
}

// One visual row. A row with only a Value pin targets that pin on either side,
// so a drop cannot fall through onto the Exec row above it.
export function pinAtPoint(node, point) {
  if (!node) return null;
  const rows = rowPins(node);
  const top = node.y + GRAPH_LAYOUT.header + GRAPH_LAYOUT.bodyPad;
  const bottom = top + rows.length * GRAPH_LAYOUT.row;
  if (point.y < top || point.y >= bottom) return null;
  if (point.x < node.x - 12 || point.x > node.x + GRAPH_LAYOUT.nodeW + 12) return null;
  const index = Math.min(rows.length - 1, Math.max(0, Math.floor((point.y - top) / GRAPH_LAYOUT.row)));
  const row = rows[index];
  if (row.input && !row.output) return row.input;
  if (row.output && !row.input) return row.output;
  return point.x < node.x + GRAPH_LAYOUT.nodeW / 2 ? row.input : row.output;
}

export function pinUnderPoint(graph, point) {
  for (const node of graph.nodes || []) {
    const pin = pinAtPoint(node, point);
    if (pin) return { nodeId: node.id, pinId: pin.id, dist: 0, score: 0 };
  }
  return null;
}

export function nodeUnderPoint(graph, point) {
  for (const node of graph.nodes || []) {
    const size = nodeSize(node);
    if (point.x >= node.x && point.y >= node.y && point.x <= node.x + size.w && point.y <= node.y + size.h) return node;
  }
  return null;
}

// A drop near a compatible pin wins. A drop on the node body uses its first compatible pin.
function compatibleOnNode(graph, fromNode, fromPin, node) {
  const source = findPin(graph, fromNode, fromPin);
  if (!source || !node || node.id === fromNode) return null;
  const want = source.dir === "out" ? "in" : "out";
  const pins = (node.pins || []).filter((item) => item.dir === want);
  const ordered = source.type === "exec"
    ? pins.filter((item) => item.type === "exec")
    : pins.filter((item) => item.type !== "exec");
  return ordered.find((item) => canConnect(graph, fromNode, fromPin, node.id, item.id).ok) || null;
}

export function pickWireTarget(graph, fromNode, fromPin, point, { targetNode, targetPin } = {}) {
  const source = findPin(graph, fromNode, fromPin);
  const near = pinUnderPoint(graph, point);
  const onRow = near && !(near.nodeId === fromNode && near.pinId === fromPin) ? near : null;
  const explicit = !onRow && targetNode && targetPin && !(targetNode === fromNode && targetPin === fromPin)
    ? { nodeId: targetNode, pinId: targetPin }
    : null;
  const chosen = onRow || explicit;
  if (chosen) {
    const check = canConnect(graph, fromNode, fromPin, chosen.nodeId, chosen.pinId);
    const hover = { nodeId: chosen.nodeId, pinId: chosen.pinId };
    if (check.ok) return { ok: true, nodeId: chosen.nodeId, pinId: chosen.pinId, how: "pin", hover };
    return { ok: false, reason: check.reason, how: "pin", nodeId: chosen.nodeId, pinId: chosen.pinId, hover };
  }
  const body = nodeUnderPoint(graph, point);
  if (body && body.id !== fromNode) {
    const pin = compatibleOnNode(graph, fromNode, fromPin, body) || firstCompatiblePin(graph, fromNode, fromPin, body);
    if (pin && pin.type !== "exec" && source?.type === "exec") {
      return { ok: false, reason: "Execution only connects to execution.", hover: null, how: "body" };
    }
    if (pin && source?.type !== "exec" && pin.type === "exec") {
      return { ok: false, reason: `${typeLabel(source?.type)} does not connect to Execution.`, hover: null, how: "body" };
    }
    if (pin) return { ok: true, nodeId: body.id, pinId: pin.id, how: "body", hover: { nodeId: body.id, pinId: pin.id } };
    return { ok: false, reason: "That node has no pin of the same type.", hover: null, how: "body" };
  }
  return { ok: false, reason: "Drop on a pin of the same type.", hover: near, how: "" };
}

export function tryWire(graph, fromNode, fromPin, toNode, toPin) {
  const check = canConnect(graph, fromNode, fromPin, toNode, toPin);
  if (!check.ok) return { graph, ok: false, reason: check.reason };
  let wires = graph.wires.filter((wire) => !(wire.from.node === check.from.node && wire.from.pin === check.from.pin && wire.to.node === check.to.node && wire.to.pin === check.to.pin));
  if (check.exec) {
    // An exec output has one wire. An exec input keeps every incoming wire.
    wires = wires.filter((wire) => !(wire.from.node === check.from.node && wire.from.pin === check.from.pin));
  } else {
    // A data input has one wire. A data output can fan out.
    wires = wires.filter((wire) => !(wire.to.node === check.to.node && wire.to.pin === check.to.pin));
  }
  wires = [...wires, { id: uid("w"), from: check.from, to: check.to }];
  return { graph: { ...graph, wires }, ok: true, reason: "" };
}

export function removeParts(graph, { nodes = [], wires = [], comments = [] } = {}) {
  const dropNodes = new Set(nodes);
  const dropWires = new Set(wires);
  const dropComments = new Set(comments);
  return {
    ...graph,
    nodes: graph.nodes.filter((node) => !dropNodes.has(node.id)),
    wires: graph.wires.filter((wire) => !dropWires.has(wire.id) && !dropNodes.has(wire.from.node) && !dropNodes.has(wire.to.node)),
    comments: graph.comments.filter((comment) => !dropComments.has(comment.id)),
  };
}

export function placeNodes(graph, positions) {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => (positions[node.id] ? { ...node, x: positions[node.id].x, y: positions[node.id].y } : node)),
    comments: graph.comments.map((comment) => (positions[comment.id] ? { ...comment, ...positions[comment.id], id: comment.id, text: positions[comment.id].text ?? comment.text } : comment)),
  };
}

export function addComment(graph, comment = {}) {
  return {
    ...graph,
    comments: [...graph.comments, {
      id: comment.id || uid("c"),
      x: Number(comment.x) || 0,
      y: Number(comment.y) || 0,
      w: Number(comment.w) || 280,
      h: Number(comment.h) || 160,
      text: comment.text || "Comment",
    }],
  };
}

export function duplicateParts(graph, { nodes = [], comments = [] } = {}, offset = 32) {
  const idMap = {};
  const copies = [];
  for (const id of nodes) {
    const node = graph.nodes.find((item) => item.id === id);
    if (!node) continue;
    const nextId = uid("n");
    idMap[id] = nextId;
    copies.push({ ...clone(node), id: nextId, x: node.x + offset, y: node.y + offset });
  }
  const wires = graph.wires
    .filter((wire) => idMap[wire.from.node] && idMap[wire.to.node])
    .map((wire) => ({
      id: uid("w"),
      from: { node: idMap[wire.from.node], pin: wire.from.pin },
      to: { node: idMap[wire.to.node], pin: wire.to.pin },
    }));
  const commentCopies = comments.map((id) => {
    const comment = graph.comments.find((item) => item.id === id);
    if (!comment) return null;
    return { ...comment, id: uid("c"), x: comment.x + offset, y: comment.y + offset };
  }).filter(Boolean);
  return {
    graph: {
      ...graph,
      nodes: [...graph.nodes, ...copies],
      wires: [...graph.wires, ...wires],
      comments: [...graph.comments, ...commentCopies],
    },
    nodeIds: Object.values(idMap),
    commentIds: commentCopies.map((comment) => comment.id),
  };
}

export function setNodeData(graph, nodeId, patch) {
  const nodes = graph.nodes.map((node) => {
    if (node.id !== nodeId) return node;
    const data = { ...(node.data || {}), ...patch };
    let pins = node.pins;
    if (node.catalog === "set-variable" || node.catalog === "get-variable") {
      const type = data.varType || "float";
      pins = node.pins.map((item) => (item.name === "Value" ? { ...item, type } : item));
    }
    if (node.catalog === "break-struct" || node.catalog === "make-struct") pins = structPins(node.catalog, data);
    return { ...node, data, pins, label: labelFor(node.catalog, data, node.label) };
  });
  const next = { ...graph, nodes };
  const wires = next.wires.filter((wire) => canConnect(next, wire.from.node, wire.from.pin, wire.to.node, wire.to.pin).ok);
  return { ...next, wires };
}

export function snapValue(value, enabled, grid = 16) {
  if (!enabled) return value;
  return Math.round(Number(value) / grid) * grid;
}

export function createHistory(graph) {
  return { past: [], present: normalizeGraph(graph), future: [] };
}

export function commitHistory(history, graph) {
  const present = normalizeGraph(graph);
  if (JSON.stringify(history.present) === JSON.stringify(present)) return history;
  return { past: [...history.past, history.present].slice(-100), present, future: [] };
}

export function undoHistory(history) {
  if (!history.past.length) return history;
  const present = history.past[history.past.length - 1];
  return { past: history.past.slice(0, -1), present, future: [history.present, ...history.future] };
}

export function redoHistory(history) {
  if (!history.future.length) return history;
  const [present, ...future] = history.future;
  return { past: [...history.past, history.present], present, future };
}

function cppType(text) {
  const low = String(text || "").toLowerCase();
  if (low.includes("bool")) return "bool";
  if (low.includes("float") || low.includes("double")) return "float";
  if (low.includes("int")) return "int";
  if (low.includes("fstring") || low.includes("fname") || low.includes("ftext")) return "string";
  return "object";
}

export function systemSymbols(system) {
  const variables = [];
  const functions = [];
  const seenVar = new Set();
  const seenFn = new Set();
  const addVar = (name, type, label) => {
    const id = ident(name, "");
    if (!id || seenVar.has(id)) return;
    seenVar.add(id);
    variables.push({ name: id, type, label: label || id });
  };
  for (const param of system?.tunable_parameters || []) {
    const value = param?.value;
    const type = typeof value === "boolean" ? "bool" : typeof value === "number" ? (Number.isInteger(value) ? "int" : "float") : "string";
    addVar(param.key || param.label, type, param.label || param.key);
  }
  const header = String(system?.cpp_header || "");
  const lines = header.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes("UPROPERTY")) continue;
    const decl = lines.slice(i, i + 4).join(" ");
    const match = decl.match(/UPROPERTY\s*\([^)]*\)\s+([\w:*&<>,\s]+?)\s+([A-Za-z_]\w*)\s*[;={]/);
    if (match) addVar(match[2], cppType(match[1]), match[2]);
  }
  for (const match of header.matchAll(/UFUNCTION\s*\([^)]*\)[\s\S]*?\b([A-Za-z_]\w*)\s*\(/g)) {
    const name = match[1];
    if (!name || name.startsWith("Graph_") || seenFn.has(name)) continue;
    seenFn.add(name);
    functions.push(name);
  }
  return { variables, functions };
}

function classNameOf(header) {
  const match = String(header || "").match(/\bclass\s+(?:[A-Z0-9_]+_API\s+)?([UA][A-Za-z0-9_]*)\b/);
  return match ? match[1] : "UGraphSystem";
}

// HasAuthority() is an AActor method. Generated kit classes are UActorComponent,
// so a component has to ask its owner. Actor subclasses keep the direct call.
function authorityCall(graph) {
  const header = String(graph?.cppHeader || "");
  if (/:\s*public\s+(?:[A-Za-z0-9_]+_API\s+)?A[A-Z]\w*/.test(header)) return "HasAuthority()";
  return "GetOwner() && GetOwner()->HasAuthority()";
}

function functionBase(node) {
  const tail = ident(node.id, "Node");
  if (node.catalog === "on-rep") return `OnRep_${ident(node.data?.variable || "Value")}`;
  if (node.catalog === "custom-event") return `Graph_${ident(node.data?.name || "Custom", "Custom")}_${tail}`;
  return `Graph_${ident(node.label, "Event")}_${tail}`;
}

function byPos(a, b) {
  return a.y - b.y || a.x - b.x || String(a.id).localeCompare(String(b.id));
}

function outgoing(graph, node, pinId) {
  const wire = graph.wires.find((item) => item.from.node === node.id && item.from.pin === pinId);
  if (!wire) return null;
  return graph.nodes.find((item) => item.id === wire.to.node) || null;
}

function literalCpp(node) {
  const type = node.data?.varType || "float";
  const raw = node.data?.value;
  if (type === "bool") return /^(true|1)$/i.test(String(raw || "")) ? "true" : "false";
  if (type === "int") {
    const n = Number.parseInt(String(raw ?? "0").replace(/[^0-9-]/g, ""), 10);
    return Number.isFinite(n) ? String(n) : "0";
  }
  if (type === "string") return `TEXT("${String(raw || "").replace(/["\\]/g, "")}")`;
  if (type === "name") return `FName(TEXT("${String(raw || "None").replace(/["\\]/g, "")}"))`;
  const n = Number.parseFloat(String(raw ?? "0").replace(/f$/i, ""));
  return cppFloat(n);
}

function cppFloat(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.f";
  const text = String(n);
  return text.includes(".") ? `${text}f` : `${text}.f`;
}

function exprFor(graph, node, seen = new Set(), outPin = null) {
  if (!node || seen.has(node.id)) return "0";
  const next = new Set(seen);
  next.add(node.id);
  const arg = (name, fallback) => incomingValue(graph, node, name, next) || fallback;
  switch (node.catalog) {
    case "get-variable": return ident(node.data?.variable || "Value");
    case "literal": return literalCpp(node);
    case "has-authority": return authorityCall(graph);
    case "add": return `(${arg("A", "0")} + ${arg("B", "0")})`;
    case "subtract": return `(${arg("A", "0")} - ${arg("B", "0")})`;
    case "multiply": return `(${arg("A", "0")} * ${arg("B", "0")})`;
    case "divide": return `(${arg("A", "1")} / ${arg("B", "1")})`;
    case "clamp": return `FMath::Clamp(${arg("Value", "0")}, ${arg("Min", "0")}, ${arg("Max", "0")})`;
    case "lerp": return `FMath::Lerp(${arg("A", "0")}, ${arg("B", "0")}, ${arg("Alpha", "0")})`;
    case "equal": return `(${arg("A", "0")} == ${arg("B", "0")})`;
    case "greater": return `(${arg("A", "0")} > ${arg("B", "0")})`;
    case "less": return `(${arg("A", "0")} < ${arg("B", "0")})`;
    case "and": return `(${arg("A", "false")} && ${arg("B", "false")})`;
    case "or": return `(${arg("A", "false")} || ${arg("B", "false")})`;
    case "not": return `(!${arg("A", "false")})`;
    case "select": return `(${arg("Pick", "true")} ? ${arg("A", "0")} : ${arg("B", "0")})`;
    case "line-trace": return outPin?.name === "Hit Actor" ? `Hit_${ident(node.id, "Trace")}.GetActor()` : `bHit_${ident(node.id, "Trace")}`;
    case "cast-to": return `Cast_${ident(node.id, "Cast")}`;
    case "make-struct": return `Made_${ident(node.id, "Make")}`;
    case "break-struct": return breakMemberExpr(node, outPin);
    case "timeline": return outPin?.name === "Alpha" ? "Alpha" : "0.f";
    case "any-damage":
    case "point-damage": return "Damage";
    case "begin-overlap":
    case "end-overlap":
    case "hit": return "OtherActor";
    case "tick": return "DeltaSeconds";
    default: return ident(node.label, "Value");
  }
}

function incomingValue(graph, node, pinName, seen = new Set()) {
  const pinItem = node.pins.find((item) => item.dir === "in" && item.name === pinName);
  if (!pinItem) return "";
  const wire = graph.wires.find((item) => item.to.node === node.id && item.to.pin === pinItem.id);
  if (!wire) return "";
  const source = graph.nodes.find((item) => item.id === wire.from.node);
  if (!source) return "";
  const sourcePin = source.pins.find((item) => item.id === wire.from.pin) || null;
  return exprFor(graph, source, seen, sourcePin);
}

function cppDefault(type) {
  if (type === "bool") return "false";
  if (type === "int") return "0";
  if (type === "vector") return "FVector::ZeroVector";
  if (type === "rotator") return "FRotator::ZeroRotator";
  if (type === "string") return "TEXT(\"\")";
  if (type === "name") return "NAME_None";
  if (type === "object" || type === "struct") return "nullptr";
  return "0.f";
}

function assignStructMember(structName, local, member, value) {
  if (structName === "FTransform" && member === "Location") return `${local}.SetLocation(${value});`;
  if (structName === "FTransform" && member === "Rotation") return `${local}.SetRotation((${value}).Quaternion());`;
  if (structName === "FTransform" && member === "Scale") return `${local}.SetScale3D(${value});`;
  return `${local}.${member} = ${value};`;
}

function breakMemberExpr(node, outPin) {
  const local = `Broken_${ident(node.id, "Break")}`;
  const member = outPin?.name;
  if (!member || member === "Exec" || member === "Struct") return local;
  if (resolveStruct(node.data).name === "FTransform") {
    if (member === "Location") return `${local}.GetLocation()`;
    if (member === "Rotation") return `${local}.GetRotation().Rotator()`;
    if (member === "Scale") return `${local}.GetScale3D()`;
  }
  return `${local}.${member}`;
}

function interfacePair(raw) {
  const name = ident(raw || "", "");
  if (!name || name === "Interface") return null;
  if (name.startsWith("U") && name.length > 1) return { u: name, i: `I${name.slice(1)}` };
  if (name.startsWith("I") && name.length > 1) return { u: `U${name.slice(1)}`, i: name };
  return { u: `U${name}`, i: `I${name}` };
}

function dispatcherMember(node) {
  return ident(node.data?.name || "OnChanged", "OnChanged");
}

function dispatcherHandler(graph, node) {
  const eventName = node.data?.event || node.data?.name || "OnChanged";
  const target = (graph.nodes || []).find((item) => item.catalog === "custom-event" && item.data?.name === eventName);
  if (target) return functionBase(target);
  return `On${dispatcherMember(node)}Bound_${ident(node.id, "Bind")}`;
}

function timelineStatement(node, graph) {
  const id = ident(node.id, "Timeline");
  const cls = graph.cppClass || "UKitComponent";
  return `if (!Timeline_${id}) { AActor* TimelineOwner_${id} = GetOwner(); Timeline_${id} = NewObject<UTimelineComponent>(TimelineOwner_${id} ? static_cast<UObject*>(TimelineOwner_${id}) : static_cast<UObject*>(this)); Timeline_${id}->PrimaryComponentTick.bCanEverTick = true; Timeline_${id}->SetComponentTickEnabled(true); if (TimelineOwner_${id}) { Timeline_${id}->RegisterComponent(); } UCurveFloat* Curve_${id} = NewObject<UCurveFloat>(this); Curve_${id}->FloatCurve.AddKey(0.f, 0.f); Curve_${id}->FloatCurve.AddKey(1.f, 1.f); FOnTimelineFloat Update_${id}; Update_${id}.BindDynamic(this, &${cls}::OnTimelineUpdate_${id}); Timeline_${id}->AddInterpFloat(Curve_${id}, Update_${id}); FOnTimelineEvent Finished_${id}; Finished_${id}.BindDynamic(this, &${cls}::OnTimelineFinished_${id}); Timeline_${id}->SetTimelineFinishedFunc(Finished_${id}); } Timeline_${id}->PlayFromStart();`;
}

function statementFor(node, graph) {
  const id = ident(node.id, "Node");
  switch (node.catalog) {
    case "print-string": {
      const text = String(node.data?.text ?? "Hello").replace(/["\\]/g, "'");
      const wired = incomingValue(graph, node, "In String");
      return `UE_LOG(LogTemp, Display, TEXT("%s"), ${wired ? `${wired}` : `TEXT("${text}")`});`;
    }
    case "set-variable": {
      const name = ident(node.data?.variable || "Value");
      const wired = incomingValue(graph, node, "Value");
      const fallback = defaultLiteral({ type: node.data?.varType || "float" });
      const value = wired && wired !== name ? wired : fallback;
      return `${name} = ${value};`;
    }
    case "call-function": {
      const fn = ident(node.data?.function || node.label || "Function", "Function");
      if (/destroy/i.test(fn)) return "if (AActor* GraphOwner = GetOwner()) { GraphOwner->Destroy(); }";
      return `${fn}();`;
    }
    case "line-trace": {
      const local = ident(node.id, "Trace");
      return `FHitResult Hit_${local}; bool bHit_${local} = false; if (UWorld* World_${local} = GetWorld()) { const FVector Start_${local} = GetOwner() ? GetOwner()->GetActorLocation() : FVector::ZeroVector; bHit_${local} = World_${local}->LineTraceSingleByChannel(Hit_${local}, Start_${local}, Start_${local} + FVector(200.f, 0.f, 0.f), ECC_Visibility); }`;
    }
    case "interface-call": {
      const local = ident(node.id, "Call");
      const target = incomingValue(graph, node, "Target") || "nullptr";
      const message = ident(node.data?.function || "Interact", "Interact");
      const pair = interfacePair(node.data?.interface);
      if (pair) return `if (AActor* Target_${local} = Cast<AActor>(${target})) { if (Target_${local}->GetClass()->ImplementsInterface(${pair.u}::StaticClass())) { ${pair.i}::Execute_${message}(Target_${local}); } }`;
      return `if (AActor* Target_${local} = Cast<AActor>(${target})) { if (UFunction* Fn_${local} = Target_${local}->FindFunction(TEXT("${message}"))) { Target_${local}->ProcessEvent(Fn_${local}, nullptr); } }`;
    }
    case "set-timer":
    case "set-timer-event":
    case "set-timer-function": {
      const seconds = Number(node.data?.seconds) || Number(incomingValue(graph, node, "Time")) || 1;
      const eventName = node.catalog === "set-timer-function" ? (node.data?.function || "OnTimer") : (node.data?.event || "Timer");
      const target = (graph.nodes || []).find((item) => item.catalog === "custom-event" && item.data?.name === eventName);
      const method = target ? functionBase(target) : "";
      const cls = graph.cppClass || "UKitComponent";
      const looping = node.catalog === "set-timer-function" ? "false" : "true";
      if (method) return `if (UWorld* World = GetWorld()) { FTimerHandle Timer_${id}; World->GetTimerManager().SetTimer(Timer_${id}, this, &${cls}::${method}, ${cppFloat(seconds)}, ${looping}); }`;
      return `if (UWorld* World = GetWorld()) { FTimerHandle Timer_${id}; FTimerDelegate Delegate_${id}; Delegate_${id}.BindUFunction(this, TEXT("${ident(eventName, "Timer")}")); World->GetTimerManager().SetTimer(Timer_${id}, Delegate_${id}, ${cppFloat(seconds)}, ${looping}); }`;
    }
    case "spawn-actor":
      return `if (UWorld* World = GetWorld()) { World->SpawnActor<${ident(node.data?.className || "AActor", "AActor")}>(${ident(node.data?.className || "AActor", "AActor")}::StaticClass()); }`;
    case "cast-to": {
      const wired = incomingValue(graph, node, "Object") || "nullptr";
      const clsName = ident(node.data?.className || "AActor", "AActor");
      return `${clsName}* Cast_${id} = Cast<${clsName}>(${wired});`;
    }
    case "delay":
      return `if (UWorld* World = GetWorld()) { FTimerHandle Delay_${id}; World->GetTimerManager().SetTimer(Delay_${id}, FTimerDelegate(), ${cppFloat(Number(node.data?.seconds) || 0.5)}, false); }`;
    case "timeline":
      return timelineStatement(node, graph);
    case "break-struct": {
      const spec = resolveStruct(node.data);
      const incoming = incomingValue(graph, node, "Struct") || spec.construct;
      return `${spec.name} Broken_${id} = ${incoming};`;
    }
    case "make-struct": {
      const spec = resolveStruct(node.data);
      const parts = [`${spec.name} Made_${id} = ${spec.construct};`];
      for (const member of spec.members) {
        const wired = incomingValue(graph, node, member.name);
        const value = wired || (spec.name === "FTransform" && member.name === "Scale" ? "FVector::OneVector" : cppDefault(member.type));
        parts.push(assignStructMember(spec.name, `Made_${id}`, member.name, value));
      }
      return parts.join(" ");
    }
    case "has-authority":
      return "";
    case "dispatcher-call":
      return `${dispatcherMember(node)}.Broadcast();`;
    case "dispatcher-bind": {
      const name = dispatcherMember(node);
      const cls = graph.cppClass || "UKitComponent";
      return `${name}.AddDynamic(this, &${cls}::${dispatcherHandler(graph, node)});`;
    }
    case "branch":
    case "sequence":
    case "forloop":
    case "foreach":
    case "while":
      return "";
    case "add": return `/* add */ ${incomingValue(graph, node, "A") || "0"} + ${incomingValue(graph, node, "B") || "0"};`;
    case "subtract": return `/* subtract */ ${incomingValue(graph, node, "A") || "0"} - ${incomingValue(graph, node, "B") || "0"};`;
    case "multiply": return `/* multiply */ ${incomingValue(graph, node, "A") || "0"} * ${incomingValue(graph, node, "B") || "0"};`;
    case "divide": return `/* divide */ ${incomingValue(graph, node, "A") || "1"} / ${incomingValue(graph, node, "B") || "1"};`;
    case "clamp": return `FMath::Clamp(${incomingValue(graph, node, "Value") || "0"}, ${incomingValue(graph, node, "Min") || "0"}, ${incomingValue(graph, node, "Max") || "1"});`;
    case "lerp": return `FMath::Lerp(${incomingValue(graph, node, "A") || "0"}, ${incomingValue(graph, node, "B") || "0"}, ${incomingValue(graph, node, "Alpha") || "0"});`;
    case "equal": return `/* equal */ ${incomingValue(graph, node, "A") || "A"} == ${incomingValue(graph, node, "B") || "B"};`;
    case "greater": return `/* greater */ ${incomingValue(graph, node, "A") || "0"} > ${incomingValue(graph, node, "B") || "0"};`;
    case "less": return `/* less */ ${incomingValue(graph, node, "A") || "0"} < ${incomingValue(graph, node, "B") || "0"};`;
    case "and": return `(${incomingValue(graph, node, "A") || "false"} && ${incomingValue(graph, node, "B") || "false"});`;
    case "or": return `(${incomingValue(graph, node, "A") || "false"} || ${incomingValue(graph, node, "B") || "false"});`;
    case "not": return `!(${incomingValue(graph, node, "A") || "false"});`;
    case "do-once": return `if (!DoneOnce_${ident(node.id, "Once")}) { DoneOnce_${ident(node.id, "Once")} = true; }`;
    case "gate": return `if (GateOpen_${ident(node.id, "Gate")}) { /* exit */ }`;
    case "flipflop": return `Flip_${ident(node.id, "Flip")} = !Flip_${ident(node.id, "Flip")};`;
    case "select": return `/* select */ ${incomingValue(graph, node, "Pick") || "true"} ? ${incomingValue(graph, node, "A") || "A"} : ${incomingValue(graph, node, "B") || "B"};`;
    case "call-user": return `${ident(node.data?.function || node.label, "Function")}(); // node:${node.id}`;
    case "call-macro": return "";
    default:
      return `// ${String(node.label || "Node").replace(/\*\//g, "")}`;
  }
}

function emitBody(graph, node, indent, seen, out) {
  if (!node || seen.has(node.id)) return;
  const nextSeen = new Set(seen);
  nextSeen.add(node.id);
  const execOut = node.pins.filter((item) => item.dir === "out" && item.type === "exec");
  if (node.catalog === "branch") {
    const cond = incomingValue(graph, node, "Condition") || "true";
    out.push(`${indent}if (${cond}) // node:${node.id}`);
    out.push(`${indent}{`);
    emitBody(graph, outgoing(graph, node, execOut.find((item) => item.name === "Then")?.id), `${indent}\t`, new Set(nextSeen), out);
    out.push(`${indent}}`);
    out.push(`${indent}else`);
    out.push(`${indent}{`);
    emitBody(graph, outgoing(graph, node, execOut.find((item) => item.name === "Else")?.id), `${indent}\t`, new Set(nextSeen), out);
    out.push(`${indent}}`);
    return;
  }
  if (node.catalog === "forloop" || node.catalog === "foreach" || node.catalog === "while") {
    const local = ident(node.id, "Loop");
    const head = node.catalog === "forloop"
      ? `for (int32 Index_${local} = ${incomingValue(graph, node, "First") || "0"}; Index_${local} <= ${incomingValue(graph, node, "Last") || "0"}; ++Index_${local})`
      : node.catalog === "foreach"
        ? `for (auto& Element_${local} : ${incomingValue(graph, node, "Array") || "Items"})`
        : `while (${incomingValue(graph, node, "Condition") || "true"})`;
    out.push(`${indent}${head} // node:${node.id}`);
    out.push(`${indent}{`);
    emitBody(graph, outgoing(graph, node, node.pins.find((item) => item.name === "Loop Body")?.id), `${indent}\t`, new Set(nextSeen), out);
    out.push(`${indent}}`);
    emitBody(graph, outgoing(graph, node, node.pins.find((item) => item.name === "Completed")?.id), indent, new Set(nextSeen), out);
    return;
  }
  if (node.catalog === "call-macro") {
    out.push(`${indent}// macro ${node.data?.function || node.label} // node:${node.id}`);
    const macro = (graph.macros || []).find((item) => item.id === node.data?.graphId);
    const start = macro?.nodes?.find((item) => item.catalog === "macro-in");
    if (macro && start) emitBody({ ...macro, macros: graph.macros, cppHeader: graph.cppHeader, cppClass: graph.cppClass }, outgoing(macro, start, start.pins.find((item) => item.type === "exec" && item.dir === "out")?.id), indent, nextSeen, out);
    const done = node.pins.find((item) => item.dir === "out" && item.type === "exec");
    if (done) emitBody(graph, outgoing(graph, node, done.id), indent, nextSeen, out);
    return;
  }
  if (node.catalog === "timeline") {
    const line = statementFor(node, graph);
    if (line) out.push(`${indent}${line} // node:${node.id}`);
    return;
  }
  if (node.catalog === "has-authority") {
    out.push(`${indent}if (${authorityCall(graph)}) // node:${node.id}`);
    out.push(`${indent}{`);
    if (execOut[0]) emitBody(graph, outgoing(graph, node, execOut[0].id), `${indent}\t`, nextSeen, out);
    out.push(`${indent}}`);
    return;
  }
  if (node.catalog === "cast-to") {
    const line = statementFor(node, graph);
    if (line) out.push(`${indent}${line} // node:${node.id}`);
    out.push(`${indent}if (Cast_${ident(node.id, "Cast")})`);
    out.push(`${indent}{`);
    if (execOut[0]) emitBody(graph, outgoing(graph, node, execOut[0].id), `${indent}\t`, nextSeen, out);
    out.push(`${indent}}`);
    return;
  }
  if (execOut.length > 1) {
    out.push(`${indent}// node:${node.id}`);
    const line = statementFor(node, graph);
    if (line) out.push(`${indent}${line}`);
    execOut.forEach((item) => {
      out.push(`${indent}// ${item.name}`);
      out.push(`${indent}{`);
      emitBody(graph, outgoing(graph, node, item.id), `${indent}\t`, new Set(nextSeen), out);
      out.push(`${indent}}`);
    });
    return;
  }
  const line = statementFor(node, graph);
  out.push(line ? `${indent}${line} // node:${node.id}` : `${indent}// node:${node.id}`);
  if (execOut[0]) emitBody(graph, outgoing(graph, node, execOut[0].id), indent, nextSeen, out);
}

function cppForType(spec) {
  const map = { bool: "bool", int: "int32", float: "float", vector: "FVector", rotator: "FRotator", string: "FString", name: "FName", object: "UObject*", actor: "AActor*" };
  const base = spec?.type === "struct"
    ? ident(spec.structName || "FCustomStruct", "FCustomStruct")
    : spec?.type === "enum" ? ident(spec.enumName || "EGraph", "EGraph") : (map[spec?.type] || "float");
  return spec?.array ? `TArray<${base.replace("*", "")}>` : base;
}

function defaultLiteral(spec) {
  if (spec?.default != null && spec.default !== "") {
    const raw = String(spec.default);
    if (spec?.type === "float" && /^\d+f$/i.test(raw.trim())) return raw.trim().replace(/f$/i, ".f");
    return raw;
  }
  if (spec?.array) return "{}";
  if (spec?.type === "bool") return "false";
  if (spec?.type === "string") return "TEXT(\"\")";
  if (spec?.type === "name") return "NAME_None";
  if (spec?.type === "vector") return "FVector::ZeroVector";
  if (spec?.type === "rotator") return "FRotator::ZeroRotator";
  if (spec?.type === "object" || spec?.type === "actor") return "nullptr";
  if (spec?.type === "int") return "0";
  if (spec?.type === "float") return "0.f";
  return "0";
}

function rpcMacro(catalog) {
  if (catalog === "server-rpc") return "UFUNCTION(Server, Reliable)";
  if (catalog === "client-rpc") return "UFUNCTION(Client, Reliable)";
  if (catalog === "multicast-rpc") return "UFUNCTION(NetMulticast, Reliable)";
  if (catalog === "begin-overlap" || catalog === "end-overlap" || catalog === "hit" || catalog === "any-damage" || catalog === "point-damage") return "UFUNCTION()";
  return "UFUNCTION(BlueprintCallable, Category=\"EventGraph\")";
}

function eventParams(node) {
  const map = {
    "begin-overlap": "UPrimitiveComponent* OverlappedComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp, int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult",
    "end-overlap": "UPrimitiveComponent* OverlappedComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp, int32 OtherBodyIndex",
    hit: "UPrimitiveComponent* HitComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp, FVector NormalImpulse, const FHitResult& Hit",
    "any-damage": "AActor* DamagedActor, float Damage, const UDamageType* DamageType, AController* InstigatedBy, AActor* DamageCauser",
    "point-damage": "AActor* DamagedActor, float Damage, AController* InstigatedBy, FVector HitLocation, UPrimitiveComponent* HitComponent, FName BoneName, FVector ShotFromDirection, const UDamageType* DamageType, AActor* DamageCauser",
    tick: "float DeltaSeconds",
  };
  return map[node?.catalog] || "";
}

export function syncCpp(system, graph) {
  const eventGraph = normalizeGraph(graph);
  const docItems = Array.isArray(system?.graphs?.items) ? system.graphs.items : [];
  eventGraph.macros = docItems.filter((item) => item && item.kind === "macro");
  const cls = classNameOf(system?.cpp_header);
  eventGraph.cppClass = cls;
  eventGraph.cppHeader = system?.cpp_header || "";
  const events = eventGraph.nodes.filter((node) => node.kind === "event").sort(byPos);
  const headerLines = ["public:"];
  const sourceLines = [];
  if (!events.length) {
    headerLines.push("\t// No event graph handlers.");
    sourceLines.push("// No event graph handlers.");
  }
  const componentBinds = [];
  const actorBinds = [];
  for (const event of events) {
    const base = functionBase(event);
    const cppName = RPCS.has(event.catalog) ? `${base}_Implementation` : base;
    const params = eventParams(event);
    headerLines.push(`\t${rpcMacro(event.catalog)}`);
    headerLines.push(`\tvoid ${base}(${params}); // node:${event.id}`);
    sourceLines.push(`void ${cls}::${cppName}(${params}) // node:${event.id}`);
    sourceLines.push("{");
    const first = outgoing(eventGraph, event, event.pins.find((item) => item.dir === "out" && item.type === "exec")?.id);
    emitBody(eventGraph, first, "\t", new Set([event.id]), sourceLines);
    sourceLines.push("}");
    sourceLines.push("");
    if (event.catalog === "begin-overlap") componentBinds.push(`Prim->OnComponentBeginOverlap.AddDynamic(this, &${cls}::${base});`);
    if (event.catalog === "end-overlap") componentBinds.push(`Prim->OnComponentEndOverlap.AddDynamic(this, &${cls}::${base});`);
    if (event.catalog === "hit") componentBinds.push(`Prim->OnComponentHit.AddDynamic(this, &${cls}::${base});`);
    if (event.catalog === "any-damage") actorBinds.push(`Owner->OnTakeAnyDamage.AddDynamic(this, &${cls}::${base});`);
    if (event.catalog === "point-damage") actorBinds.push(`Owner->OnTakePointDamage.AddDynamic(this, &${cls}::${base});`);
  }
  const outsideGraph = (text) => String(text || "").replace(/\/\/ graph:begin[\s\S]*?\/\/ graph:end[^\n]*\n?/g, "");
  const beginNodes = events.filter((event) => event.catalog === "begin-play");
  const alreadyBegins = new RegExp(`\\b${cls}::BeginPlay\\s*\\(`).test(outsideGraph(system?.cpp_source))
    || /\bvoid\s+BeginPlay\s*\(/.test(outsideGraph(system?.cpp_header));
  if ((componentBinds.length || actorBinds.length || beginNodes.length) && !alreadyBegins) {
    headerLines.push("\tvirtual void BeginPlay() override;");
    sourceLines.push(`void ${cls}::BeginPlay()`);
    sourceLines.push("{");
    sourceLines.push("\tSuper::BeginPlay();");
    if (actorBinds.length || componentBinds.length) {
      sourceLines.push("\tif (AActor* Owner = GetOwner())");
      sourceLines.push("\t{");
      for (const line of actorBinds) sourceLines.push(`\t\t${line}`);
      if (componentBinds.length) {
        sourceLines.push("\t\tTArray<UPrimitiveComponent*> Prims;");
        sourceLines.push("\t\tOwner->GetComponents<UPrimitiveComponent>(Prims);");
        sourceLines.push("\t\tfor (UPrimitiveComponent* Prim : Prims)");
        sourceLines.push("\t\t{");
        for (const line of componentBinds) sourceLines.push(`\t\t\t${line}`);
        sourceLines.push("\t\t}");
      }
      sourceLines.push("\t}");
    }
    for (const event of beginNodes) sourceLines.push(`\t${functionBase(event)}();`);
    sourceLines.push("}");
    sourceLines.push("");
  }
  const variables = Array.isArray(system?.graphs?.variables) ? system.graphs.variables : [];
  const variableHeader = [];
  const variableSource = [];
  for (const variable of variables) {
    const name = ident(variable.name, "Value");
    const flags = variable.replicated
      ? (variable.repNotify ? `ReplicatedUsing=OnRep_${name}` : "Replicated")
      : "EditAnywhere, BlueprintReadWrite";
    variableHeader.push(`\tUPROPERTY(${flags}, Category="Graph")`);
    variableHeader.push(`\t${cppForType(variable)} ${name} = ${defaultLiteral(variable)};`);
    if (variable.repNotify) {
      variableHeader.push(`\tUFUNCTION()`);
      variableHeader.push(`\tvoid OnRep_${name}();`);
      variableSource.push(`void ${cls}::OnRep_${name}()`, "{", "}", "");
    }
  }
  if (variables.some((variable) => variable.replicated)) {
    variableHeader.push(`\tvirtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;`);
    variableSource.push(`void ${cls}::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const`, "{", "\tSuper::GetLifetimeReplicatedProps(OutLifetimeProps);");
    for (const variable of variables.filter((item) => item.replicated)) {
      variableSource.push(`\tDOREPLIFETIME(${cls}, ${ident(variable.name, "Value")});`);
    }
    variableSource.push("}", "");
  }
  const functions = docItems.filter((item) => item && item.kind === "function");
  const functionBlocks = functions.map((fn) => {
    const inputs = Array.isArray(fn.inputs) ? fn.inputs : [];
    const outputs = Array.isArray(fn.outputs) ? fn.outputs : [];
    const params = inputs.map((item) => `${cppForType(item)} ${ident(item.name, "In")}`).join(", ");
    const ret = outputs[0];
    const retType = ret ? cppForType(ret) : "void";
    const name = ident(fn.name, "Function");
    const macro = fn.pure ? `UFUNCTION(BlueprintPure, Category="Graph")` : (fn.callable === false ? `UFUNCTION(Category="Graph")` : `UFUNCTION(BlueprintCallable, Category="Graph")`);
    const entry = (fn.nodes || []).find((node) => node.catalog === "entry");
    const header = [`\t${macro}`, `\t${retType} ${name}(${params})${fn.pure ? " const" : ""};${entry ? ` // node:${entry.id}` : ""}`].join("\n");
    const body = [];
    body.push(`${retType} ${cls}::${name}(${params})${fn.pure ? " const" : ""}`);
    body.push("{");
    const startPin = entry?.pins?.find((item) => item.dir === "out" && item.type === "exec");
    emitBody({ ...fn, macros: eventGraph.macros }, entry && startPin ? outgoing(fn, entry, startPin.id) : null, "\t", new Set(entry ? [entry.id] : []), body);
    if (ret) body.push(`\treturn ${defaultLiteral(ret)};`);
    body.push("}");
    return { name: fn.name, header, source: body.join("\n") };
  });
  const isComponent = /\bpublic\s+[UA][A-Za-z0-9_]*Component\b/.test(String(system?.cpp_header || ""));
  const alreadyTicks = /\bTickComponent\s*\(/.test(outsideGraph(system?.cpp_header)) || /\bTickComponent\s*\(/.test(outsideGraph(system?.cpp_source));
  const support = graphSupport([eventGraph, ...docItems.filter((item) => item && item !== eventGraph && Array.isArray(item.nodes))], cls, isComponent && !alreadyTicks);
  headerLines.push(...support.header);
  if (support.source.length) sourceLines.push(support.source.join("\n"));
  let header = spliceMarked(system?.cpp_header || "", headerLines.join("\n"), true);
  let source = spliceMarked(system?.cpp_source || "", sourceLines.join("\n").trimEnd(), false);
  header = stripNamedRegions(header, "function");
  source = stripNamedRegions(source, "function");
  header = upsertRegion(header, "// graph:begin variables", "// graph:end variables", variableHeader.join("\n") || "\t// No graph variables.", true);
  source = upsertRegion(source, "// graph:begin variables", "// graph:end variables", variableSource.join("\n").trim() || "// No graph variables.", false);
  for (const block of functionBlocks) {
    header = upsertRegion(header, `// graph:begin function ${block.name}`, `// graph:end function ${block.name}`, block.header, true);
    source = upsertRegion(source, `// graph:begin function ${block.name}`, `// graph:end function ${block.name}`, block.source, false);
  }
  header = upsertBeforeClass(header, support.beforeClass);
  if (/UTimelineComponent/.test(header) || /UTimelineComponent/.test(source)) {
    header = ensureHeaderInclude(header, "Components/ActorComponent.h");
    header = ensureHeaderInclude(header, "Components/TimelineComponent.h");
  }
  const needs = [
    [/GetWorld\s*\(/, "Engine/World.h"],
    [/UTimelineComponent|FOnTimelineFloat|FOnTimelineEvent|PlayFromStart/, "Components/TimelineComponent.h"],
    [/UCurveFloat|FloatCurve/, "Curves/CurveFloat.h"],
    [/FHitResult|LineTraceSingleByChannel|OnComponentBeginOverlap|OnComponentEndOverlap|OnComponentHit/, "Engine/HitResult.h"],
    [/UPrimitiveComponent/, "Components/PrimitiveComponent.h"],
    [/GetOwner\s*\(|->Destroy\s*\(|OnTakeAnyDamage|OnTakePointDamage|GetActorLocation/, "GameFramework/Actor.h"],
    [/UDamageType/, "Engine/DamageEvents.h"],
  ];
  const headerText = String(system?.cpp_header || "");
  for (const [pattern, include] of needs) {
    if (pattern.test(source) && !source.includes(include) && !headerText.includes(include)) {
      source = insertCppInclude(source, include);
    }
  }
  const stateLines = stateMembers(stateNodes(eventGraph, docItems));
  if (stateLines.length) header = upsertRegion(header, "// graph:begin variables", "// graph:end variables", [...variableHeader, ...stateLines].join("\n"), true);
  return { cpp_header: header, cpp_source: source, lines: lineIndex(header, source) };
}

function graphSupport(graphs, cls, allowTick) {
  const header = [];
  const source = [];
  const beforeClass = [];
  const seenTimeline = new Set();
  const seenDelegate = new Set();
  const seenHandler = new Set();
  const timelines = [];
  for (const graph of graphs) {
    if (!graph) continue;
    const withClass = { ...graph, cppClass: cls, nodes: graph.nodes || [], wires: graph.wires || [] };
    for (const node of withClass.nodes) {
      if (node?.catalog === "timeline" && !seenTimeline.has(node.id)) {
        seenTimeline.add(node.id);
        timelines.push(node);
        const id = ident(node.id, "Timeline");
        header.push("\tUPROPERTY()");
        header.push(`\tUTimelineComponent* Timeline_${id} = nullptr;`);
        header.push("\tUFUNCTION()");
        header.push(`\tvoid OnTimelineUpdate_${id}(float Alpha);`);
        header.push("\tUFUNCTION()");
        header.push(`\tvoid OnTimelineFinished_${id}();`);
        const updatePin = (node.pins || []).find((item) => item.name === "Update" && item.dir === "out");
        const finishedPin = (node.pins || []).find((item) => item.name === "Finished" && item.dir === "out");
        source.push(`void ${cls}::OnTimelineUpdate_${id}(float Alpha)`, "{");
        emitBody(withClass, updatePin ? outgoing(withClass, node, updatePin.id) : null, "\t", new Set([node.id]), source);
        source.push("}", "");
        source.push(`void ${cls}::OnTimelineFinished_${id}()`, "{");
        emitBody(withClass, finishedPin ? outgoing(withClass, node, finishedPin.id) : null, "\t", new Set([node.id]), source);
        source.push("}", "");
      }
      if ((node?.catalog === "dispatcher-call" || node?.catalog === "dispatcher-bind") && !seenDelegate.has(dispatcherMember(node))) {
        const name = dispatcherMember(node);
        seenDelegate.add(name);
        beforeClass.push(`DECLARE_DYNAMIC_MULTICAST_DELEGATE(F${name}Delegate);`);
        header.push('\tUPROPERTY(BlueprintAssignable, Category="Graph")');
        header.push(`\tF${name}Delegate ${name};`);
      }
      if (node?.catalog === "dispatcher-bind") {
        const handler = dispatcherHandler(withClass, node);
        const boundEvent = withClass.nodes.find((item) => item.catalog === "custom-event" && functionBase(item) === handler);
        if (!boundEvent && !seenHandler.has(handler)) {
          seenHandler.add(handler);
          header.push("\tUFUNCTION()");
          header.push(`\tvoid ${handler}();`);
          source.push(`void ${cls}::${handler}()`, "{", "}", "");
        }
      }
    }
  }
  if (timelines.length && allowTick) {
    header.push("\tvirtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;");
    source.push(`void ${cls}::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)`, "{", "\tSuper::TickComponent(DeltaTime, TickType, ThisTickFunction);");
    for (const node of timelines) {
      const id = ident(node.id, "Timeline");
      source.push(`\tif (Timeline_${id}) { Timeline_${id}->TickComponent(DeltaTime, TickType, nullptr); }`);
    }
    source.push("}", "");
  }
  return { header, source, beforeClass };
}

function upsertBeforeClass(header, lines) {
  const begin = "// graph:begin dispatchers";
  const end = "// graph:end dispatchers";
  const start = header.indexOf(begin);
  const stop = header.indexOf(end);
  const without = start >= 0 && stop > start ? `${header.slice(0, start)}${header.slice(stop + end.length)}` : header;
  if (!lines || !lines.length) return without;
  const block = `${begin}\n${lines.join("\n")}\n${end}\n`;
  const at = without.search(/\bUCLASS\b/);
  if (at < 0) return `${without.trimEnd()}\n\n${block}`;
  return `${without.slice(0, at)}${block}${without.slice(at)}`;
}

function ensureHeaderInclude(header, include) {
  if (String(header).includes(`"${include}"`)) return header;
  const line = `#include "${include}"`;
  const generated = String(header).match(/#include\s+"[^"]+\.generated\.h"/);
  if (generated) return `${header.slice(0, generated.index)}${line}\n${header.slice(generated.index)}`;
  return `${line}\n${header}`;
}

function insertCppInclude(source, include) {
  if (String(source).includes(`"${include}"`)) return source;
  const line = `#include "${include}"`;
  const first = String(source).match(/^#include\s+.+$/m);
  if (!first) return `${line}\n${source}`;
  const at = first.index + first[0].length;
  return `${source.slice(0, at)}\n${line}${source.slice(at)}`;
}

function stateNodes(eventGraph, items) {
  const nodes = [...(eventGraph?.nodes || [])];
  for (const item of items || []) {
    if (Array.isArray(item?.nodes)) nodes.push(...item.nodes);
  }
  return nodes;
}

function stateMembers(nodes) {
  const lines = [];
  const seen = new Set();
  for (const node of nodes) {
    const member = node?.catalog === "flipflop"
      ? `Flip_${ident(node.id, "Flip")}`
      : node?.catalog === "do-once"
        ? `DoneOnce_${ident(node.id, "Once")}`
        : node?.catalog === "gate"
          ? `GateOpen_${ident(node.id, "Gate")}`
          : "";
    if (!member || seen.has(member)) continue;
    seen.add(member);
    lines.push("\tUPROPERTY()");
    lines.push(`\tbool ${member} = false;`);
  }
  return lines;
}

function spliceMarked(text, block, insideClass) {
  return upsertRegion(text, MARKER_BEGIN, MARKER_END, block, insideClass);
}

function upsertRegion(text, begin, end, block, insideClass) {
  const source = String(text || "");
  const wrapped = `${begin}\n${block}\n${end}`;
  const start = source.indexOf(begin);
  const stop = source.indexOf(end);
  if (start >= 0 && stop > start) return `${source.slice(0, start)}${wrapped}${source.slice(stop + end.length)}`;
  if (insideClass) {
    const close = source.lastIndexOf("};");
    if (close >= 0) return `${source.slice(0, close)}${wrapped}\n${source.slice(close)}`;
  }
  return `${source.replace(/\s*$/, "")}\n\n${wrapped}\n`;
}

function stripNamedRegions(text, kind) {
  const re = new RegExp(`// graph:begin ${kind} [^\\n]*\\n[\\s\\S]*?// graph:end ${kind} [^\\n]*\\n?`, "g");
  return String(text || "").replace(re, "");
}

function lineIndex(header, source) {
  const lines = {};
  const take = (file, text) => {
    String(text || "").split("\n").forEach((row, index) => {
      const match = row.match(/node:([A-Za-z0-9_-]+)/);
      if (match && !lines[match[1]]) lines[match[1]] = { file, line: index + 1 };
    });
  };
  take(".h", header);
  take(".cpp", source);
  return lines;
}

export function commitGraphEdit(system, graph) {
  const written = writeEventGraph(system, graph);
  const synced = syncCpp(written, readEventGraph(written));
  if (system?.manual_cpp) {
    return {
      blocked: true,
      system: { ...written, cpp_header: system.cpp_header, cpp_source: system.cpp_source, manual_cpp: true, graph_lines: synced.lines },
      preview: synced,
    };
  }
  return {
    blocked: false,
    system: {
      ...written,
      cpp_header: synced.cpp_header,
      cpp_source: synced.cpp_source,
      manual_cpp: false,
      generated_cpp: { header: synced.cpp_header, source: synced.cpp_source },
      graph_lines: synced.lines,
    },
  };
}

function execChildren(graph, node) {
  const out = [];
  for (const pin of node.pins.filter((item) => item.dir === "out" && item.type === "exec")) {
    const next = outgoing(graph, node, pin.id);
    if (next) out.push(next);
  }
  return out;
}

function reachableFrom(graph, roots) {
  const seen = new Set();
  const stack = [...roots];
  while (stack.length) {
    const node = stack.pop();
    if (!node || seen.has(node.id)) continue;
    seen.add(node.id);
    execChildren(graph, node).forEach((child) => stack.push(child));
  }
  return graph.nodes.filter((node) => seen.has(node.id));
}

function upstream(graph, node) {
  const seen = new Set();
  const stack = [node];
  const found = [];
  while (stack.length) {
    const current = stack.pop();
    if (!current || seen.has(current.id)) continue;
    seen.add(current.id);
    found.push(current);
    for (const wire of graph.wires) {
      if (wire.to.node !== current.id) continue;
      const pin = findPin(graph, wire.from.node, wire.from.pin);
      if (pin?.type !== "exec") continue;
      const prev = graph.nodes.find((item) => item.id === wire.from.node);
      if (prev) stack.push(prev);
    }
  }
  return found;
}

export function graphWarnings(graph, locks = [], context = {}) {
  const eventGraph = normalizeGraph(graph);
  const active = new Set(locks || []);
  const warnings = [];
  if (active.has("no_tick")) {
    const roots = eventGraph.nodes.filter((node) => node.catalog === "tick");
    for (const node of reachableFrom(eventGraph, roots)) {
      warnings.push({
        nodeId: node.id,
        lock: "no_tick",
        why: "No Tick is on, and this logic is wired to Tick. Tick runs every frame. Use a timer or an overlap instead.",
      });
    }
  }
  if (active.has("server_authority")) {
    for (const node of eventGraph.nodes.filter((item) => item.catalog === "set-variable")) {
      const chain = upstream(eventGraph, node);
      const allowed = chain.some((item) => item.catalog === "server-rpc" || item.catalog === "has-authority");
      if (allowed) continue;
      warnings.push({
        nodeId: node.id,
        lock: "server_authority",
        why: "Server authority is on, and this Set changes replicated state outside a Server RPC or a Has Authority check.",
      });
    }
  }
  const loops = new Set(["foreach", "forloop", "while"]);
  const fromTick = new Set(reachableFrom(eventGraph, eventGraph.nodes.filter((node) => node.catalog === "tick")).map((node) => node.id));
  for (const node of eventGraph.nodes) {
    if (fromTick.has(node.id) && loops.has(node.catalog)) {
      warnings.push({ nodeId: node.id, lock: "tick-loop", why: "This loop is reached from Tick. A loop on Tick runs every frame. Drive it from a timer or an event instead." });
    }
    if (!loops.has(node.catalog)) continue;
    const bodyPin = node.pins.find((item) => item.name === "Loop Body");
    const bodyRoot = outgoing(eventGraph, node, bodyPin?.id);
    const body = bodyRoot ? reachableFrom(eventGraph, [bodyRoot]) : [];
    if (body.some((item) => item.catalog === "cast-to")) {
      warnings.push({ nodeId: node.id, lock: "cast-loop", why: "A Cast inside a loop runs on every pass. Cast once before the loop, or filter the array first." });
    }
    if (node.catalog === "while") {
      const cond = node.pins.find((item) => item.name === "Condition");
      const wired = eventGraph.wires.some((wire) => wire.to.node === node.id && wire.to.pin === cond?.id);
      if (!wired) warnings.push({ nodeId: node.id, lock: "while-exit", why: "This While has no exit condition wired. It will spin. Wire a Boolean that becomes false." });
    }
  }
  const uses = {};
  for (const node of eventGraph.nodes.filter((item) => item.catalog === "call-user")) {
    const key = node.data?.graphId || node.data?.function;
    uses[key] = (uses[key] || 0) + 1;
  }
  for (const node of eventGraph.nodes.filter((item) => item.catalog === "call-user")) {
    const fn = (context.functions || []).find((item) => item.id === node.data?.graphId);
    const count = uses[node.data?.graphId || node.data?.function] || 0;
    const costly = (fn?.nodes || []).some((item) => ["cast-to", "spawn-actor", "delay", "print-string"].includes(item.catalog));
    if (fn?.pure && count >= 2 && costly) {
      warnings.push({ nodeId: node.id, lock: "pure-cost", why: "This Pure function does costly work and is used more than once. A Pure function runs again every time it is read. Cache the result, or make it impure." });
    }
  }
  return warnings;
}

function stepName(node) {
  if (node.catalog === "print-string") return `Print String says "${node.data?.text || "Hello"}"`;
  if (node.catalog === "set-variable") return `Set ${node.data?.variable || "the variable"}`;
  if (node.catalog === "get-variable") return `Get ${node.data?.variable || "the variable"}`;
  if (node.catalog === "call-function") return `call ${node.data?.function || "the function"}`;
  if (node.catalog === "delay") return `wait ${node.data?.seconds || 0.5} seconds`;
  return node.label;
}

function describeChain(graph, node, seen) {
  if (!node || seen.has(node.id)) return [];
  seen.add(node.id);
  if (node.catalog === "branch") {
    const thenNode = outgoing(graph, node, node.pins.find((item) => item.name === "Then")?.id);
    const elseNode = outgoing(graph, node, node.pins.find((item) => item.name === "Else")?.id);
    const thenText = describeChain(graph, thenNode, seen).join(", then ") || "nothing";
    const elseText = describeChain(graph, elseNode, new Set(seen)).join(", then ") || "nothing";
    return [`Branch: when the condition is true, ${thenText}; otherwise ${elseText}`];
  }
  const rest = [];
  const outs = node.pins.filter((item) => item.dir === "out" && item.type === "exec");
  if (node.kind !== "event") rest.push(stepName(node));
  for (const pin of outs) rest.push(...describeChain(graph, outgoing(graph, node, pin.id), seen));
  return rest;
}

export function explainGraph(graph) {
  const eventGraph = normalizeGraph(graph);
  const events = eventGraph.nodes.filter((node) => node.kind === "event").sort(byPos);
  if (!events.length) return "This event graph has no events yet. Nothing fires until an event is added.";
  return events.map((event) => {
    const steps = describeChain(eventGraph, event, new Set());
    if (!steps.length) return `${event.label} fires, and nothing is wired after it.`;
    return `${event.label} fires. Then ${steps.join(", then ")}.`;
  }).join(" ");
}

export function graphText(graph) {
  const eventGraph = normalizeGraph(graph);
  const lines = [`# ${eventGraph.name} (${eventGraph.kind})`];
  for (const node of [...eventGraph.nodes].sort(byPos)) {
    lines.push(`node ${node.id} ${node.catalog || node.kind} ${node.label} @ ${node.x},${node.y}`);
  }
  for (const wire of eventGraph.wires) lines.push(`wire ${wire.from.node}:${wire.from.pin} -> ${wire.to.node}:${wire.to.pin}`);
  for (const comment of eventGraph.comments) lines.push(`comment ${comment.text}`);
  return lines.join("\n");
}

export const VALUE_TYPES = [
  { id: "bool", label: "Boolean" },
  { id: "int", label: "Integer" },
  { id: "float", label: "Float" },
  { id: "vector", label: "Vector" },
  { id: "rotator", label: "Rotator" },
  { id: "string", label: "String" },
  { id: "name", label: "Name" },
  { id: "object", label: "Object" },
  { id: "actor", label: "Actor" },
  { id: "enum", label: "Enum" },
  { id: "struct", label: "Struct" },
];

function dataPins(list, dir, exec) {
  const pins = [];
  if (exec) pins.push({ id: pinSlug(dir, "Exec"), name: "Exec", dir, type: "exec" });
  for (const item of list || []) {
    const name = item.name || "Value";
    if (/^exec$/i.test(name)) continue;
    pins.push({ id: pinSlug(dir, name), name, dir, type: canonicalType(item.type, name) });
  }
  return pins;
}

function takenName(names, base) {
  const used = new Set(names.map((name) => String(name || "").toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  let index = 1;
  while (used.has(`${base}_${index}`.toLowerCase())) index += 1;
  return `${base}_${index}`;
}

function tunnelNodes(kind, spec) {
  const pure = !!spec.pure;
  if (kind === "function") {
    return [
      { id: "entry", catalog: "entry", kind: "event", label: "Entry", x: 80, y: 120, data: {}, pins: dataPins(spec.inputs, "out", !pure) },
      { id: "return", catalog: "return", kind: "function", label: "Return", x: 460, y: 120, data: {}, pins: dataPins(spec.outputs, "in", !pure) },
    ];
  }
  return [
    { id: "macro-in", catalog: "macro-in", kind: "event", label: "Inputs", x: 80, y: 120, data: {}, pins: dataPins(spec.inputs, "out", true) },
    { id: "macro-out", catalog: "macro-out", kind: "function", label: "Outputs", x: 460, y: 120, data: {}, pins: dataPins(spec.outputs, "in", true) },
  ];
}

function callPins(graph) {
  const pins = [];
  if (!graph.pure) {
    pins.push({ id: "in-exec", name: "Exec", dir: "in", type: "exec" });
    pins.push({ id: "out-exec", name: "Exec", dir: "out", type: "exec" });
  }
  for (const item of graph.inputs || []) pins.push({ id: pinSlug("in", item.name), name: item.name, dir: "in", type: item.type || "float" });
  for (const item of graph.outputs || []) pins.push({ id: pinSlug("out", item.name), name: item.name, dir: "out", type: item.type || "float" });
  return pins;
}

export function readDocument(system) {
  const stored = Array.isArray(system?.graphs?.items) ? system.graphs.items : [];
  const items = stored.map((item) => normalizeGraph(item));
  if (!items.some((item) => item.kind === "event" || item.id === "event")) items.unshift(readEventGraph(system));
  return applyVariableTypes({
    schema: 1,
    active: system?.graphs?.active || items[0]?.id || "event",
    variables: Array.isArray(system?.graphs?.variables) ? system.graphs.variables.map((item) => ({ ...item })) : [],
    items,
  });
}

export function writeDocument(system, doc) {
  const items = (doc?.items || []).map((item) => normalizeGraph(item));
  const eventGraph = items.find((item) => item.kind === "event" || item.id === "event") || readEventGraph(system);
  return {
    ...(system || {}),
    graphs: {
      schema: 1,
      active: doc?.active || eventGraph.id,
      variables: doc?.variables || [],
      items,
    },
    event_graph: eventGraph,
    node_graph_nodes: toLegacyNodes(eventGraph),
    node_graph_edges: toLegacyEdges(eventGraph),
  };
}

function replaceItem(doc, graph) {
  return { ...doc, items: doc.items.map((item) => (item.id === graph.id ? graph : item)) };
}

export function addFunction(doc, name = "NewFunction") {
  const id = uid("fn");
  const unique = takenName((doc.items || []).map((item) => item.name), name);
  const graph = emptyGraph({ kind: "function", id, name: unique });
  graph.pure = false;
  graph.callable = true;
  graph.inputs = [];
  graph.outputs = [];
  graph.nodes = tunnelNodes("function", graph);
  return { ...doc, items: [...doc.items, graph], active: id };
}

export function addMacro(doc, name = "NewMacro") {
  const id = uid("mac");
  const unique = takenName((doc.items || []).map((item) => item.name), name);
  const graph = emptyGraph({ kind: "macro", id, name: unique });
  graph.inputs = [];
  graph.outputs = [];
  graph.nodes = tunnelNodes("macro", graph);
  return { ...doc, items: [...doc.items, graph], active: id };
}

export function renameGraph(doc, id, name) {
  const next = String(name || "").trim();
  if (!next) return doc;
  const clash = (doc.items || []).some((item) => item.id !== id && String(item.name || "").toLowerCase() === next.toLowerCase())
    || (doc.variables || []).some((item) => String(item.name || "").toLowerCase() === next.toLowerCase());
  if (clash) return doc;
  return {
    ...doc,
    items: doc.items.map((item) => (item.id === id ? { ...item, name: next, label: next } : item)),
  };
}

export function deleteGraph(doc, id) {
  const target = doc.items.find((item) => item.id === id);
  if (!target || target.kind === "event") return doc;
  return { ...doc, active: "event", items: doc.items.filter((item) => item.id !== id) };
}

export function setFunctionSignature(doc, id, patch) {
  const items = doc.items.map((item) => {
    if (item.id !== id) return item;
    const next = { ...item, ...patch, inputs: patch.inputs || item.inputs || [], outputs: patch.outputs || item.outputs || [] };
    const tunnels = tunnelNodes(item.kind === "macro" ? "macro" : "function", next);
    const rest = (item.nodes || []).filter((node) => !["entry", "return", "macro-in", "macro-out"].includes(node.catalog));
    next.nodes = [...tunnels, ...rest];
    next.wires = (item.wires || []).filter((wire) => next.nodes.some((node) => node.id === wire.from.node) && next.nodes.some((node) => node.id === wire.to.node));
    return next;
  });
  const fn = items.find((item) => item.id === id);
  const refreshed = items.map((item) => ({
    ...item,
    nodes: (item.nodes || []).map((node) => {
      if ((node.catalog !== "call-user" && node.catalog !== "call-macro") || node.data?.graphId !== id || !fn) return node;
      return { ...node, label: fn.name, kind: fn.pure ? "pure" : "function", pins: callPins(fn), data: { ...node.data, function: fn.name } };
    }),
  }));
  return { ...doc, items: refreshed };
}

export function addVariable(doc, patch = {}) {
  const variable = {
    id: patch.id || uid("var"),
    name: takenName((doc.variables || []).map((item) => item.name), patch.name || "NewVar"),
    type: patch.type || "float",
    array: !!patch.array,
    enumName: patch.enumName || "",
    structName: patch.structName || "",
    members: Array.isArray(patch.members) ? patch.members : [],
    default: patch.default ?? "",
    replicated: !!patch.replicated,
    repNotify: !!patch.repNotify,
  };
  return { ...doc, variables: [...(doc.variables || []), variable] };
}

function variablePinType(variable) {
  if (variable?.type === "struct") return "object";
  return canonicalType(variable?.type === "actor" ? "object" : (variable?.type || "float"), "");
}

function applyVariableTypes(doc) {
  const variables = doc.variables || [];
  const byId = new Map(variables.map((item) => [item.id, item]));
  const byName = new Map(variables.map((item) => [item.name, item]));
  return {
    ...doc,
    items: (doc.items || []).map((graph) => {
      const nodes = (graph.nodes || []).map((node) => {
        if (node.catalog !== "get-variable" && node.catalog !== "set-variable") return node;
        const variable = byId.get(node.data?.variableId) || byName.get(node.data?.variable);
        if (!variable) return node;
        const type = variablePinType(variable);
        return {
          ...node,
          label: node.catalog === "set-variable" ? `Set ${variable.name}` : `Get ${variable.name}`,
          data: { ...node.data, variable: variable.name, varType: type, variableId: variable.id },
          pins: (node.pins || []).map((pin) => (pin.name === "Value" ? { ...pin, type } : pin)),
        };
      });
      const next = { ...graph, nodes };
      return {
        ...next,
        wires: (graph.wires || []).filter((wire) => canConnect(next, wire.from.node, wire.from.pin, wire.to.node, wire.to.pin).ok),
      };
    }),
  };
}

export function updateVariable(doc, id, patch) {
  const nextName = patch.name != null ? String(patch.name).trim() : null;
  if (nextName) {
    const clash = (doc.variables || []).some((item) => item.id !== id && String(item.name || "").toLowerCase() === nextName.toLowerCase());
    if (clash) return doc;
  }
  const previous = (doc.variables || []).find((item) => item.id === id);
  const variables = (doc.variables || []).map((item) => (item.id === id ? { ...item, ...patch, ...(nextName ? { name: nextName } : {}) } : item));
  const renamed = variables.find((item) => item.id === id);
  const items = (doc.items || []).map((graph) => ({
    ...graph,
    nodes: (graph.nodes || []).map((node) => {
      const owns = node.data?.variableId === id || (previous && node.data?.variable === previous.name);
      if (!owns || (node.catalog !== "get-variable" && node.catalog !== "set-variable")) return node;
      return { ...node, data: { ...node.data, variable: renamed.name, variableId: id } };
    }),
  }));
  return applyVariableTypes({ ...doc, variables, items });
}

export function deleteVariable(doc, id) {
  return { ...doc, variables: (doc.variables || []).filter((item) => item.id !== id) };
}

export function variableNode(variable, kind, x, y) {
  const type = variablePinType(variable);
  return createNode(kind === "set" ? "set-variable" : "get-variable", x, y, {
    data: { variable: variable.name, varType: type, variableId: variable.id },
  });
}

export function placeCall(doc, graphId, x, y) {
  const fn = doc.items.find((item) => item.id === graphId);
  if (!fn) return null;
  return {
    id: uid("n"),
    catalog: fn.kind === "macro" ? "call-macro" : "call-user",
    kind: fn.pure ? "pure" : "function",
    label: fn.name,
    x, y,
    data: { graphId: fn.id, function: fn.name },
    pins: callPins(fn),
  };
}

export function collapseSelection(doc, graphId, nodeIds, { kind = "function", name = "Collapsed" } = {}) {
  const source = doc.items.find((item) => item.id === graphId);
  if (!source) return doc;
  const chosen = new Set(nodeIds || []);
  const moving = (source.nodes || []).filter((node) => chosen.has(node.id) && !["entry", "return", "macro-in", "macro-out"].includes(node.catalog));
  if (!moving.length) return doc;
  const inside = new Set(moving.map((node) => node.id));
  const inputs = [];
  const outputs = [];
  for (const wire of source.wires || []) {
    const fromIn = inside.has(wire.from.node);
    const toIn = inside.has(wire.to.node);
    if (fromIn === toIn) continue;
    const pin = fromIn
      ? source.nodes.find((node) => node.id === wire.from.node)?.pins?.find((item) => item.id === wire.from.pin)
      : source.nodes.find((node) => node.id === wire.to.node)?.pins?.find((item) => item.id === wire.to.pin);
    const bucket = fromIn ? outputs : inputs;
    const label = pin?.name && pin.name !== "Exec" ? pin.name : (fromIn ? "Out" : "In");
    if (!bucket.some((item) => item.name === label)) bucket.push({ name: label, type: pin?.type === "exec" ? "exec" : (pin?.type || "float") });
  }
  const dataInputs = inputs.filter((item) => item.type !== "exec");
  const dataOutputs = outputs.filter((item) => item.type !== "exec");
  let next = kind === "macro" ? addMacro(doc, name) : addFunction(doc, name);
  const created = next.items[next.items.length - 1];
  next = setFunctionSignature(next, created.id, { inputs: dataInputs, outputs: dataOutputs, pure: false, callable: true });
  const fn = next.items.find((item) => item.id === created.id);
  const shiftX = Math.min(...moving.map((node) => node.x)) - 200;
  fn.nodes = [...fn.nodes, ...moving.map((node) => ({ ...node, x: node.x - shiftX }))];
  fn.wires = (source.wires || []).filter((wire) => inside.has(wire.from.node) && inside.has(wire.to.node));
  const call = placeCall(next, fn.id, Math.min(...moving.map((node) => node.x)), Math.min(...moving.map((node) => node.y)));
  const keptWires = [];
  for (const wire of source.wires || []) {
    const fromIn = inside.has(wire.from.node);
    const toIn = inside.has(wire.to.node);
    if (fromIn && toIn) continue;
    if (!fromIn && !toIn) { keptWires.push(wire); continue; }
    if (toIn && !fromIn) keptWires.push({ ...wire, id: uid("w"), to: { node: call.id, pin: call.pins.find((item) => item.dir === "in" && item.type === "exec")?.id || call.pins[0].id } });
    if (fromIn && !toIn) keptWires.push({ ...wire, id: uid("w"), from: { node: call.id, pin: call.pins.find((item) => item.dir === "out" && item.type === "exec")?.id || call.pins[0].id } });
  }
  const updatedSource = {
    ...source,
    nodes: [...source.nodes.filter((node) => !inside.has(node.id)), call],
    wires: keptWires,
  };
  return { ...next, items: next.items.map((item) => (item.id === source.id ? updatedSource : item.id === fn.id ? fn : item)) };
}

export function commitDocument(system, doc) {
  const written = writeDocument(system, doc);
  const eventGraph = readEventGraph(written);
  const synced = syncCpp(written, eventGraph);
  if (system?.manual_cpp) {
    return {
      blocked: true,
      system: { ...written, cpp_header: system.cpp_header, cpp_source: system.cpp_source, manual_cpp: true, graph_lines: synced.lines },
      preview: synced,
    };
  }
  return {
    blocked: false,
    system: {
      ...written,
      cpp_header: synced.cpp_header,
      cpp_source: synced.cpp_source,
      manual_cpp: false,
      generated_cpp: { header: synced.cpp_header, source: synced.cpp_source },
      graph_lines: synced.lines,
    },
  };
}

export function refactorCheck(system) {
  const functions = readDocument(system).items.filter((item) => item.kind === "function");
  const pass = functions.length >= 2;
  return {
    pass,
    detail: pass
      ? "The event graph now calls two functions."
      : "Split the work into two functions. The graph list should show both of them.",
  };
}
