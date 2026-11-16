import React, { useEffect, useMemo, useRef, useState } from "react";
import { useShell } from "../shell/ShellContext";

// Renders a bezier wire between two anchor points
function wirePath(x1, y1, x2, y2) {
  const dx = Math.max(60, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export default function NodeGraph({ nodes = [], edges = [], whyByNode = {}, onNodeClick, highlightIds = [] }) {
  const shell = useShell();
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.85);
  const [dragging, setDragging] = useState(null);
  const [openWhy, setOpenWhy] = useState(null);
  const [positions, setPositions] = useState({});
  const svgRef = useRef(null);
  const moved = useRef(false);

  const pos = useMemo(() => {
    const p = {};
    nodes.forEach((n) => {
      p[n.id] = positions[n.id] ?? { x: n.x ?? 100, y: n.y ?? 100 };
    });
    return p;
  }, [nodes, positions]);

  const wrapRef = useRef(null);
  const fit = () => {
    const pts = Object.values(pos);
    const el = wrapRef.current;
    if (!pts.length || !el) return;
    const minX = Math.min(...pts.map((p) => p.x)), minY = Math.min(...pts.map((p) => p.y));
    const maxX = Math.max(...pts.map((p) => p.x)) + 190, maxY = Math.max(...pts.map((p) => p.y)) + 120;
    const z = Math.min(1.2, Math.max(0.3, Math.min(el.clientWidth / (maxX - minX + 80), (el.clientHeight - 60) / (maxY - minY + 80))));
    setZoom(z);
    setPan({ x: 40 - minX * z, y: 60 - minY * z });
  };
  useEffect(() => {
    let frame = 0;
    let tries = 0;
    const run = () => {
      const el = wrapRef.current;
      if ((!el || el.clientWidth < 40) && tries < 12) {
        tries += 1;
        frame = requestAnimationFrame(run);
        return;
      }
      fit();
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const onBgDown = (e) => {
    if (e.target === svgRef.current || e.target.dataset?.bg === "1") {
      setDragging({ type: "pan", startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y });
    }
  };
  const onNodeDown = (e, id) => {
    e.stopPropagation();
    moved.current = false;
    setDragging({ type: "node", id, startX: e.clientX, startY: e.clientY, nx: pos[id].x, ny: pos[id].y });
  };
  const onMove = (e) => {
    if (!dragging) return;
    if (dragging.type === "pan") {
      setPan({ x: dragging.panX + (e.clientX - dragging.startX), y: dragging.panY + (e.clientY - dragging.startY) });
    } else if (dragging.type === "node") {
      const dx = e.clientX - dragging.startX;
      const dy = e.clientY - dragging.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
      const nx = dragging.nx + dx / zoom;
      const ny = dragging.ny + dy / zoom;
      setPositions((prev) => ({ ...prev, [dragging.id]: { x: nx, y: ny } }));
    }
  };
  const onUp = (e) => {
    if (dragging?.type === "node" && e) {
      const dx = Math.abs(e.clientX - dragging.startX);
      const dy = Math.abs(e.clientY - dragging.startY);
      if (dx < 5 && dy < 5) onNodeClick?.(dragging.id);
    }
    setDragging(null);
  };

  const nodeTypeClass = (t) => {
    switch (t) {
      case "event": return "node-event";
      case "function": return "node-function";
      case "variable": return "node-variable";
      case "pure": return "node-pure";
      default: return "node-flow";
    }
  };

  const nodeWidth = 190;
  const headerH = 28;

  // Anchor points: exec out = right-top, exec in = left-top
  const anchor = (id, side) => {
    const p = pos[id];
    if (!p) return { x: 0, y: 0 };
    return { x: side === "out" ? p.x + nodeWidth : p.x, y: p.y + headerH / 2 + 2 };
  };

  return (
    <div
      ref={wrapRef}
      className="bp-grid relative h-full w-full overflow-hidden"
      data-testid="node-graph-canvas"
      onPointerDown={onBgDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onWheel={(e) => setZoom((z) => Math.min(1.6, Math.max(0.3, z - e.deltaY * 0.001)))}
      style={{ touchAction: "none" }}
    >
      {/* zoom controls */}
      <div className="absolute right-4 top-4 z-20 flex gap-2">
        <button className="ue-btn" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))} aria-label="Zoom in" data-testid="graph-zoom-in">+</button>
        <button className="ue-btn" onClick={() => setZoom((z) => Math.max(0.3, z - 0.1))} aria-label="Zoom out" data-testid="graph-zoom-out">−</button>
        <button className="ue-btn" onClick={fit} aria-label="Fit graph to view" data-testid="graph-fit">Fit</button>
        <button className="ue-btn" onClick={() => { setPan({x:0,y:0}); setZoom(0.85); setPositions({}); }} data-testid="graph-reset">Reset</button>
      </div>
      <div className="absolute left-4 top-4 z-20 eyebrow">EVENT GRAPH · {Math.round(zoom*100)}%</div>

      <svg
        ref={svgRef}
        data-bg="1"
        className="absolute inset-0 h-full w-full"
        style={{ cursor: dragging?.type === "pan" ? "grabbing" : "grab" }}
      >
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {edges.map((e, i) => {
            const a = anchor(e.from_node, "out");
            const b = anchor(e.to_node, "in");
            return (
              <path
                key={i}
                d={wirePath(a.x, a.y, b.x, b.y)}
                className={e.kind === "data" ? "wire-data" : "wire-exec"}
              />
            );
          })}
        </g>
      </svg>

      <div
        className="absolute inset-0"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", pointerEvents: "none" }}
      >
        {nodes.map((n) => {
          const p = pos[n.id];
          return (
            <div
              key={n.id}
              className={`node-card ${nodeTypeClass(n.node_type)} ${highlightIds.includes(n.id) ? "node-reveal" : ""}`}
              style={{ left: p.x, top: p.y, width: nodeWidth, pointerEvents: "auto" }}
              onPointerDown={(e) => onNodeDown(e, n.id)}
              data-testid={`graph-node-${n.id}`}
              onClick={() => { if (!moved.current) onNodeClick?.(n.id); }}
            >
              <div className="node-header flex items-center justify-between gap-2">
                <span className="truncate">{n.label}</span>
                {whyByNode[n.id] && (
                  <button
                    type="button"
                    className="why-badge"
                    data-testid={`why-badge-${n.id}`}
                    title={whyByNode[n.id].one_line}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setOpenWhy((current) => (current === n.id ? null : n.id));
                    }}
                  >
                    WHY
                  </button>
                )}
              </div>
              {openWhy === n.id && whyByNode[n.id] && (
                <div className="why-pop" data-testid={`why-pop-${n.id}`} onPointerDown={(event) => event.stopPropagation()}>
                  <div>{whyByNode[n.id].one_line}</div>
                  {whyByNode[n.id].concept_id && (
                    <button
                      type="button"
                      className="why-concept"
                      data-testid={`why-graph-concept-${whyByNode[n.id].id || n.id}`}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation();
                        shell.openConcept(whyByNode[n.id].concept_id);
                      }}
                    >
                      {whyByNode[n.id].concept_title || "Related concept"}
                    </button>
                  )}
                </div>
              )}
              <div className="node-body">
                <div className="flex justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    {(n.inputs || []).map((p, i) => (
                      <div key={i} className="node-pin">
                        <span className="node-dot" style={{ background: p === "exec" ? "#fff" : "#0099ff" }} />
                        <span>{p}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1">
                    {(n.outputs || []).map((p, i) => (
                      <div key={i} className="node-pin out">
                        <span>{p}</span>
                        <span className="node-dot" style={{ background: p === "exec" ? "#ff6b00" : "#00e676" }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm font-mono" data-testid="graph-empty">
          Nothing here yet. Generate a system, or stack saved projects from the list.
        </div>
      )}
    </div>
  );
}
