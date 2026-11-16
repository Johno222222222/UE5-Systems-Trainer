// Steps an open graph inside the app. Nothing here talks to Unreal.
// One step arrives at one node. Loops, sequences, and calls use a stack so each path stays in order.

export const LOOP_CAP = 8;
export const CALL_CAP = 4;
const TIMER_CAP = 3;

const ROLES = {
  "server-rpc": "runs on server",
  "client-rpc": "runs on client",
  "multicast-rpc": "runs on server and clients",
};

const PASS = new Set([
  "begin-play", "end-play", "tick", "enhanced-input", "begin-overlap", "end-overlap", "hit",
  "any-damage", "point-damage", "on-rep", "custom-event", "dispatcher-bind", "dispatcher-call",
  "set-timer-event", "set-timer-function", "break-struct", "make-struct", "cast-to",
  "entry", "macro-in", "server-rpc", "client-rpc", "multicast-rpc",
]);

function defaultFor(type) {
  if (type === "bool") return false;
  if (type === "int") return 0;
  if (type === "float" || type === "wildcard") return 0;
  if (type === "string") return "";
  if (type === "name") return "None";
  if (type === "vector") return { x: 0, y: 0, z: 0 };
  return null;
}

function coerce(type, raw) {
  if (type === "bool") return raw === true || raw === 1 || /^(true|1)$/i.test(String(raw || ""));
  if (type === "int") {
    const n = Number.parseInt(String(raw ?? "").replace(/[^0-9-]/g, ""), 10);
    return Number.isFinite(n) ? n : 0;
  }
  if (type === "float" || type === "wildcard") {
    const n = Number.parseFloat(String(raw ?? "").replace(/f$/i, ""));
    return Number.isFinite(n) ? n : 0;
  }
  if (type === "string") return raw == null ? "" : String(raw);
  if (type === "name") return raw == null || raw === "" ? "None" : String(raw);
  return raw == null ? defaultFor(type) : raw;
}

export function formatValue(value) {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "0";
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
  }
  if (value == null) return "None";
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  return String(value);
}

function initialValue(variable) {
  if (variable?.array) {
    const parts = String(variable.default || "").split(",").map((item) => item.trim()).filter(Boolean);
    return (parts.length ? parts : ["A", "B", "C"]).map((item) => coerce(variable.type || "string", item));
  }
  if (variable?.default == null || variable.default === "") return defaultFor(variable?.type || "float");
  return coerce(variable.type || "float", variable.default);
}

function num(value) {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? "").replace(/f$/i, ""));
  return Number.isFinite(n) ? n : 0;
}

function truthy(value) {
  if (value === false || value == null) return false;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value !== "" && !/^(false|none|null)$/i.test(value);
  return true;
}

function pickRoot(graph, nodeId) {
  const nodes = graph?.nodes || [];
  if (nodeId) return nodes.find((node) => node.id === nodeId) || null;
  const roots = nodes.filter((node) => node.kind === "event" || node.catalog === "entry" || node.catalog === "macro-in");
  roots.sort((a, b) => a.y - b.y || a.x - b.x);
  return roots[0] || null;
}

function cloneMemory(memory) {
  const next = {};
  for (const [key, value] of Object.entries(memory || {})) next[key] = { ...value };
  return next;
}

export function startSimulation(doc, graph, { nodeId, authority = true } = {}) {
  const variables = {};
  for (const variable of doc?.variables || []) variables[variable.name] = initialValue(variable);
  const root = pickRoot(graph, nodeId);
  const stack = root ? [{ nodeId: root.id, wireId: null, pinId: null, depth: 0 }] : [];
  return {
    status: stack.length ? "paused" : "done",
    activeId: null,
    wireId: null,
    variables,
    note: stack.length ? `Ready at ${root.label}.` : "This graph has no event or Entry to start from.",
    branch: null,
    role: "",
    log: [],
    warnings: [],
    memory: {},
    locals: {},
    stack,
    depth: 0,
    authority: authority !== false,
    steps: 0,
  };
}

function memOf(state, id) {
  if (!state.memory[id]) state.memory[id] = {};
  return state.memory[id];
}

