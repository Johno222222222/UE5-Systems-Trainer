// One graph document. kind is "event" in this version.
// A later stage adds graphs with kind "function" or "macro" using the same nodes, wires, and comments.

export const PIN_COLORS = {
  exec: "#ffffff",
  bool: "#e02424",
  int: "#1fd4c8",
  float: "#9ae600",
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
];

const pin = (name, dir, type) => ({ name, dir, type });

export const CATALOG = [
  { id: "begin-play", group: "Lifecycle", label: "Begin Play", visual: "event", pins: [pin("Exec", "out", "exec")] },
  { id: "end-play", group: "Lifecycle", label: "End Play", visual: "event", pins: [pin("Exec", "out", "exec")] },
  { id: "tick", group: "Lifecycle", label: "Tick", visual: "event", pins: [pin("Exec", "out", "exec"), pin("Delta Seconds", "out", "float")] },
  { id: "enhanced-input", group: "Input", label: "Enhanced Input Action", visual: "event", pins: [pin("Triggered", "out", "exec"), pin("Value", "out", "float")], data: { action: "IA_Action" } },
  { id: "begin-overlap", group: "Collision", label: "On Component Begin Overlap", visual: "event", pins: [pin("Exec", "out", "exec"), pin("Other Actor", "out", "object")] },
  { id: "end-overlap", group: "Collision", label: "On Component End Overlap", visual: "event", pins: [pin("Exec", "out", "exec"), pin("Other Actor", "out", "object")] },
  { id: "hit", group: "Collision", label: "On Hit", visual: "event", pins: [pin("Exec", "out", "exec"), pin("Other Actor", "out", "object")] },
  { id: "any-damage", group: "Damage", label: "Any Damage", visual: "event", pins: [pin("Exec", "out", "exec"), pin("Damage", "out", "float")] },
  { id: "point-damage", group: "Damage", label: "Point Damage", visual: "event", pins: [pin("Exec", "out", "exec"), pin("Damage", "out", "float")] },
  { id: "set-timer", group: "Timers", label: "Set Timer", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Time", "in", "float"), pin("Exec", "out", "exec")], data: { seconds: 1 } },
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
  { id: "set-variable", group: "Actions", label: "Set Variable", visual: "variable", pins: [pin("Exec", "in", "exec"), pin("Value", "in", "float"), pin("Exec", "out", "exec")], data: { variable: "Value", varType: "float" } },
  { id: "get-variable", group: "Actions", label: "Get Variable", visual: "pure", pins: [pin("Value", "out", "float")], data: { variable: "Value", varType: "float" } },
  { id: "call-function", group: "Actions", label: "Call Function", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Exec", "out", "exec")], data: { function: "Function" } },
  { id: "spawn-actor", group: "Actions", label: "Spawn Actor", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Class", "in", "object"), pin("Exec", "out", "exec"), pin("Return Value", "out", "object")], data: { className: "AActor" } },
  { id: "cast-to", group: "Actions", label: "Cast To", visual: "function", pins: [pin("Exec", "in", "exec"), pin("Object", "in", "object"), pin("Exec", "out", "exec"), pin("As", "out", "object")], data: { className: "AActor" } },
];

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
    items: CATALOG.filter((entry) => entry.group === name && (!needle || entry.label.toLowerCase().includes(needle))),
  })).filter((group) => group.items.length);
  return groups;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function pinsFromSpec(entry, data) {
  return entry.pins.map((item) => {
    const type = (entry.id === "set-variable" || entry.id === "get-variable") && item.name === "Value"
      ? (data.varType || "float")
      : item.type;
    return { id: pinSlug(item.dir, item.name), name: item.name, dir: item.dir, type };
  });
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
    pins: pinsFromSpec(entry, data),
    data,
  };
  return node;
}

function labelFor(catalog, data, fallback) {
  if (catalog === "set-variable") return `Set ${data.variable || "Variable"}`;
  if (catalog === "get-variable") return `Get ${data.variable || "Variable"}`;
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
  };
}

