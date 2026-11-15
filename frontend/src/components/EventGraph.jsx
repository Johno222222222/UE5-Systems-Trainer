import React, { useEffect, useMemo, useRef, useState } from "react";
import GlossaryText from "./GlossaryText";
import {
  addComment, addNode, canConnect, catalogGroups, commitHistory, createHistory, createNode,
  duplicateParts, explainGraph, graphWarnings, pinColor, placeNodes, readEventGraph,
  redoHistory, removeParts, setNodeData, snapValue, systemSymbols, tryWire, undoHistory,
} from "../lib/graph.mjs";

const NODE_W = 210;
const HEADER = 28;
const PIN_H = 18;

function wirePath(x1, y1, x2, y2) {
  const dx = Math.max(48, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

function clampZoom(value) {
  return Math.min(1.6, Math.max(0.35, value));
}

function typingTarget(target) {
  const tag = target?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable;
}

function pinIndex(node, pin) {
  return node.pins.filter((item) => item.dir === pin.dir).findIndex((item) => item.id === pin.id);
}

function anchorOf(node, pin) {
  const index = Math.max(0, pinIndex(node, pin));
  const y = node.y + HEADER + 10 + index * PIN_H;
  return { x: pin.dir === "in" ? node.x : node.x + NODE_W, y };
}

function nodeHeight(node) {
  const rows = Math.max(
    node.pins.filter((item) => item.dir === "in").length,
    node.pins.filter((item) => item.dir === "out").length,
    1,
  );
  return HEADER + 12 + rows * PIN_H;
}

export default function EventGraph({
  system, editable = true, locks = [], whyByNode = {}, highlightIds = [], onChange, onShowCpp, onExplain, onRevertManual, children,
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
  const clip = useRef(null);
  const graph = history.present;
  const warnings = useMemo(() => graphWarnings(graph, locks), [graph, locks]);
  const warningByNode = useMemo(() => {
    const map = {};
    warnings.forEach((item) => { (map[item.nodeId] = map[item.nodeId] || []).push(item); });
    return map;
  }, [warnings]);
  const symbols = useMemo(() => systemSymbols(system), [system]);

  const incoming = JSON.stringify(readEventGraph(system));
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

  const commit = (next) => {
    setHistory((current) => commitHistory(current, next));
    onChange?.(next);
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

  const toGraph = (clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom };
  };
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
    if (event.target.closest?.("[data-pin-id]")) return;
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
    setDrag({
      mode: "move", kind, id, startX: event.clientX, startY: event.clientY, origins, moved: false,
      nodes: movingNodes, comments: movingComments,
    });
    try { canvasRef.current?.setPointerCapture?.(event.pointerId); } catch { /* already released */ }
  };

  const onCanvasDown = (event) => {
    setMenu(null);
    if (!typingTarget(event.target)) canvasRef.current?.focus();
    const pinEl = event.target.closest?.("[data-pin-id]");
    if (pinEl && editable && event.button === 0 && !event.altKey) {
      event.stopPropagation();
      try { canvasRef.current?.setPointerCapture?.(event.pointerId); } catch { /* already released */ }
      setDrag({ mode: "wire", nodeId: pinEl.dataset.pinNode, pinId: pinEl.dataset.pinId, x: event.clientX, y: event.clientY });
      return;
    }
    if (event.target.closest?.("[data-node-id]") || event.target.closest?.("[data-comment-id]") || event.target.closest?.("[data-pin-id]")) return;
    if (event.button === 1 || event.button === 2 || event.altKey) {
      setDrag({ mode: "pan", startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y });
      return;
    }
    if (event.button !== 0) return;
    try { canvasRef.current?.setPointerCapture?.(event.pointerId); } catch { /* already released */ }
    const point = toGraph(event.clientX, event.clientY);
    setDrag({ mode: "box", startX: event.clientX, startY: event.clientY, x: point.x, y: point.y, cx: point.x, cy: point.y, moved: false, shift: event.shiftKey });
  };

  const onMove = (event) => {
    if (!drag) return;
    if (drag.mode === "pan") {
      setPan({ x: drag.panX + (event.clientX - drag.startX), y: drag.panY + (event.clientY - drag.startY) });
      return;
    }
    if (drag.mode === "wire") {
      setDrag({ ...drag, x: event.clientX, y: event.clientY });
      const pinEl = event.target.closest?.("[data-pin-id]");
      if (!pinEl || (pinEl.dataset.pinNode === drag.nodeId && pinEl.dataset.pinId === drag.pinId)) { setHint(null); return; }
      const check = canConnect(graph, drag.nodeId, drag.pinId, pinEl.dataset.pinNode, pinEl.dataset.pinId);
      setHint(check.ok ? null : { x: event.clientX + 12, y: event.clientY + 12, text: check.reason });
      return;
    }
    if (drag.mode === "box") {
      const point = toGraph(event.clientX, event.clientY);
      const moved = Math.abs(event.clientX - drag.startX) > 4 || Math.abs(event.clientY - drag.startY) > 4;
      setDrag({ ...drag, cx: point.x, cy: point.y, moved });
      return;
    }
    if (drag.mode === "move" || drag.mode === "resize") {
      const dx = (event.clientX - drag.startX) / zoom;
      const dy = (event.clientY - drag.startY) / zoom;
      const moved = drag.moved || Math.abs(dx) > 2 || Math.abs(dy) > 2;
      setDrag({ ...drag, dx, dy, moved });
    }
  };

  const finish = (event) => {
    if (!drag) return;
    if (drag.mode === "wire") {
      const pinEl = event.target.closest?.("[data-pin-id]");
      if (editable && pinEl) {
        const result = tryWire(graph, drag.nodeId, drag.pinId, pinEl.dataset.pinNode, pinEl.dataset.pinId);
        if (result.ok) { commit(result.graph); setHint(null); }
        else setHint({ x: event.clientX + 12, y: event.clientY + 12, text: result.reason });
      } else setHint(null);
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
    setDrag((current) => (current?.mode === "wire" ? null : null));
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
    if (!raw.startsWith("node:")) return;
    const point = toGraph(event.clientX, event.clientY);
    const node = createNode(raw.slice(5), grid(point.x), grid(point.y));
    commit(addNode(graph, node));
    setSelection({ nodes: [node.id], wires: [], comments: [] });
  };

  const commentAround = () => {
    if (selection.nodes.length) {
      const picked = graph.nodes.filter((node) => selection.nodes.includes(node.id));
      const x = Math.min(...picked.map((node) => node.x)) - 28;
      const y = Math.min(...picked.map((node) => node.y)) - 36;
      const w = Math.max(...picked.map((node) => node.x)) + NODE_W + 28 - x;
      const h = Math.max(...picked.map((node) => node.y + nodeHeight(node))) + 28 - y;
      commit(addComment(graph, { x, y, w, h, text: "Comment" }));
      return;
    }
    const rect = canvasRef.current?.getBoundingClientRect();
    const point = rect ? toGraph(rect.left + rect.width / 2, rect.top + 160) : { x: 80, y: 80 };
    commit(addComment(graph, { x: grid(point.x), y: grid(point.y), text: "Comment" }));
  };

  const runExplain = async () => {
    const fallback = explainGraph(graph);
    setSummary(fallback);
    setExplainOpen(true);
    if (!onExplain) return;
    const next = await onExplain(graph, fallback);
    if (next) setSummary(next);
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
    <div className="flex h-full min-h-0" data-testid="event-graph">
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
        className="bp-grid relative flex-1 min-w-0 outline-none"
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
        <div className="absolute left-3 top-3 z-20 flex flex-wrap items-center gap-2">
          <span className="eyebrow">Event graph · {Math.round(zoom * 100)}%</span>
          <button type="button" className={`ue-btn !py-1 !px-2 !text-[11px] ${snap ? "!border-[var(--unreal-orange)] !text-[var(--unreal-orange)]" : ""}`} data-testid="graph-snap" onClick={() => setSnap((value) => !value)}>Snap</button>
          <button type="button" className="ue-btn !py-1 !px-2 !text-[11px]" data-testid="graph-comment" onClick={commentAround}>Comment</button>
          <button type="button" className="ue-btn !py-1 !px-2 !text-[11px]" data-testid="graph-explain" onClick={runExplain}>Explain this graph</button>
        </div>
        <div className="absolute right-3 top-3 z-20 flex gap-2">
          <button type="button" className="ue-btn" aria-label="Zoom in" data-testid="graph-zoom-in" onClick={() => setZoom((value) => clampZoom(value + 0.1))}>+</button>
          <button type="button" className="ue-btn" aria-label="Zoom out" data-testid="graph-zoom-out" onClick={() => setZoom((value) => clampZoom(value - 0.1))}>−</button>
        </div>
        {system?.manual_cpp && (
          <div className="absolute left-3 top-12 z-20 panel p-2 flex items-center gap-2 max-w-xl" data-testid="graph-manual-lock">
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
                  stroke={selection.wires.includes(wire.id) ? "var(--unreal-orange)" : color}
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
                {editable && <div className="graph-comment-resize" onPointerDown={(event) => { event.stopPropagation(); setDrag({ mode: "resize", id: comment.id, startX: event.clientX, startY: event.clientY, origins: { [comment.id]: comment }, moved: false }); }} />}
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
                className={`node-card node-${node.kind} graph-node ${selection.nodes.includes(node.id) ? "is-selected" : ""} ${highlightIds.includes(node.id) ? "node-reveal" : ""}`}
                style={{ left: pos.x, top: pos.y, width: NODE_W, pointerEvents: "auto" }}
                data-node-id={node.id}
                data-testid={`graph-node-${node.id}`}
                onPointerDown={(event) => startMove(event, "node", node.id)}
                onDoubleClick={() => onShowCpp?.(node.id)}
                onContextMenu={(event) => openMenu(event, { nodeId: node.id })}
              >
                <div className="node-header"><span className="truncate">{node.label}</span></div>
                <div className="node-body">
                  {Array.from({ length: rows }, (_, index) => (
                    <div key={index} className="flex justify-between gap-2" style={{ minHeight: PIN_H }}>
                      {inputs[index] ? (
                        <div className="node-pin" data-pin-node={node.id} data-pin-id={inputs[index].id} data-testid={`pin-${node.id}-${inputs[index].id}`}>
                          <span className="node-dot" style={{ background: pinColor(inputs[index].type) }} />
                          <span>{inputs[index].name}</span>
                        </div>
                      ) : <span />}
                      {outputs[index] ? (
                        <div className="node-pin out" data-pin-node={node.id} data-pin-id={outputs[index].id} data-testid={`pin-${node.id}-${outputs[index].id}`}>
                          <span>{outputs[index].name}</span>
                          <span className="node-dot" style={{ background: pinColor(outputs[index].type) }} />
                        </div>
                      ) : <span />}
                    </div>
                  ))}
                </div>
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
        <svg className="graph-minimap" data-testid="graph-minimap" viewBox={`0 0 ${mapW} ${mapH}`} onPointerDown={(event) => event.stopPropagation()}>
          {graph.nodes.map((node) => (
            <rect key={node.id} x={(node.x - bounds.minX) * mapScale + 8} y={(node.y - bounds.minY) * mapScale + 8} width={Math.max(4, NODE_W * mapScale)} height={Math.max(3, nodeHeight(node) * mapScale)} fill={node.kind === "event" ? "#ef4444" : "#0099ff"} />
          ))}
        </svg>
        {selectedNode && (
          <div className="graph-inspector panel p-2" data-testid="graph-inspector" onPointerDown={(event) => event.stopPropagation()}>
            <div className="text-[12px] font-semibold">{selectedNode.label}</div>
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
        {explainOpen && summary && (
          <div className="graph-explain panel p-3" data-testid="graph-explain-text" onPointerDown={(event) => event.stopPropagation()}>
            <div className="eyebrow mb-1">What fires</div>
            <p className="text-[12.5px] text-[var(--text-secondary)]"><GlossaryText text={summary} /></p>
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
      {hint && <div className="graph-hint" style={{ left: hint.x, top: hint.y }} data-testid="graph-wire-hint">{hint.text}</div>}
    </div>
  );
}