function incoming(graph, node, pinName) {
  const pin = (node.pins || []).find((item) => item.dir === "in" && item.name === pinName);
  if (!pin) return null;
  const wire = (graph.wires || []).find((item) => item.to.node === node.id && item.to.pin === pin.id);
  if (!wire) return { pin, source: null, sourcePin: null };
  const source = (graph.nodes || []).find((item) => item.id === wire.from.node);
  const sourcePin = source?.pins?.find((item) => item.id === wire.from.pin) || null;
  return { pin, source, sourcePin };
}

function valueInto(state, graph, node, pinName) {
  const hit = incoming(graph, node, pinName);
  if (!hit?.pin) return 0;
  if (!hit.source || !hit.sourcePin) return defaultFor(hit.pin.type);
  // Each impure node walks pure inputs again. A value that must survive the next
  // Set has to be stored in a variable first, the same way Unreal re-runs pure nodes.
  return evalOut(state, graph, hit.source, hit.sourcePin, new Set());
}

function evalOut(state, graph, node, pin, seen) {
  const key = `${node.id}:${pin.id}`;
  if (seen.has(key)) return defaultFor(pin.type);
  seen.add(key);
  try {
    return evalOutValue(state, graph, node, pin, seen);
  } finally {
    seen.delete(key);
  }
}

function evalOutValue(state, graph, node, pin, seen) {
  const local = state.locals[node.id] || {};
  if (Object.prototype.hasOwnProperty.call(local, pin.name)) return local[pin.name];
  const catalog = node.catalog;
  if (catalog === "get-variable") return state.variables[node.data?.variable] ?? defaultFor(node.data?.varType || pin.type);
  if (catalog === "literal") return coerce(node.data?.varType || pin.type, node.data?.value);
  if (catalog === "add") return num(read(state, graph, node, "A", seen)) + num(read(state, graph, node, "B", seen));
  if (catalog === "subtract") return num(read(state, graph, node, "A", seen)) - num(read(state, graph, node, "B", seen));
  if (catalog === "multiply") return num(read(state, graph, node, "A", seen)) * num(read(state, graph, node, "B", seen));
  if (catalog === "divide") {
    const b = num(read(state, graph, node, "B", seen));
    if (!b) return 0;
    return num(read(state, graph, node, "A", seen)) / b;
  }
  if (catalog === "clamp") {
    const value = num(read(state, graph, node, "Value", seen));
    const min = num(read(state, graph, node, "Min", seen));
    const max = num(read(state, graph, node, "Max", seen));
    return Math.min(max, Math.max(min, value));
  }
  if (catalog === "lerp") {
    const a = num(read(state, graph, node, "A", seen));
    const b = num(read(state, graph, node, "B", seen));
    const alpha = num(read(state, graph, node, "Alpha", seen));
    return a + (b - a) * alpha;
  }
  if (catalog === "equal") return same(read(state, graph, node, "A", seen), read(state, graph, node, "B", seen));
  if (catalog === "greater") return num(read(state, graph, node, "A", seen)) > num(read(state, graph, node, "B", seen));
  if (catalog === "less") return num(read(state, graph, node, "A", seen)) < num(read(state, graph, node, "B", seen));
  if (catalog === "and") return truthy(read(state, graph, node, "A", seen)) && truthy(read(state, graph, node, "B", seen));
  if (catalog === "or") return truthy(read(state, graph, node, "A", seen)) || truthy(read(state, graph, node, "B", seen));
  if (catalog === "not") return !truthy(read(state, graph, node, "A", seen));
  if (catalog === "select") return truthy(read(state, graph, node, "Pick", seen)) ? read(state, graph, node, "A", seen) : read(state, graph, node, "B", seen);
  if (catalog === "line-trace") {
    if (pin.name === "Hit") return node.data?.hit !== false;
    if (pin.name === "Hit Actor") return node.data?.actor || "HitActor";
  }
  if (catalog === "has-authority" && pin.name === "Authority") return state.authority !== false;
  if (catalog === "tick" && pin.name === "Delta Seconds") return 0.016;
  if ((catalog === "any-damage" || catalog === "point-damage") && pin.name === "Damage") return num(node.data?.sample ?? 25);
  if ((catalog === "begin-overlap" || catalog === "end-overlap" || catalog === "hit") && pin.name === "Other Actor") return "OtherActor";
  if (catalog === "timeline" && pin.name === "Alpha") return 1;
  if (catalog === "break-struct" && pin.name === "Value") return num(node.data?.sample ?? 1);
  if (catalog === "make-struct" && pin.name === "Struct") return node.data?.struct || "Struct";
  if (catalog === "cast-to" && pin.name === "As") return node.data?.className || "AActor";
  if (catalog === "foreach" && pin.name === "Element") return local.Element ?? "A";
  if (catalog === "forloop" && pin.name === "Index") return local.Index ?? 0;
  return defaultFor(pin.type);
}