function normalizeNode(node) {
  const catalog = BY_ID.get(node?.catalog);
  const data = { ...(node?.data || {}) };
  const pins = Array.isArray(node?.pins) && node.pins.length
    ? node.pins.map((item, index) => ({
      id: item.id || pinSlug(item.dir || "out", item.name || index),
      name: String(item.name || "Pin"),
      dir: item.dir === "in" ? "in" : "out",
      type: item.type || "wildcard",
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
    graphs: { schema: 1, active: eventGraph.id, items: [eventGraph, ...others] },
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

export function pinUnderPoint(graph, point, zoom = 1, hitPx = GRAPH_LAYOUT.hitPx) {
  const radius = hitPx / (zoom || 1);
  let best = null;
  for (const node of graph.nodes || []) {
    for (const pin of node.pins || []) {
      const center = pinCenter(node, pin);
      const dist = Math.hypot(center.x - point.x, center.y - point.y);
      if (dist > radius) continue;
      if (!best || dist < best.dist) best = { nodeId: node.id, pinId: pin.id, dist };
    }
  }
  return best;
}

export function nodeUnderPoint(graph, point) {
  for (const node of graph.nodes || []) {
    const size = nodeSize(node);
    if (point.x >= node.x && point.y >= node.y && point.x <= node.x + size.w && point.y <= node.y + size.h) return node;
  }
  return null;
}

// A drop near a compatible pin wins. A drop on the node body uses its first compatible pin.
export function pickWireTarget(graph, fromNode, fromPin, point, { zoom = 1, hitPx = GRAPH_LAYOUT.hitPx } = {}) {
  const near = pinUnderPoint(graph, point, zoom, hitPx);
  if (near && !(near.nodeId === fromNode && near.pinId === fromPin)) {
    const check = canConnect(graph, fromNode, fromPin, near.nodeId, near.pinId);
    if (check.ok) return { ok: true, nodeId: near.nodeId, pinId: near.pinId, how: "pin", hover: near };
    return { ok: false, reason: check.reason, hover: near, how: "pin" };
  }
  const body = nodeUnderPoint(graph, point);
  if (body && body.id !== fromNode) {
    const pin = firstCompatiblePin(graph, fromNode, fromPin, body);
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
    wires = wires.filter((wire) => !(wire.from.node === check.from.node && wire.from.pin === check.from.pin));
    wires = wires.filter((wire) => !(wire.to.node === check.to.node && wire.to.pin === check.to.pin));
  } else {
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

function incomingValue(graph, node, pinName) {
  const pinItem = node.pins.find((item) => item.dir === "in" && item.name === pinName);
  if (!pinItem) return "";
  const wire = graph.wires.find((item) => item.to.node === node.id && item.to.pin === pinItem.id);
  if (!wire) return "";
  const source = graph.nodes.find((item) => item.id === wire.from.node);
  if (!source) return "";
  if (source.catalog === "get-variable") return ident(source.data?.variable || "Value");
  if (source.catalog === "has-authority") return "HasAuthority()";
  return ident(source.label, "Value");
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
      const fallback = node.data?.varType === "bool" ? "false" : node.data?.varType === "string" ? 'TEXT("")' : "0";
      return `${name} = ${wired || fallback};`;
    }
    case "call-function":
      return `${ident(node.data?.function || "Function", "Function")}();`;
    case "spawn-actor":
      return `if (UWorld* World = GetWorld()) { World->SpawnActor<${ident(node.data?.className || "AActor", "AActor")}>(${ident(node.data?.className || "AActor", "AActor")}::StaticClass()); }`;
    case "cast-to": {
      const wired = incomingValue(graph, node, "Object") || "nullptr";
      return `if (${ident(node.data?.className || "AActor", "AActor")}* Cast_${id} = Cast<${ident(node.data?.className || "AActor", "AActor")}>(${wired})) { /* cast ok */ }`;
    }
    case "delay":
      return `if (UWorld* World = GetWorld()) { FTimerHandle Delay_${id}; World->GetTimerManager().SetTimer(Delay_${id}, ${Number(node.data?.seconds) || 0.5}f, false); }`;
    case "set-timer":
      return `if (UWorld* World = GetWorld()) { FTimerHandle Timer_${id}; World->GetTimerManager().SetTimer(Timer_${id}, ${Number(node.data?.seconds) || 1}f, false); }`;
    case "timeline":
      return `// Timeline ${ident(node.label, "Timeline")}`;
    case "has-authority":
      return "if (HasAuthority()) { /* authority */ }";
    case "dispatcher-call":
      return `${ident(node.data?.name || "OnChanged", "OnChanged")}.Broadcast();`;
    case "dispatcher-bind":
      return `// Bind ${ident(node.data?.name || "OnChanged", "OnChanged")}`;
    case "branch":
    case "sequence":
      return "";
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
    emitBody(graph, outgoing(graph, node, execOut.find((item) => item.name === "Then")?.id), `${indent}\t`, nextSeen, out);
    out.push(`${indent}}`);
    out.push(`${indent}else`);
    out.push(`${indent}{`);
    emitBody(graph, outgoing(graph, node, execOut.find((item) => item.name === "Else")?.id), `${indent}\t`, nextSeen, out);
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
      emitBody(graph, outgoing(graph, node, item.id), `${indent}\t`, nextSeen, out);
      out.push(`${indent}}`);
    });
    return;
  }
  const line = statementFor(node, graph);
  out.push(line ? `${indent}${line} // node:${node.id}` : `${indent}// node:${node.id}`);
  if (execOut[0]) emitBody(graph, outgoing(graph, node, execOut[0].id), indent, nextSeen, out);
}

function rpcMacro(catalog) {
  if (catalog === "server-rpc") return "UFUNCTION(Server, Reliable)";
  if (catalog === "client-rpc") return "UFUNCTION(Client, Reliable)";
  if (catalog === "multicast-rpc") return "UFUNCTION(NetMulticast, Reliable)";
  return "UFUNCTION(BlueprintCallable, Category=\"EventGraph\")";
}

export function syncCpp(system, graph) {
  const eventGraph = normalizeGraph(graph);
  const cls = classNameOf(system?.cpp_header);
  const events = eventGraph.nodes.filter((node) => node.kind === "event").sort(byPos);
  const headerLines = ["public:"];
  const sourceLines = [];
  if (!events.length) {
    headerLines.push("\t// No event graph handlers.");
    sourceLines.push("// No event graph handlers.");
  }
  for (const event of events) {
    const base = functionBase(event);
    const cppName = RPCS.has(event.catalog) ? `${base}_Implementation` : base;
    headerLines.push(`\t${rpcMacro(event.catalog)}`);
    headerLines.push(`\tvoid ${base}(); // node:${event.id}`);
    sourceLines.push(`void ${cls}::${cppName}() // node:${event.id}`);
    sourceLines.push("{");
    const first = outgoing(eventGraph, event, event.pins.find((item) => item.dir === "out" && item.type === "exec")?.id);
    emitBody(eventGraph, first, "\t", new Set([event.id]), sourceLines);
    sourceLines.push("}");
    sourceLines.push("");
  }
  const header = spliceMarked(system?.cpp_header || "", headerLines.join("\n"), true);
  let source = spliceMarked(system?.cpp_source || "", sourceLines.join("\n").trimEnd(), false);
  if (/GetWorld\s*\(/.test(source) && !source.includes("Engine/World.h") && !String(system?.cpp_header || "").includes("Engine/World.h")) {
    source = `#include "Engine/World.h"\n${source}`;
  }
  return { cpp_header: header, cpp_source: source, lines: lineIndex(header, source) };
}

function spliceMarked(text, block, insideClass) {
  const source = String(text || "");
  const wrapped = `${MARKER_BEGIN}\n${block}\n${MARKER_END}`;
  const begin = source.indexOf(MARKER_BEGIN);
  const end = source.indexOf(MARKER_END);
  if (begin >= 0 && end > begin) return `${source.slice(0, begin)}${wrapped}${source.slice(end + MARKER_END.length)}`;
  if (insideClass) {
    const close = source.lastIndexOf("};");
    if (close >= 0) return `${source.slice(0, close)}${wrapped}\n${source.slice(close)}`;
  }
  return `${source.replace(/\s*$/, "")}\n\n${wrapped}\n`;
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

export function graphWarnings(graph, locks = []) {
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
