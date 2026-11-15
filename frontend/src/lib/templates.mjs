// Turns a stored graph template into nodes on the open document.
// Templates live in content/templates and are loaded by the desktop server.

import { addFunction, addNode, addVariable, createNode, emptyGraph, tryWire } from "./graph.mjs";

export function realizeTemplate(template) {
  const warnings = [];
  if (!template?.id || !template?.graph?.nodes) {
    return { graph: emptyGraph(), warnings: ["That template has no graph."] };
  }
  let graph = emptyGraph({
    kind: template.graph.kind || "event",
    name: template.graph.name || template.title || template.id,
    id: `tpl-${template.id}`,
  });
  const ids = {};
  for (const spec of template.graph.nodes) {
    const node = createNode(spec.catalog, spec.x || 0, spec.y || 0, {
      id: `tpl_${template.id}_${spec.key}`,
      data: { ...(spec.data || {}) },
      label: spec.label,
    });
    if (spec.note) node.data = { ...node.data, note: spec.note };
    if (spec.pinType) {
      node.pins = node.pins.map((pin) => (pin.type === "float" ? { ...pin, type: spec.pinType } : pin));
    }
    ids[spec.key] = node.id;
    graph = addNode(graph, node);
  }
  for (const spec of template.graph.wires || []) {
    const from = graph.nodes.find((node) => node.id === ids[spec.from]);
    const to = graph.nodes.find((node) => node.id === ids[spec.to]);
    if (!from || !to) {
      warnings.push(`Missing node for ${spec.from} -> ${spec.to}.`);
      continue;
    }
    const fromPin = from.pins.find((pin) => pin.name === spec.fromPin && pin.dir === "out") || from.pins.find((pin) => pin.name === spec.fromPin);
    const toPin = to.pins.find((pin) => pin.name === spec.toPin && pin.dir === "in") || to.pins.find((pin) => pin.name === spec.toPin);
    if (!fromPin || !toPin) {
      warnings.push(`${spec.from}.${spec.fromPin} -> ${spec.to}.${spec.toPin} is not a pin on those nodes.`);
      continue;
    }
    const result = tryWire(graph, from.id, fromPin.id, to.id, toPin.id);
    if (!result.ok) warnings.push(`${spec.from}.${spec.fromPin} -> ${spec.to}.${spec.toPin}: ${result.reason}`);
    else graph = result.graph;
  }
  for (const spec of template.graph.comments || []) {
    graph.comments.push({ id: `tplc_${template.id}_${spec.key || graph.comments.length}`, x: spec.x || 0, y: spec.y || 0, w: spec.w || 280, h: spec.h || 80, text: spec.text || "" });
  }
  return { graph, warnings };
}

export function applyTemplate(doc, template, { mode = "insert", graphId } = {}) {
  let next = doc || { schema: 1, items: [], variables: [], active: "event" };
  for (const variable of template?.variables || []) {
    if ((next.variables || []).some((item) => item.name === variable.name)) continue;
    next = addVariable(next, variable);
  }
  const built = realizeTemplate(template);
  if (mode === "new") {
    next = addFunction(next, template?.graph?.name || template?.title || "Template");
    const id = next.active;
    next = {
      ...next,
      items: next.items.map((item) => (item.id === id ? { ...item, nodes: [...item.nodes, ...built.graph.nodes], wires: [...item.wires, ...built.graph.wires], comments: [...(item.comments || []), ...built.graph.comments] } : item)),
    };
    return { doc: next, warnings: built.warnings, graphId: id };
  }
  const id = graphId || next.active || next.items.find((item) => item.kind === "event")?.id;
  const host = next.items.find((item) => item.id === id) || next.items[0];
  const shift = (host?.nodes || []).reduce((max, node) => Math.max(max, (node.x || 0) + 240), 0);
  const nodes = built.graph.nodes.map((node) => ({ ...node, x: (node.x || 0) + (host?.nodes?.length ? shift : 0) }));
  next = {
    ...next,
    items: next.items.map((item) => (item.id === host.id ? { ...item, nodes: [...item.nodes, ...nodes], wires: [...item.wires, ...built.graph.wires], comments: [...(item.comments || []), ...built.graph.comments] } : item)),
  };
  return { doc: next, warnings: built.warnings, graphId: host.id };
}