function read(state, graph, node, pinName, seen) {
  const hit = incoming(graph, node, pinName);
  if (!hit?.source || !hit.sourcePin) return defaultFor(hit?.pin?.type || "float");
  return evalOut(state, graph, hit.source, hit.sourcePin, seen);
}

function same(a, b) {
  if (typeof a === "number" || typeof b === "number") return num(a) === num(b);
  return String(a) === String(b);
}

function pushPin(state, graph, node, pin) {
  if (!pin) return false;
  const wire = (graph.wires || []).find((item) => item.from.node === node.id && item.from.pin === pin.id);
  if (!wire) return false;
  state.stack.push({ nodeId: wire.to.node, wireId: wire.id, pinId: wire.to.pin, depth: state.depth || 0 });
  return true;
}

function pushNamed(state, graph, node, pinName) {
  const pin = (node.pins || []).find((item) => item.dir === "out" && item.name === pinName);
  return pushPin(state, graph, node, pin);
}

function pushFirstExec(state, graph, node) {
  const pin = (node.pins || []).find((item) => item.dir === "out" && item.type === "exec");
  return pushPin(state, graph, node, pin);
}

function execOuts(node) {
  return (node.pins || []).filter((item) => item.dir === "out" && item.type === "exec");
}

function skip(state, graph, node, note) {
  state.note = note;
  state.warnings = state.warnings.includes(note) ? state.warnings : [...state.warnings, note];
  pushFirstExec(state, graph, node);
}

function findFunction(doc, node) {
  const items = doc?.items || [];
  if (node.data?.graphId) {
    const hit = items.find((item) => item.id === node.data.graphId);
    if (hit) return hit;
  }
  const name = node.data?.function || node.label;
  return items.find((item) => item.name === name && (item.kind === "function" || item.kind === "macro")) || null;
}

