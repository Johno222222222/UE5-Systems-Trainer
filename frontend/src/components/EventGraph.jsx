import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import GlossaryText from "./GlossaryText";
import { api } from "../lib/api";
import { exportBlueprintText, importBlueprintText } from "../lib/blueprint-text.mjs";
import { formatValue, startSimulation, stepSimulation } from "../lib/simulate.mjs";
import { applyTemplate } from "../lib/templates.mjs";
import {
  addComment, addFunction, addMacro, addNode, addVariable, catalogGroups, clientToGraphPoint, collapseSelection,
  commitHistory, createHistory, createNode, deleteGraph, deleteVariable, duplicateParts, explainGraph,
  GRAPH_LAYOUT, graphWarnings, pickWireTarget, pinCenter, pinColor, placeCall, placeNodes, readDocument,
  readEventGraph, redoHistory, removeParts, renameGraph, setFunctionSignature, setNodeData, snapValue,
  structChoices, systemSymbols, tryWire, undoHistory, updateVariable, VALUE_TYPES, variableNode,
} from "../lib/graph.mjs";

const NODE_W = GRAPH_LAYOUT.nodeW;

function wirePath(x1, y1, x2, y2) {
  const dx = Math.max(48, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

function clampZoom(value) {
  return Math.min(1.6, Math.max(0.35, value));
}

function parsePins(text) {
  return String(text || "").split(",").map((part) => part.trim()).filter(Boolean).map((part) => {
    const [name, type] = part.split(":").map((item) => item.trim());
    return { name: name || "Value", type: type || "float" };
  });
}

function LibraryRow({ item, active, testId, onOpen, onRename, onDelete }) {
  return (
    <div className={`graph-lib-item ${active ? "is-on" : ""}`} data-testid={testId} draggable onDragStart={(event) => event.dataTransfer.setData("text/plain", `graph:${item.id}`)} onDoubleClick={onOpen}>
      <button type="button" className="graph-lib-name" onClick={onOpen}>{item.name}</button>
      <button type="button" className="graph-lib-add" aria-label={`Rename ${item.name}`} onClick={() => { const name = window.prompt("Name", item.name); if (name) onRename(name); }}>✎</button>
      <button type="button" className="graph-lib-add" aria-label={`Delete ${item.name}`} onClick={onDelete}>×</button>
    </div>
  );
}

function VariableEditor({ variable, onChange, onDelete }) {
  if (!variable) return null;
  return (
    <div className="mt-2" data-testid="variable-editor">
      <select className="graph-search" aria-label="Variable type" value={variable.type} onChange={(event) => onChange(event.target.value === "struct" ? { type: "struct", structName: variable.structName || "FCustomStruct", members: variable.members?.length ? variable.members : [{ name: "Value", type: "float" }] } : { type: event.target.value })}>
        {VALUE_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
      </select>
      <input className="graph-search mt-1" aria-label="Default value" defaultValue={variable.default || ""} onBlur={(event) => onChange({ default: event.target.value })} />
      <label className="flex items-center gap-2 text-[11px] mt-1"><input type="checkbox" checked={!!variable.array} onChange={(event) => onChange({ array: event.target.checked })} /> Array</label>
      <label className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={!!variable.replicated} onChange={(event) => onChange({ replicated: event.target.checked })} /> Replicated</label>
      <label className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={!!variable.repNotify} onChange={(event) => onChange({ repNotify: event.target.checked, replicated: event.target.checked || variable.replicated })} /> RepNotify</label>
      {variable.type === "enum" && <input className="graph-search mt-1" aria-label="Enum name" defaultValue={variable.enumName || ""} placeholder="Enum name" onBlur={(event) => onChange({ enumName: event.target.value })} />}
      {variable.type === "struct" && (
        <>
          <input className="graph-search mt-1" aria-label="Struct name" defaultValue={variable.structName || "FCustomStruct"} placeholder="FCustomStruct" onBlur={(event) => onChange({ type: "struct", structName: event.target.value || "FCustomStruct", members: variable.members?.length ? variable.members : [{ name: "Value", type: "float" }] })} />
          <input className="graph-search mt-1" aria-label="Struct members" defaultValue={(variable.members || []).map((item) => `${item.name}:${item.type}`).join(", ")} placeholder="Value:float, Flag:bool" onBlur={(event) => onChange({ members: parsePins(event.target.value) })} />
        </>
      )}
      <button type="button" className="ue-btn !py-0.5 !px-1.5 !text-[10px] mt-1" onClick={() => onDelete(variable.id)}>Delete variable</button>
    </div>
  );
}

function typingTarget(target) {
  const tag = target?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;
}

function anchorOf(node, pin) {
  return pinCenter(node, pin);
}

function nodeHeight(node) {
  const rows = Math.max(
    node.pins.filter((item) => item.dir === "in").length,
    node.pins.filter((item) => item.dir === "out").length,
    1,
  );
  return GRAPH_LAYOUT.header + GRAPH_LAYOUT.bodyPad + rows * GRAPH_LAYOUT.row + 8;
}

export default function EventGraph({
  system, editable = true, locks = [], whyByNode = {}, highlightIds = [], onChange, onDocument, onShowCpp, onExplain, onRevertManual, children,
}) {
  const canvasRef = useRef(null);
  const [history, setHistory] = useState(() => createHistory(readEventGraph(system)));
  const [selection, setSelection] = useState({ nodes: [], wires: [], comments: [] });
  const [pan, setPan] = useState({ x: 40, y: 48 });
  const [zoom, setZoom] = useState(0.9);
  const [snap, setSnap] = useState(true);
  const [query, setQuery] = useState("");
  const [drag, setDrag] = useState(null);
  const [menu, setMenu] = useState(null);
  const [hint, setHint] = useState(null);
  const [summary, setSummary] = useState("");
  const [explainOpen, setExplainOpen] = useState(false);
  const [sim, setSim] = useState(null);
  const [notesOn, setNotesOn] = useState(true);
  const [graphTemplates, setGraphTemplates] = useState([]);
  const [blueprintPanel, setBlueprintPanel] = useState(null);
  const [pasteText, setPasteText] = useState("");
  const simRef = useRef(null);
  const [explainState, setExplainState] = useState("");
  const [explainError, setExplainError] = useState("");
  const [armed, setArmed] = useState(null);
  const [hotPin, setHotPin] = useState(null);
  const dragRef = useRef(null);
  const clip = useRef(null);
  const doc = useMemo(() => readDocument(system), [system]);
  const [openTabs, setOpenTabs] = useState(["event"]);
  const [activeId, setActiveId] = useState("event");
  const [varMenu, setVarMenu] = useState(null);
  const activeMeta = doc.items.find((item) => item.id === activeId) || doc.items.find((item) => item.kind === "event");
  const graph = history.present?.id === activeMeta?.id ? history.present : (activeMeta || history.present);
  const warnings = useMemo(() => graphWarnings(graph, locks, { functions: doc.items.filter((item) => item.kind === "function") }), [graph, locks, doc]);
  const warningByNode = useMemo(() => {
    const map = {};
    warnings.forEach((item) => { (map[item.nodeId] = map[item.nodeId] || []).push(item); });
    return map;
  }, [warnings]);
  const symbols = useMemo(() => systemSymbols(system), [system]);

  const incoming = JSON.stringify(activeMeta || readEventGraph(system));
  useEffect(() => {
    setHistory((current) => (JSON.stringify(current.present) === incoming ? current : createHistory(JSON.parse(incoming))));
  }, [incoming]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      setZoom((value) => clampZoom(value - event.deltaY * 0.001));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    let cancel = false;
    api.get("/graph-templates").then((res) => { if (!cancel) setGraphTemplates(res.data?.templates || []); }).catch(() => {});
    return () => { cancel = true; };
  }, []);

  useEffect(() => { simRef.current = { sim, graph, doc }; });
  useEffect(() => {
    if (sim?.status !== "running") return undefined;
    const timer = setInterval(() => {
      const cur = simRef.current;
      if (!cur?.sim || cur.sim.status !== "running") return;
      setSim(stepSimulation({ ...cur.sim, status: "running" }, cur.graph, cur.doc));
    }, 520);
    return () => clearInterval(timer);
  }, [sim?.status]);

  const playSim = () => {
    const started = startSimulation(doc, graph, { nodeId: selection.nodes[0], authority: sim?.authority !== false });
    setSim(started.status === "done" ? started : { ...started, status: "running" });
  };
  const stepSim = () => {
    setSim((current) => {
      const base = current && current.status !== "done" ? { ...current, status: "paused" } : startSimulation(doc, graph, { nodeId: selection.nodes[0], authority: current?.authority !== false });
      return stepSimulation(base, graph, doc);
    });
  };
  const insertTemplate = (template, mode) => {
    const applied = applyTemplate(doc, template, { mode, graphId: activeMeta?.id });
    publish(applied.doc);
    if (applied.graphId) {
      setOpenTabs((tabs) => (tabs.includes(applied.graphId) ? tabs : [...tabs, applied.graphId]));
      setActiveId(applied.graphId);
    }
    if (applied.warnings.length) setHint({ x: 24, y: 80, text: applied.warnings[0] });
  };
  const copyBlueprint = async () => {
    const result = exportBlueprintText(graph, { nodeIds: selection.nodes.length ? selection.nodes : undefined });
    setBlueprintPanel({ mode: "copy", warnings: result.warnings });
    setPasteText(result.text);
    try { await navigator.clipboard.writeText(result.text); } catch { /* the panel keeps the text */ }
  };
  const pasteBlueprint = () => {
    const result = importBlueprintText(pasteText);
    const shift = graph.nodes.reduce((max, node) => Math.max(max, (node.x || 0) + 240), 0);
    const nodes = result.nodes.map((node) => ({ ...node, x: (node.x || 0) + (graph.nodes.length ? shift : 0) }));
    commit({ ...graph, nodes: [...graph.nodes, ...nodes], wires: [...graph.wires, ...result.wires] });
    setBlueprintPanel({ mode: "paste", warnings: result.warnings });
  };

  const publish = (nextDoc) => {
    if (onDocument) onDocument(nextDoc);
    else onChange?.(nextDoc.items.find((item) => item.kind === "event") || nextDoc.items[0]);
  };
  const commit = (next) => {
    const stored = { ...next, id: activeMeta?.id || next.id, kind: activeMeta?.kind || next.kind, name: activeMeta?.name || next.name, pure: activeMeta?.pure, callable: activeMeta?.callable, inputs: activeMeta?.inputs, outputs: activeMeta?.outputs };
    setHistory((current) => commitHistory(current, stored));
    publish({ ...doc, items: doc.items.map((item) => (item.id === stored.id ? stored : item)) });
  };
  const undo = () => {
    const next = undoHistory(history);
    setHistory(next);
    onChange?.(next.present);
  };
  const redo = () => {
    const next = redoHistory(history);
    setHistory(next);
    onChange?.(next.present);
  };

  const rememberDrag = (next) => {
    dragRef.current = next;
    setDrag(next);
  };
  const toGraph = (clientX, clientY) => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return clientToGraphPoint({
      clientX,
      clientY,
      rect,
      pan,
      zoom,
      scrollX: canvas.scrollLeft || 0,
      scrollY: canvas.scrollTop || 0,
    });
  };
  const chromeTarget = (target) => Boolean(target?.closest?.("[data-graph-chrome], button, a, input, textarea, select"));
  const grid = (value) => snapValue(value, snap);

  const selectedNode = selection.nodes.length === 1 ? graph.nodes.find((node) => node.id === selection.nodes[0]) : null;

  const onKeyDown = (event) => {
    if (!editable || typingTarget(event.target)) return;
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key.toLowerCase() === "z" && !event.shiftKey) { event.preventDefault(); undo(); return; }
    if (mod && (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey))) { event.preventDefault(); redo(); return; }
    if (mod && event.key.toLowerCase() === "d") {
      event.preventDefault();
      const copy = duplicateParts(graph, { nodes: selection.nodes, comments: selection.comments });
      commit(copy.graph);
      setSelection({ nodes: copy.nodeIds, wires: [], comments: copy.commentIds });
      return;
    }
    if (mod && event.key.toLowerCase() === "c") {
      clip.current = { nodes: selection.nodes, comments: selection.comments };
      return;
    }
    if (mod && event.key.toLowerCase() === "v" && clip.current) {
      event.preventDefault();
      const copy = duplicateParts(graph, clip.current);
      commit(copy.graph);
      setSelection({ nodes: copy.nodeIds, wires: [], comments: copy.commentIds });
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      commit(removeParts(graph, selection));
      setSelection({ nodes: [], wires: [], comments: [] });
    }
  };

  const startMove = (event, kind, id) => {
    if (event.target.closest?.("[data-pin-id]") || chromeTarget(event.target)) return;
    if (!editable || event.button !== 0) return;
    event.stopPropagation();
    const already = kind === "node" ? selection.nodes.includes(id) : selection.comments.includes(id);
    const nodes = kind === "node" ? (event.shiftKey ? (already ? selection.nodes.filter((item) => item !== id) : [...selection.nodes, id]) : (already ? selection.nodes : [id])) : selection.nodes;
    const comments = kind === "comment" ? (event.shiftKey ? (already ? selection.comments.filter((item) => item !== id) : [...selection.comments, id]) : (already ? selection.comments : [id])) : (event.shiftKey ? selection.comments : []);
    if (!event.shiftKey && !already) {
      if (kind === "node") setSelection({ nodes: [id], wires: [], comments: [] });
      else setSelection({ nodes: [], wires: [], comments: [id] });
    } else setSelection({ nodes, wires: [], comments });
    const movingNodes = (kind === "node" && !event.shiftKey && !already ? [id] : nodes);
    const movingComments = (kind === "comment" && !event.shiftKey && !already ? [id] : comments);
    const origins = {};
    graph.nodes.forEach((node) => { if (movingNodes.includes(node.id)) origins[node.id] = { x: node.x, y: node.y }; });
    graph.comments.forEach((comment) => { if (movingComments.includes(comment.id)) origins[comment.id] = { x: comment.x, y: comment.y, w: comment.w, h: comment.h }; });
    rememberDrag({
      mode: "move", kind, id, startX: event.clientX, startY: event.clientY, origins, moved: false,
      nodes: movingNodes, comments: movingComments,
    });
    try { canvasRef.current?.setPointerCapture?.(event.pointerId); } catch { /* already released */ }
  };

  const onCanvasDown = (event) => {
    if (chromeTarget(event.target)) return;
    setMenu(null);
    if (!typingTarget(event.target)) canvasRef.current?.focus();
    const pinEl = event.target.closest?.("[data-pin-id]");
    if (pinEl && editable && event.button === 0 && !event.altKey) {
      event.stopPropagation();
      try { canvasRef.current?.setPointerCapture?.(event.pointerId); } catch { /* already released */ }
      rememberDrag({ mode: "wire", nodeId: pinEl.dataset.pinNode, pinId: pinEl.dataset.pinId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
      return;
    }
    if (event.target.closest?.("[data-node-id]") || event.target.closest?.("[data-comment-id]") || event.target.closest?.("[data-pin-id]")) return;
    if (event.button === 1 || event.button === 2 || event.altKey) {
      rememberDrag({ mode: "pan", startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y });
      try { canvasRef.current?.setPointerCapture?.(event.pointerId); } catch { /* already released */ }
      return;
    }
    if (event.button !== 0) return;
    try { canvasRef.current?.setPointerCapture?.(event.pointerId); } catch { /* already released */ }
    const point = toGraph(event.clientX, event.clientY);
    rememberDrag({ mode: "box", startX: event.clientX, startY: event.clientY, x: point.x, y: point.y, cx: point.x, cy: point.y, moved: false, shift: event.shiftKey });
  };

  const onMove = (event) => {
    const dragNow = dragRef.current;
    if (!dragNow) return;
    if (dragNow.mode === "pan") {
      setPan({ x: dragNow.panX + (event.clientX - dragNow.startX), y: dragNow.panY + (event.clientY - dragNow.startY) });
      return;
    }
    if (dragNow.mode === "wire") {
      rememberDrag({ ...dragNow, x: event.clientX, y: event.clientY });
      const point = toGraph(event.clientX, event.clientY);
      const hit = pickWireTarget(graph, dragNow.nodeId, dragNow.pinId, point, { zoom });
      setHotPin(hit.hover || null);
      setHint(hit.ok || !hit.hover ? null : { x: event.clientX + 14, y: event.clientY + 14, text: hit.reason });
      return;
    }
    if (dragNow.mode === "box") {
      const point = toGraph(event.clientX, event.clientY);
      const moved = Math.abs(event.clientX - dragNow.startX) > 4 || Math.abs(event.clientY - dragNow.startY) > 4;
      rememberDrag({ ...dragNow, cx: point.x, cy: point.y, moved });
      return;
    }
    if (dragNow.mode === "move" || dragNow.mode === "resize") {
      const dx = (event.clientX - dragNow.startX) / zoom;
      const dy = (event.clientY - dragNow.startY) / zoom;
      const moved = dragNow.moved || Math.abs(dx) > 2 || Math.abs(dy) > 2;
      rememberDrag({ ...dragNow, dx, dy, moved });
    }
  };

  const finish = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.mode === "wire") {
      const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (moved < 5) {
        if (armed && (armed.nodeId !== drag.nodeId || armed.pinId !== drag.pinId)) {
          const result = tryWire(graph, armed.nodeId, armed.pinId, drag.nodeId, drag.pinId);
          if (result.ok) { commit(result.graph); setHint(null); }
          else setHint({ x: event.clientX + 14, y: event.clientY + 14, text: result.reason });
          setArmed(null);
        } else {
          setArmed({ nodeId: drag.nodeId, pinId: drag.pinId });
          setHint(null);
        }
      } else {
        const point = toGraph(event.clientX, event.clientY);
        const stack = document.elementsFromPoint(event.clientX, event.clientY);
        const pinEl = stack.map((el) => el.closest?.("[data-pin-id]")).find(Boolean);
        const hit = pickWireTarget(graph, drag.nodeId, drag.pinId, point, {
          zoom,
          targetNode: pinEl?.dataset?.pinNode,
          targetPin: pinEl?.dataset?.pinId,
        });
        if (hit.ok) {
          const result = tryWire(graph, drag.nodeId, drag.pinId, hit.nodeId, hit.pinId);
          if (result.ok) { commit(result.graph); setHint(null); setArmed(null); }
          else setHint({ x: event.clientX + 14, y: event.clientY + 14, text: result.reason });
        } else setHint({ x: event.clientX + 14, y: event.clientY + 14, text: hit.reason });
      }
      setHotPin(null);
    } else if (drag.mode === "box") {
      if (!drag.moved) {
        if (!drag.shift) setSelection({ nodes: [], wires: [], comments: [] });
      } else {
        const x1 = Math.min(drag.x, drag.cx);
        const y1 = Math.min(drag.y, drag.cy);
        const x2 = Math.max(drag.x, drag.cx);
        const y2 = Math.max(drag.y, drag.cy);
        const hits = (rect) => rect.x < x2 && rect.x + rect.w > x1 && rect.y < y2 && rect.y + rect.h > y1;
        const nodes = graph.nodes.filter((node) => hits({ x: node.x, y: node.y, w: NODE_W, h: nodeHeight(node) })).map((node) => node.id);
        const comments = graph.comments.filter((comment) => hits(comment)).map((comment) => comment.id);
        setSelection({
          nodes: drag.shift ? [...new Set([...selection.nodes, ...nodes])] : nodes,
          wires: [],
          comments: drag.shift ? [...new Set([...selection.comments, ...comments])] : comments,
        });
      }
    } else if (drag.mode === "move" && drag.moved) {
      const positions = {};
      drag.nodes.forEach((id) => {
        const origin = drag.origins[id];
        positions[id] = { x: grid(origin.x + drag.dx), y: grid(origin.y + drag.dy) };
      });
      drag.comments.forEach((id) => {
        const origin = drag.origins[id];
        positions[id] = { x: grid(origin.x + drag.dx), y: grid(origin.y + drag.dy), w: origin.w, h: origin.h };
      });
      commit(placeNodes(graph, positions));
    } else if (drag.mode === "resize" && drag.moved) {
      const origin = drag.origins[drag.id];
      commit(placeNodes(graph, { [drag.id]: { x: origin.x, y: origin.y, w: Math.max(120, origin.w + drag.dx), h: Math.max(72, origin.h + drag.dy) } }));
    }
    rememberDrag(null);
  };

  const displayPos = (id, fallback) => {
    if (drag?.mode === "move" && drag.origins[id] && drag.dx != null) {
      return { x: drag.origins[id].x + drag.dx, y: drag.origins[id].y + drag.dy };
    }
    return fallback;
  };

  const openMenu = (event, extra) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, ...extra });
  };

  const dropNode = (event) => {
    event.preventDefault();
    if (!editable) return;
    const raw = event.dataTransfer.getData("text/plain");
    const point = toGraph(event.clientX, event.clientY);
    if (raw.startsWith("var:")) {
      setVarMenu({ id: raw.slice(4), x: event.clientX, y: event.clientY, gx: grid(point.x), gy: grid(point.y) });
      return;
    }
    if (raw.startsWith("graph:")) {
      const node = placeCall(doc, raw.slice(6), grid(point.x), grid(point.y));
      if (!node) return;
      commit(addNode(graph, node));
      setSelection({ nodes: [node.id], wires: [], comments: [] });
      return;
    }
    if (!raw.startsWith("node:")) return;
    const node = createNode(raw.slice(5), grid(point.x), grid(point.y));
    commit(addNode(graph, node));
    setSelection({ nodes: [node.id], wires: [], comments: [] });
  };

  const commentAround = (event) => {
    event?.stopPropagation?.();
    let next;
    if (selection.nodes.length) {
      const picked = graph.nodes.filter((node) => selection.nodes.includes(node.id));
      const x = Math.min(...picked.map((node) => node.x)) - 28;
      const y = Math.min(...picked.map((node) => node.y)) - 40;
      const w = Math.max(...picked.map((node) => node.x)) + NODE_W + 28 - x;
      const h = Math.max(...picked.map((node) => node.y + nodeHeight(node))) + 28 - y;
      next = addComment(graph, { x, y, w, h, text: "Comment" });
    } else {
      const rect = canvasRef.current?.getBoundingClientRect();
      const point = rect ? toGraph(rect.left + rect.width / 2, rect.top + rect.height / 2) : { x: 80, y: 80 };
      next = addComment(graph, { x: grid(point.x - 140), y: grid(point.y - 70), text: "Comment" });
    }
    const added = next.comments.find((comment) => !graph.comments.some((item) => item.id === comment.id));
    commit(next);
    if (added) setSelection({ nodes: [], wires: [], comments: [added.id] });
  };

  const runExplain = async (event) => {
    event?.stopPropagation?.();
    const fallback = explainGraph(graph);
    setExplainOpen(true);
    setExplainError("");
    setSummary(fallback);
    setExplainState("loading");
    if (!onExplain) { setExplainState("ready"); return; }
    try {
      const next = await onExplain(graph, fallback);
      const text = typeof next === "string" ? next : next?.text;
      setSummary(text || fallback);
      setExplainState("ready");
    } catch (err) {
      setExplainError(err?.message || "Couldn't explain this graph.");
      setSummary(fallback);
      setExplainState("error");
    }
  };

  const wirePreview = () => {
    if (drag?.mode !== "wire") return null;
    const node = graph.nodes.find((item) => item.id === drag.nodeId);
    const pin = node?.pins.find((item) => item.id === drag.pinId);
    if (!node || !pin) return null;
    const placed = { ...node, ...displayPos(node.id, node) };
    const start = anchorOf(placed, pin);
    const end = toGraph(drag.x, drag.y);
    return { d: wirePath(start.x, start.y, end.x, end.y), color: hint ? "#e02424" : pinColor(pin.type) };
  };
  const preview = wirePreview();

  const bounds = graph.nodes.reduce((box, node) => ({
    minX: Math.min(box.minX, node.x),
    minY: Math.min(box.minY, node.y),
    maxX: Math.max(box.maxX, node.x + NODE_W),
    maxY: Math.max(box.maxY, node.y + nodeHeight(node)),
  }), { minX: 0, minY: 0, maxX: 400, maxY: 240 });
  const mapW = 168;
  const mapH = 104;
  const spanX = Math.max(80, bounds.maxX - bounds.minX);
  const spanY = Math.max(80, bounds.maxY - bounds.minY);
  const mapScale = Math.min(mapW / (spanX + 40), mapH / (spanY + 40));

  return (
    <div className="flex h-full min-h-0 overflow-hidden" data-testid="event-graph">
      {editable && (
        <aside className="graph-library" data-testid="blueprint-panel" data-graph-chrome onPointerDown={(event) => event.stopPropagation()}>
          <div className="eyebrow">My Blueprint</div>
          <div className="mt-2 eyebrow">Event Graph</div>
          {doc.items.filter((item) => item.kind === "event").map((item) => (
            <button key={item.id} type="button" className={`graph-lib-item ${activeMeta?.id === item.id ? "is-on" : ""}`} onDoubleClick={() => setActiveId(item.id)} onClick={() => setActiveId(item.id)}>{item.name}</button>
          ))}
          <div className="mt-3 flex items-center justify-between"><span className="eyebrow">Functions</span><button type="button" className="graph-lib-add" data-testid="add-function" onClick={() => { const next = addFunction(doc, "NewFunction"); publish(next); setActiveId(next.active); setOpenTabs((tabs) => [...tabs, next.active]); }}>+</button></div>
          {doc.items.filter((item) => item.kind === "function").map((item) => (
            <LibraryRow key={item.id} item={item} active={activeMeta?.id === item.id} testId={`function-${item.id}`} onOpen={() => { setOpenTabs((tabs) => (tabs.includes(item.id) ? tabs : [...tabs, item.id])); setActiveId(item.id); }} onRename={(name) => publish(renameGraph(doc, item.id, name))} onDelete={() => publish(deleteGraph(doc, item.id))} />
          ))}
          <div className="mt-3 flex items-center justify-between"><span className="eyebrow">Macros</span><button type="button" className="graph-lib-add" data-testid="add-macro" onClick={() => { const next = addMacro(doc, "NewMacro"); publish(next); setActiveId(next.active); setOpenTabs((tabs) => [...tabs, next.active]); }}>+</button></div>
          {doc.items.filter((item) => item.kind === "macro").map((item) => (
            <LibraryRow key={item.id} item={item} active={activeMeta?.id === item.id} testId={`macro-${item.id}`} onOpen={() => { setOpenTabs((tabs) => (tabs.includes(item.id) ? tabs : [...tabs, item.id])); setActiveId(item.id); }} onRename={(name) => publish(renameGraph(doc, item.id, name))} onDelete={() => publish(deleteGraph(doc, item.id))} />
          ))}
          <div className="mt-3 flex items-center justify-between"><span className="eyebrow">Variables</span><button type="button" className="graph-lib-add" data-testid="add-variable" onClick={() => publish(addVariable(doc, { name: "NewVar", type: "float" }))}>+</button></div>
          {(activeMeta?.kind === "function" || activeMeta?.kind === "macro") && (
            <div className="graph-signature" data-testid="signature-editor">
              <div className="eyebrow mt-3">{activeMeta.kind}</div>
              <label className="block text-[11px] mt-1">Inputs <input className="graph-search" aria-label="Inputs" defaultValue={(activeMeta.inputs || []).map((item) => `${item.name}:${item.type}`).join(", ")} onBlur={(event) => publish(setFunctionSignature(doc, activeMeta.id, { inputs: parsePins(event.target.value), outputs: activeMeta.outputs || [], pure: !!activeMeta.pure, callable: activeMeta.callable !== false }))} /></label>
              <label className="block text-[11px] mt-1">Outputs <input className="graph-search" aria-label="Outputs" defaultValue={(activeMeta.outputs || []).map((item) => `${item.name}:${item.type}`).join(", ")} onBlur={(event) => publish(setFunctionSignature(doc, activeMeta.id, { inputs: activeMeta.inputs || [], outputs: parsePins(event.target.value), pure: !!activeMeta.pure, callable: activeMeta.callable !== false }))} /></label>
              {activeMeta.kind === "function" && (
                <label className="flex items-center gap-2 text-[12px] mt-1"><input type="checkbox" data-testid="pure-toggle" checked={!!activeMeta.pure} onChange={(event) => publish(setFunctionSignature(doc, activeMeta.id, { inputs: activeMeta.inputs || [], outputs: activeMeta.outputs || [], pure: event.target.checked, callable: activeMeta.callable !== false }))} /> Pure</label>
              )}
              {activeMeta.kind === "function" && (
                <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" data-testid="callable-toggle" checked={activeMeta.callable !== false} onChange={(event) => publish(setFunctionSignature(doc, activeMeta.id, { inputs: activeMeta.inputs || [], outputs: activeMeta.outputs || [], pure: !!activeMeta.pure, callable: event.target.checked }))} /> BlueprintCallable</label>
              )}
            </div>
          )}
          {(doc.variables || []).map((variable) => (
            <div key={variable.id} className="graph-lib-item" draggable data-testid={`variable-${variable.id}`} onClick={() => setVarMenu({ edit: variable.id })} onDragStart={(event) => event.dataTransfer.setData("text/plain", `var:${variable.id}`)}>
              <span>{variable.name}</span>
              <span className="graph-lib-meta">{variable.array ? "array " : ""}{variable.type}</span>
            </div>
          ))}
          {doc.variables?.[0] && (
            <VariableEditor variable={doc.variables.find((item) => item.id === (varMenu?.edit || doc.variables[0].id)) || doc.variables[0]} onChange={(patch) => publish(updateVariable(doc, (varMenu?.edit || doc.variables[0].id), patch))} onDelete={(id) => publish(deleteVariable(doc, id))} onPick={(id) => setVarMenu({ edit: id })} />
          )}
          <div className="mt-3 eyebrow">New from template</div>
          <div data-testid="graph-templates">
            {graphTemplates.map((template) => (
              <div key={template.id} className="graph-lib-item" data-testid={`template-${template.id}`}>
                <span title={[template.when_to_use, template.common_mistakes].filter(Boolean).join(" ")}>{template.title}</span>
                <button type="button" className="graph-lib-add" aria-label={`Insert ${template.title}`} onClick={() => insertTemplate(template, "insert")}>+</button>
                <button type="button" className="graph-lib-add" aria-label={`Open ${template.title}`} onClick={() => insertTemplate(template, "new")}>↗</button>
              </div>
            ))}
          </div>
        </aside>
      )}
      {editable && (
        <aside className="graph-palette" data-testid="graph-palette">
          <input className="graph-search" value={query} placeholder="Search events" aria-label="Search events" data-testid="graph-search" onChange={(event) => setQuery(event.target.value)} />
          {catalogGroups(query).map((group) => (
            <div key={group.name} className="mt-3">
              <div className="eyebrow mb-1">{group.name}</div>
              {group.items.map((entry) => (
                <div
                  key={entry.id}
                  className="graph-palette-item"
                  draggable
                  data-testid={`palette-${entry.id}`}
                  onDragStart={(event) => event.dataTransfer.setData("text/plain", `node:${entry.id}`)}
                >
                  {entry.label}
                </div>
              ))}
            </div>
          ))}
        </aside>
      )}
      <div
        ref={canvasRef}
        className="bp-grid graph-canvas relative flex-1 min-w-0 min-h-0 overflow-hidden outline-none"
        tabIndex={0}
        data-testid="node-graph-canvas"
        onKeyDown={onKeyDown}
        onPointerDown={onCanvasDown}
        onPointerMove={onMove}
        onPointerUp={finish}
        onDragOver={(event) => event.preventDefault()}
        onDrop={dropNode}
        onContextMenu={(event) => { if (event.target.dataset?.bg === "1") openMenu(event, {}); }}
      >
        <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2" data-graph-chrome onPointerDown={(event) => event.stopPropagation()}>
          <span className="eyebrow">Event graph · {Math.round(zoom * 100)}%</span>
          <button type="button" className={`ue-btn !py-1 !px-2 !text-[11px] ${snap ? "!border-[var(--unreal-orange)] !text-[var(--unreal-orange)]" : ""}`} data-testid="graph-snap" onClick={() => setSnap((value) => !value)}>Snap</button>
          <button type="button" className="ue-btn !py-1 !px-2 !text-[11px]" data-testid="graph-comment" onClick={commentAround}>Comment</button>
          <button type="button" className="ue-btn !py-1 !px-2 !text-[11px]" data-testid="graph-explain" onClick={runExplain}>Explain this graph</button>
          <button type="button" className="ue-btn !py-1 !px-2 !text-[11px]" data-testid="collapse-function" onClick={() => publish(collapseSelection(doc, activeMeta.id, selection.nodes, { kind: "function", name: "Collapsed" }))}>Collapse</button>
        </div>
        <div className="absolute left-3 top-11 z-30 flex flex-wrap items-center gap-1 max-w-[calc(100%-8rem)]" data-testid="graph-simbar" data-graph-chrome onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" className="ue-btn !py-1 !px-2 !text-[11px]" data-testid="graph-play" onClick={playSim}>Play</button>
          <button type="button" className="ue-btn !py-1 !px-2 !text-[11px]" data-testid="graph-step" onClick={stepSim}>Step</button>
          <button type="button" className="ue-btn !py-1 !px-2 !text-[11px]" data-testid="graph-run" onClick={() => setSim((current) => (current && current.status !== "done" ? { ...current, status: "running" } : null))}>Run</button>
          <button type="button" className="ue-btn !py-1 !px-2 !text-[11px]" data-testid="graph-pause" onClick={() => setSim((current) => (current && current.status === "running" ? { ...current, status: "paused" } : current))}>Pause</button>
          <button type="button" className="ue-btn !py-1 !px-2 !text-[11px]" data-testid="graph-stop" onClick={() => setSim(null)}>Stop</button>
          <button type="button" className={`ue-btn !py-1 !px-2 !text-[11px] ${notesOn ? "!border-[var(--unreal-orange)] !text-[var(--unreal-orange)]" : ""}`} data-testid="graph-notes" onClick={() => setNotesOn((value) => !value)}>Notes</button>
          <button type="button" className="ue-btn !py-1 !px-2 !text-[11px]" data-testid="graph-copy-blueprint" onClick={copyBlueprint}>Copy for Unreal</button>
          <button type="button" className="ue-btn !py-1 !px-2 !text-[11px]" data-testid="graph-paste-blueprint" onClick={() => setBlueprintPanel({ mode: "paste", warnings: [] })}>Paste from Unreal</button>
        </div>
        <div className="absolute left-3 top-[5.4rem] z-20 flex flex-wrap gap-1" data-graph-chrome onPointerDown={(event) => event.stopPropagation()}>
          {openTabs.map((id) => {
            const item = doc.items.find((entry) => entry.id === id) || (id === "event" ? doc.items.find((entry) => entry.kind === "event") : null);
            if (!item) return null;
            return <button key={item.id} type="button" className={`chip ${activeMeta?.id === item.id ? "active" : ""}`} data-testid={`graph-tab-${item.kind}`} onClick={() => setActiveId(item.id)}>{item.name}</button>;
          })}
        </div>
        <div className="absolute right-3 top-3 z-20 flex gap-2" data-graph-chrome onPointerDown={(event) => event.stopPropagation()}>
          <button type="button" className="ue-btn" aria-label="Zoom in" data-testid="graph-zoom-in" onClick={() => setZoom((value) => clampZoom(value + 0.1))}>+</button>
          <button type="button" className="ue-btn" aria-label="Zoom out" data-testid="graph-zoom-out" onClick={() => setZoom((value) => clampZoom(value - 0.1))}>−</button>
        </div>
        {sim && (
          <div className="graph-watch panel" data-testid="graph-watch" data-graph-chrome onPointerDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-2">
              <span className="eyebrow">Watch</span>
              <label className="text-[11px] flex items-center gap-1"><input type="checkbox" checked={sim.authority !== false} onChange={(event) => setSim({ ...sim, authority: event.target.checked })} /> Server</label>
            </div>
            <p className="graph-watch-note" data-testid="graph-watch-note">{sim.note}</p>
            {sim.branch && <p className="graph-watch-note" data-testid="graph-watch-branch">Branch {sim.branch.taken}: {sim.branch.why}</p>}
            {sim.role && <p className="node-role" data-testid="graph-watch-role">{sim.role}</p>}
            <ul className="graph-watch-list">
              {Object.entries(sim.variables || {}).map(([name, value]) => (
                <li key={name}><span>{name}</span><span>{formatValue(value)}</span></li>
              ))}
            </ul>
            {!!sim.log?.length && <p className="graph-watch-note">Log: {sim.log.join(" · ")}</p>}
            {!!sim.warnings?.length && <p className="graph-watch-note">{sim.warnings[sim.warnings.length - 1]}</p>}
          </div>
        )}
        {blueprintPanel && (
          <div className="graph-blueprint panel" data-testid="graph-blueprint" data-graph-chrome onPointerDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between"><span className="eyebrow">{blueprintPanel.mode === "paste" ? "Paste from Unreal" : "Copy for Unreal"}</span><button type="button" className="ue-btn !py-0.5 !px-1.5 !text-[10px]" onClick={() => setBlueprintPanel(null)}>Close</button></div>
            <textarea className="graph-blueprint-text" aria-label="Blueprint text" value={pasteText} onChange={(event) => setPasteText(event.target.value)} />
            {blueprintPanel.mode === "paste" && <button type="button" className="ue-btn !py-1 !px-2 !text-[11px] mt-1" data-testid="graph-paste-apply" onClick={pasteBlueprint}>Add nodes</button>}
            <ul className="graph-watch-list">{(blueprintPanel.warnings || []).map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        )}
        {system?.manual_cpp && (
          <div className="absolute left-3 top-36 z-20 panel p-2 flex items-center gap-2 max-w-xl" data-testid="graph-manual-lock" data-graph-chrome onPointerDown={(event) => event.stopPropagation()}>
            <span className="text-[12px] text-[var(--text-secondary)]">Manual edits are locked. The graph is saved, and the C++ was not overwritten.</span>
            <button type="button" className="ue-btn !py-1 !px-2 !text-[11px]" data-testid="graph-revert" onClick={onRevertManual}>Revert to generated</button>
          </div>
        )}
        <svg className="absolute inset-0 h-full w-full" data-bg="1">
          <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
            {graph.wires.map((wire) => {
              const fromNode = graph.nodes.find((node) => node.id === wire.from.node);
              const toNode = graph.nodes.find((node) => node.id === wire.to.node);
              const fromPin = fromNode?.pins.find((item) => item.id === wire.from.pin);
              const toPin = toNode?.pins.find((item) => item.id === wire.to.pin);
              if (!fromNode || !toNode || !fromPin || !toPin) return null;
              const a = anchorOf({ ...fromNode, ...displayPos(fromNode.id, fromNode) }, fromPin);
              const b = anchorOf({ ...toNode, ...displayPos(toNode.id, toNode) }, toPin);
              const color = pinColor(fromPin.type);
              return (
                <path
                  key={wire.id}
                  d={wirePath(a.x, a.y, b.x, b.y)}
                  className={sim?.wireId === wire.id ? "graph-wire is-pulse" : "graph-wire"}
                  stroke={sim?.wireId === wire.id ? "#f5c518" : (selection.wires.includes(wire.id) ? "var(--unreal-orange)" : color)}
                  strokeWidth={fromPin.type === "exec" ? 2.4 : 2}
                  fill="none"
                  data-testid={`graph-wire-${wire.id}`}
                  style={{ pointerEvents: "stroke", cursor: "pointer" }}
                  onPointerDown={(event) => {
                    if (!editable) return;
                    if (event.altKey) {
                      event.stopPropagation();
                      event.preventDefault();
                      commit(removeParts(graph, { wires: [wire.id] }));
                      return;
                    }
                    event.stopPropagation();
                    setSelection({ nodes: [], wires: [wire.id], comments: [] });
                  }}
                  onContextMenu={(event) => openMenu(event, { wireId: wire.id })}
                />
              );
            })}
            {preview && <path d={preview.d} stroke={preview.color} strokeWidth="2.4" fill="none" strokeDasharray={hint ? "4 3" : undefined} />}
            {drag?.mode === "box" && drag.moved && (
              <rect
                x={Math.min(drag.x, drag.cx)}
                y={Math.min(drag.y, drag.cy)}
                width={Math.abs(drag.cx - drag.x)}
                height={Math.abs(drag.cy - drag.y)}
                className="graph-box"
              />
            )}
          </g>
        </svg>
        <div className="absolute inset-0" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", pointerEvents: "none" }}>
          {graph.comments.map((comment) => {
            const pos = displayPos(comment.id, comment);
            const width = drag?.mode === "resize" && drag.id === comment.id ? Math.max(120, comment.w + (drag.dx || 0)) : comment.w;
            const height = drag?.mode === "resize" && drag.id === comment.id ? Math.max(72, comment.h + (drag.dy || 0)) : comment.h;
            return (
              <div
                key={comment.id}
                className={`graph-comment ${selection.comments.includes(comment.id) ? "is-selected" : ""}`}
                style={{ left: pos.x, top: pos.y, width, height, pointerEvents: "auto" }}
                data-comment-id={comment.id}
                data-testid={`graph-comment-${comment.id}`}
              >
                <div className="graph-comment-bar" onPointerDown={(event) => startMove(event, "comment", comment.id)} />
                <textarea
                  defaultValue={comment.text}
                  key={`${comment.id}-${comment.text}`}
                  aria-label="Comment"
                  onPointerDown={(event) => event.stopPropagation()}
                  onBlur={(event) => { if (event.target.value !== comment.text) commit(placeNodes(graph, { [comment.id]: { x: comment.x, y: comment.y, w: comment.w, h: comment.h, text: event.target.value } })); }}
                />
                {editable && <div className="graph-comment-resize" onPointerDown={(event) => { event.stopPropagation(); rememberDrag({ mode: "resize", id: comment.id, startX: event.clientX, startY: event.clientY, origins: { [comment.id]: comment }, moved: false }); }} />}
              </div>
            );
          })}
          {graph.nodes.map((node) => {
            const pos = displayPos(node.id, node);
            const inputs = node.pins.filter((item) => item.dir === "in");
            const outputs = node.pins.filter((item) => item.dir === "out");
            const rows = Math.max(inputs.length, outputs.length, 1);
            return (
              <div
                key={node.id}
                className={`node-card node-${node.kind} graph-node ${selection.nodes.includes(node.id) ? "is-selected" : ""} ${highlightIds.includes(node.id) ? "node-reveal" : ""} ${sim?.activeId === node.id ? "is-sim" : ""}`}
                style={{ left: pos.x, top: pos.y, width: NODE_W, pointerEvents: "auto" }}
                data-node-id={node.id}
                data-testid={`graph-node-${node.id}`}
                onPointerDown={(event) => startMove(event, "node", node.id)}
                onDoubleClick={() => onShowCpp?.(node.id)}
                onContextMenu={(event) => openMenu(event, { nodeId: node.id })}
              >
                <div className="node-header"><span className="truncate">{node.label}</span></div>
                {["server-rpc", "client-rpc", "multicast-rpc", "has-authority"].includes(node.catalog) && (
                  <div className="node-role" data-testid={`role-${node.id}`}>{node.catalog === "client-rpc" ? "runs on client" : node.catalog === "multicast-rpc" ? "runs on server and clients" : "runs on server"}</div>
                )}
                <div className="node-body">
                  {Array.from({ length: rows }, (_, index) => (
                    <div key={index} className="flex justify-between gap-2" style={{ height: GRAPH_LAYOUT.row, minHeight: GRAPH_LAYOUT.row }}>
                      {inputs[index] ? (
                        <div className={`node-pin ${outputs[index] ? "" : "flex-1"} ${(hotPin?.nodeId === node.id && hotPin?.pinId === inputs[index].id) || (armed?.nodeId === node.id && armed?.pinId === inputs[index].id) ? "is-hot" : ""}`} data-pin-node={node.id} data-pin-id={inputs[index].id} data-testid={`pin-${node.id}-${inputs[index].id}`}>
                          <span className="node-dot" style={{ background: pinColor(inputs[index].type) }} />
                          <span>{inputs[index].name}</span>
                        </div>
                      ) : <span />}
                      {outputs[index] ? (
                        <div className={`node-pin out ${inputs[index] ? "" : "flex-1"} ${(hotPin?.nodeId === node.id && hotPin?.pinId === outputs[index].id) || (armed?.nodeId === node.id && armed?.pinId === outputs[index].id) ? "is-hot" : ""}`} data-pin-node={node.id} data-pin-id={outputs[index].id} data-testid={`pin-${node.id}-${outputs[index].id}`}>
                          <span>{outputs[index].name}</span>
                          <span className="node-dot" style={{ background: pinColor(outputs[index].type) }} />
                        </div>
                      ) : <span />}
                    </div>
                  ))}
                </div>
                {notesOn && node.data?.note && <div className="node-note" data-testid={`note-${node.id}`}><GlossaryText text={node.data.note} /></div>}
                {(warningByNode[node.id] || []).map((item) => (
                  <div key={item.lock} className="node-warn" data-testid={`graph-warn-${node.id}`}>
                    <GlossaryText text={item.why} />
                  </div>
                ))}
                {whyByNode[node.id] && <div className="node-warn"><GlossaryText text={whyByNode[node.id].one_line} /></div>}
              </div>
            );
          })}
        </div>
        {!graph.nodes.length && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm font-mono pointer-events-none" data-testid="graph-empty">
            {editable ? "Drag an event from the palette." : "— generate a system to populate the event graph —"}
          </div>
        )}
        <svg className="graph-minimap" data-testid="graph-minimap" data-graph-chrome viewBox={`0 0 ${mapW} ${mapH}`} onPointerDown={(event) => event.stopPropagation()}>
          {graph.nodes.map((node) => (
            <rect key={node.id} x={(node.x - bounds.minX) * mapScale + 8} y={(node.y - bounds.minY) * mapScale + 8} width={Math.max(4, NODE_W * mapScale)} height={Math.max(3, nodeHeight(node) * mapScale)} fill={node.kind === "event" ? "#ef4444" : "#0099ff"} />
          ))}
        </svg>
        {selectedNode && (
          <div className="graph-inspector panel p-2" data-testid="graph-inspector" data-graph-chrome onPointerDown={(event) => event.stopPropagation()}>
            <div className="text-[12px] font-semibold">{selectedNode.label}</div>
            {selectedNode.whenToUse && <p className="mt-1 text-[11px] text-[var(--text-secondary)]" data-testid="node-when"><GlossaryText text={selectedNode.whenToUse} /></p>}
            {selectedNode.commonMistakes && <p className="mt-1 text-[11px] text-[var(--text-muted)]" data-testid="node-mistakes"><GlossaryText text={selectedNode.commonMistakes} /></p>}
            {selectedNode.catalog === "print-string" && (
              <input className="graph-search mt-1" aria-label="Print text" key={`${selectedNode.id}-${selectedNode.data?.text || ""}`} defaultValue={selectedNode.data?.text || ""} onBlur={(event) => { if (event.target.value !== (selectedNode.data?.text || "")) commit(setNodeData(graph, selectedNode.id, { text: event.target.value })); }} />
            )}
            {(selectedNode.catalog === "set-variable" || selectedNode.catalog === "get-variable") && (
              <select className="graph-search mt-1" aria-label="Variable" value={selectedNode.data?.variable || ""} onChange={(event) => {
                const found = symbols.variables.find((item) => item.name === event.target.value);
                commit(setNodeData(graph, selectedNode.id, { variable: event.target.value, varType: found?.type || "float" }));
              }}>
                {!symbols.variables.length && <option value={selectedNode.data?.variable || "Value"}>{selectedNode.data?.variable || "Value"}</option>}
                {symbols.variables.map((item) => <option key={item.name} value={item.name}>{item.label}</option>)}
              </select>
            )}
            {(selectedNode.catalog === "break-struct" || selectedNode.catalog === "make-struct") && (
              <select className="graph-search mt-1" aria-label="Struct type" data-testid="struct-type" value={selectedNode.data?.struct || "FVector"} onChange={(event) => {
                const choice = structChoices(doc, system?.cpp_header).find((item) => item.name === event.target.value);
                commit(setNodeData(graph, selectedNode.id, { struct: event.target.value, members: choice?.members || [] }));
              }}>
                {structChoices(doc, system?.cpp_header).map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
              </select>
            )}
            {selectedNode.catalog === "cast-to" && (
              <input className="graph-search mt-1" aria-label="Cast class" data-testid="cast-class" key={`${selectedNode.id}-${selectedNode.data?.className || ""}`} defaultValue={selectedNode.data?.className || "AActor"} onBlur={(event) => { if (event.target.value !== (selectedNode.data?.className || "")) commit(setNodeData(graph, selectedNode.id, { className: event.target.value || "AActor" })); }} />
            )}
            {selectedNode.catalog === "interface-call" && (
              <>
                <input className="graph-search mt-1" aria-label="Interface function" data-testid="interface-function" key={`${selectedNode.id}-fn-${selectedNode.data?.function || ""}`} defaultValue={selectedNode.data?.function || "Interact"} onBlur={(event) => { if (event.target.value !== (selectedNode.data?.function || "")) commit(setNodeData(graph, selectedNode.id, { function: event.target.value || "Interact" })); }} />
                <input className="graph-search mt-1" aria-label="Interface class" data-testid="interface-class" key={`${selectedNode.id}-if-${selectedNode.data?.interface || ""}`} defaultValue={selectedNode.data?.interface || ""} placeholder="UInterface class, optional" onBlur={(event) => { if (event.target.value !== (selectedNode.data?.interface || "")) commit(setNodeData(graph, selectedNode.id, { interface: event.target.value })); }} />
              </>
            )}
            {selectedNode.catalog === "call-function" && (
              <select className="graph-search mt-1" aria-label="Function" value={selectedNode.data?.function || ""} onChange={(event) => commit(setNodeData(graph, selectedNode.id, { function: event.target.value }))}>
                {!symbols.functions.length && <option value={selectedNode.data?.function || "Function"}>{selectedNode.data?.function || "Function"}</option>}
                {symbols.functions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            )}
            <div className="mt-1 text-[11px] font-mono text-[var(--text-muted)]">
              {system?.graph_lines?.[selectedNode.id] ? `${system.graph_lines[selectedNode.id].file}:${system.graph_lines[selectedNode.id].line}` : "No C++ line yet"}
            </div>
            {system?.graph_lines?.[selectedNode.id] && (
              <button type="button" className="ue-btn !py-1 !px-2 !text-[11px] mt-1" data-testid="graph-show-cpp" onClick={() => onShowCpp?.(selectedNode.id)}>Show in C++</button>
            )}
          </div>
        )}
        {explainOpen && (
          <div className="graph-explain panel p-3" data-testid="graph-explain-text" data-graph-chrome onPointerDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="eyebrow">What fires</div>
              <button type="button" className="ue-btn !py-0.5 !px-1.5 !text-[10px]" data-testid="graph-explain-close" onClick={() => setExplainOpen(false)}>Close</button>
            </div>
            {explainState === "loading" && <p className="text-[12px] text-[var(--text-muted)]" data-testid="graph-explain-loading">Asking for a walkthrough…</p>}
            {explainError && <p className="text-[12px] text-[var(--accent-red)] mb-1" data-testid="graph-explain-error">{explainError}</p>}
            <p className="text-[12.5px] text-[var(--text-secondary)]"><GlossaryText text={summary} /></p>
          </div>
        )}
        {varMenu?.id && (
          <div className="graph-menu panel" style={{ left: varMenu.x, top: varMenu.y }} data-testid="variable-drop-menu" data-graph-chrome>
            <button type="button" className="graph-menu-item" onClick={() => { const variable = doc.variables.find((item) => item.id === varMenu.id); if (variable) commit(addNode(graph, variableNode(variable, "get", varMenu.gx, varMenu.gy))); setVarMenu(null); }}>Get</button>
            <button type="button" className="graph-menu-item" onClick={() => { const variable = doc.variables.find((item) => item.id === varMenu.id); if (variable) commit(addNode(graph, variableNode(variable, "set", varMenu.gx, varMenu.gy))); setVarMenu(null); }}>Set</button>
          </div>
        )}
        {children}
      </div>
      {menu && (
        <div className="graph-menu panel" style={{ left: menu.x, top: menu.y }} data-testid="graph-menu" onPointerDown={(event) => event.stopPropagation()}>
          {menu.wireId && <button type="button" className="graph-menu-item" onClick={() => { commit(removeParts(graph, { wires: [menu.wireId] })); setMenu(null); }}>Remove wire</button>}
          {menu.nodeId && <button type="button" className="graph-menu-item" onClick={() => { onShowCpp?.(menu.nodeId); setMenu(null); }}>Show in C++</button>}
          {(menu.nodeId || menu.wireId) && <button type="button" className="graph-menu-item" onClick={() => { commit(removeParts(graph, { nodes: menu.nodeId ? [menu.nodeId] : [], wires: menu.wireId ? [menu.wireId] : [] })); setMenu(null); }}>Delete</button>}
        </div>
      )}
      {hint && createPortal(
        <div className="graph-hint" style={{ left: hint.x, top: hint.y, zIndex: 80 }} data-testid="graph-wire-hint">{hint.text}</div>,
        document.body,
      )}
    </div>
  );
}