function execute(state, graph, doc, node, job) {
  state.activeId = node.id;
  state.wireId = job.wireId || null;
  state.steps += 1;
  state.role = ROLES[node.catalog] || "";
  const mem = memOf(state, node.id);
  const catalog = node.catalog;

  if (job.kind === "resume" && (catalog === "forloop" || catalog === "while" || catalog === "foreach")) {
    if (catalog === "forloop") enterFor(state, graph, node, mem);
    else if (catalog === "foreach") enterEach(state, graph, node, mem);
    else enterWhile(state, graph, node, mem);
    return finish(state);
  }

  if (catalog === "branch") {
    const value = valueInto(state, graph, node, "Condition");
    const cond = truthy(value);
    const taken = cond ? "Then" : "Else";
    state.branch = { nodeId: node.id, taken, why: cond ? "condition is true" : "condition is false", value: cond };
    state.note = `Branch took ${taken} because the condition is ${formatValue(cond)}.`;
    pushNamed(state, graph, node, taken);
    return finish(state);
  }

  if (catalog === "sequence") {
    const outs = execOuts(node);
    state.note = `Sequence runs ${outs.map((item) => item.name).join(", then ") || "no outputs"}.`;
    for (let i = outs.length - 1; i >= 0; i -= 1) pushPin(state, graph, node, outs[i]);
    return finish(state);
  }

  if (catalog === "forloop") {
    mem.index = null;
    enterFor(state, graph, node, mem);
    return finish(state);
  }
  if (catalog === "foreach") {
    mem.cursor = null;
    enterEach(state, graph, node, mem);
    return finish(state);
  }
  if (catalog === "while") {
    mem.iterations = 0;
    enterWhile(state, graph, node, mem);
    return finish(state);
  }

  if (catalog === "do-once") {
    const arrived = (graph.wires || []).find((item) => item.id === job.wireId);
    const pin = node.pins.find((item) => item.id === arrived?.to?.pin);
    if (pin?.name === "Reset") {
      mem.done = false;
      state.note = "DoOnce reset.";
      return finish(state);
    }
    if (mem.done) {
      state.note = "DoOnce already ran.";
      return finish(state);
    }
    mem.done = true;
    state.note = "DoOnce runs.";
    pushNamed(state, graph, node, "Completed");
    return finish(state);
  }

  if (catalog === "gate") {
    const arrived = (graph.wires || []).find((item) => item.id === job.wireId);
    const pin = node.pins.find((item) => item.id === arrived?.to?.pin);
    if (pin?.name === "Open") {
      mem.open = true;
      state.note = "Gate opened.";
      return finish(state);
    }
    if (pin?.name === "Close") {
      mem.open = false;
      state.note = "Gate closed.";
      return finish(state);
    }
    if (mem.open) {
      state.note = "Gate is open.";
      pushNamed(state, graph, node, "Exit");
    } else state.note = "Gate is closed.";
    return finish(state);
  }

  if (catalog === "flipflop") {
    const takeA = mem.isA !== false;
    mem.isA = !takeA;
    state.locals = { ...state.locals, [node.id]: { "Is A": takeA } };
    state.note = `FlipFlop took ${takeA ? "A" : "B"}.`;
    pushNamed(state, graph, node, takeA ? "A" : "B");
    return finish(state);
  }

  if (catalog === "set-variable") {
    const type = node.data?.varType || "float";
    const value = coerce(type, valueInto(state, graph, node, "Value"));
    const name = node.data?.variable || "Value";
    state.variables = { ...state.variables, [name]: value };
    state.note = `${name} = ${formatValue(value)}.`;
    pushFirstExec(state, graph, node);
    return finish(state);
  }

  if (catalog === "print-string") {
    const text = formatValue(valueInto(state, graph, node, "In String") || node.data?.text || "");
    state.log = [...state.log, text];
    state.note = `Print: ${text}`;
    pushFirstExec(state, graph, node);
    return finish(state);
  }

  if (catalog === "line-trace") {
    const hit = node.data?.hit !== false;
    state.locals = { ...state.locals, [node.id]: { Hit: hit, "Hit Actor": node.data?.actor || "HitActor" } };
    state.note = hit ? `Line trace hit ${node.data?.actor || "HitActor"}.` : "Line trace missed.";
    pushFirstExec(state, graph, node);
    return finish(state);
  }

  if (catalog === "interface-call") {
    const target = formatValue(valueInto(state, graph, node, "Target"));
    state.note = `Interface ${node.data?.function || "Interact"} on ${target}.`;
    pushFirstExec(state, graph, node);
    return finish(state);
  }

  if (catalog === "has-authority") {
    const ok = state.authority !== false;
    state.role = ok ? "runs on server" : "runs on client";
    state.locals = { ...state.locals, [node.id]: { Authority: ok } };
    state.note = ok ? "Has Authority is true. This runs on the server." : "Has Authority is false. This runs on a client.";
    pushFirstExec(state, graph, node);
    return finish(state);
  }

  if (catalog === "set-timer" || catalog === "set-timer-event" || catalog === "set-timer-function") {
    const seconds = num(valueInto(state, graph, node, "Time") || node.data?.seconds || 0);
    mem.fires = (mem.fires || 0) + 1;
    const eventName = catalog === "set-timer-function" ? node.data?.function : node.data?.event;
    const target = eventName && (graph.nodes || []).find((item) => item.catalog === "custom-event" && item.data?.name === eventName);
    state.note = `Timer set for ${formatValue(seconds)}s. Simulated with no wait.`;
    if (target && mem.fires <= TIMER_CAP) {
      state.stack.push({ nodeId: target.id, wireId: null, pinId: null, depth: state.depth || 0 });
      state.note += ` ${eventName} will fire (${mem.fires}/${TIMER_CAP}).`;
    } else if (target) state.note += " Timer loop stopped at the cap.";
    pushFirstExec(state, graph, node);
    return finish(state);
  }

  if (catalog === "cast-to") {
    state.locals = { ...state.locals, [node.id]: { As: node.data?.className || "AActor" } };
    state.note = `Cast To ${node.data?.className || "AActor"}.`;
    pushFirstExec(state, graph, node);
    return finish(state);
  }

  if (catalog === "break-struct") {
    state.locals = { ...state.locals, [node.id]: { Value: num(node.data?.sample ?? 1) } };
    state.note = `Break ${node.data?.struct || "struct"} . ${node.data?.member || "Value"}.`;
    pushFirstExec(state, graph, node);
    return finish(state);
  }

  if (catalog === "make-struct") {
    state.locals = { ...state.locals, [node.id]: { Struct: node.data?.struct || "Struct" } };
    state.note = `Make ${node.data?.struct || "struct"}.`;
    pushFirstExec(state, graph, node);
    return finish(state);
  }

  if (catalog === "timeline") {
    state.locals = { ...state.locals, [node.id]: { Alpha: 1 } };
    state.note = "Timeline plays to the end. Update ticks are skipped.";
    pushNamed(state, graph, node, "Finished") || pushFirstExec(state, graph, node);
    return finish(state);
  }

  if (catalog === "dispatcher-call") {
    const name = node.data?.name || "OnChanged";
    state.note = `Broadcast ${name}.`;
    for (const bind of (graph.nodes || []).filter((item) => item.catalog === "dispatcher-bind" && (item.data?.name || "OnChanged") === name)) {
      const eventName = bind.data?.event;
      const target = eventName && (graph.nodes || []).find((item) => item.catalog === "custom-event" && item.data?.name === eventName);
      if (target) state.stack.push({ nodeId: target.id, wireId: null, pinId: null, depth: state.depth || 0 });
    }
    pushFirstExec(state, graph, node);
    return finish(state);
  }

  if (catalog === "delay") {
    state.note = "Delay is skipped in the simulation.";
    pushNamed(state, graph, node, "Completed") || pushFirstExec(state, graph, node);
    return finish(state);
  }

  if (catalog === "call-user" || catalog === "call-function" || catalog === "call-macro") {
    const fn = findFunction(doc, node);
    if (!fn || (state.depth || 0) >= CALL_CAP) {
      skip(state, graph, node, fn ? "Call depth cap. Skipped." : `${node.label} has no graph here. Skipped.`);
      return finish(state);
    }
    pushFirstExec(state, graph, node);
    const entry = (fn.nodes || []).find((item) => item.catalog === "entry" || item.catalog === "macro-in");
    state.depth = (state.depth || 0) + 1;
    if (entry) state.stack.push({ nodeId: entry.id, wireId: null, pinId: null, depth: state.depth, graphId: fn.id });
    state.note = `Call ${fn.name}.`;
    state.callGraph = fn;
    return finish(state);
  }

  if (catalog === "return" || catalog === "macro-out") {
    state.depth = Math.max(0, (state.depth || 1) - 1);
    state.note = "Return.";
    state.callGraph = null;
    return finish(state);
  }

  if (PASS.has(catalog)) {
    if (ROLES[catalog]) state.note = ROLES[catalog];
    else state.note = node.label;
    pushFirstExec(state, graph, node);
    return finish(state);
  }

  skip(state, graph, node, `${node.label} is not simulated. Skipped.`);
  return finish(state);
}

function enterFor(state, graph, node, mem) {
  if (mem.index == null) {
    mem.index = num(valueInto(state, graph, node, "First"));
    mem.last = num(valueInto(state, graph, node, "Last"));
    mem.iterations = 0;
  }
  if (mem.iterations >= LOOP_CAP || mem.index > mem.last) {
    state.note = mem.iterations >= LOOP_CAP ? `ForLoop stopped after ${LOOP_CAP} iterations.` : "ForLoop completed.";
    state.branch = { nodeId: node.id, taken: "Completed", why: state.note, value: mem.index };
    mem.index = null;
    pushNamed(state, graph, node, "Completed");
    return;
  }
  const current = mem.index;
  mem.index = current + 1;
  mem.iterations += 1;
  state.locals = { ...state.locals, [node.id]: { Index: current } };
  state.note = `ForLoop index ${formatValue(current)}.`;
  state.stack.push({ kind: "resume", nodeId: node.id, depth: state.depth || 0 });
  pushNamed(state, graph, node, "Loop Body");
}

function enterEach(state, graph, node, mem) {
  if (!mem.items) {
    const wired = incoming(graph, node, "Array");
    const items = wired?.source ? evalOut(state, graph, wired.source, wired.sourcePin, new Set()) : null;
    mem.items = Array.isArray(items) && items.length ? items.slice(0, LOOP_CAP) : ["A", "B", "C"];
    mem.cursor = 0;
  }
  if (mem.cursor >= mem.items.length || mem.cursor >= LOOP_CAP) {
    state.note = mem.cursor >= LOOP_CAP ? `ForEach stopped after ${LOOP_CAP} iterations.` : "ForEach completed.";
    mem.items = null;
    mem.cursor = null;
    pushNamed(state, graph, node, "Completed");
    return;
  }
  const element = mem.items[mem.cursor];
  mem.cursor += 1;
  state.locals = { ...state.locals, [node.id]: { Element: element } };
  state.note = `ForEach element ${formatValue(element)}.`;
  state.stack.push({ kind: "resume", nodeId: node.id, depth: state.depth || 0 });
  pushNamed(state, graph, node, "Loop Body");
}

function enterWhile(state, graph, node, mem) {
  mem.iterations = mem.iterations || 0;
  const value = valueInto(state, graph, node, "Condition");
  const cond = truthy(value);
  if (!cond || mem.iterations >= LOOP_CAP) {
    state.note = !cond ? "While stopped because the condition is false." : `While stopped after ${LOOP_CAP} iterations.`;
    state.branch = { nodeId: node.id, taken: "Completed", why: state.note, value: cond };
    mem.iterations = 0;
    pushNamed(state, graph, node, "Completed");
    return;
  }
  mem.iterations += 1;
  state.note = `While iteration ${mem.iterations}. The condition is true.`;
  state.branch = { nodeId: node.id, taken: "Loop Body", why: "condition is true", value: true };
  state.stack.push({ kind: "resume", nodeId: node.id, depth: state.depth || 0 });
  pushNamed(state, graph, node, "Loop Body");
}

function finish(state) {
  const status = state.stack.length ? (state.status === "running" ? "running" : "paused") : "done";
  if (!state.stack.length && state.steps > 0) state.note = state.note || "Finished.";
  return { ...state, status, memory: cloneMemory(state.memory) };
}

export function stepSimulation(state, graph, doc) {
  if (!state || state.status === "done") return state;
  if (!state.stack.length) return { ...state, status: "done", activeId: null, wireId: null };
  const job = state.stack[state.stack.length - 1];
  const activeGraph = job.graphId ? (doc?.items || []).find((item) => item.id === job.graphId) || graph : (state.callGraph || graph);
  const node = (activeGraph.nodes || []).find((item) => item.id === job.nodeId);
  const next = {
    ...state,
    stack: state.stack.slice(0, -1),
    variables: { ...state.variables },
    memory: cloneMemory(state.memory),
    locals: { ...state.locals },
    log: [...(state.log || [])],
    warnings: [...(state.warnings || [])],
    depth: job.depth ?? state.depth ?? 0,
    branch: state.branch,
    role: "",
  };
  if (!node) {
    next.note = "The next node is missing. Skipped.";
    return finish(next);
  }
  if (job.graphId) next.callGraph = activeGraph;
  return execute(next, job.graphId ? activeGraph : (state.callGraph && nodeBelongs(state.callGraph, node) ? state.callGraph : graph), doc, node, job);
}

function nodeBelongs(graph, node) {
  return (graph?.nodes || []).some((item) => item.id === node.id);
}

export function runSimulation(doc, graph, options = {}) {
  let state = startSimulation(doc, graph, options);
  const trace = [];
  const limit = options.limit || 48;
  while (state.status !== "done" && trace.length < limit) {
    state = stepSimulation(state, graph, doc);
    trace.push({
      id: state.activeId,
      note: state.note,
      branch: state.branch,
      role: state.role,
      variables: { ...state.variables },
      log: [...state.log],
    });
  }
  return { state, trace };
}
