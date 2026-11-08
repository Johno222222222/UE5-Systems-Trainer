import React, { useMemo, useRef, useState } from "react";

// Renders a bezier wire between two anchor points
function wirePath(x1, y1, x2, y2) {
  const dx = Math.max(60, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export default function NodeGraph({ nodes = [], edges = [] }) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.85);
  const [dragging, setDragging] = useState(null);
  const [positions, setPositions] = useState({});
  const svgRef = useRef(null);

  const pos = useMemo(() => {
    const p = {};
    nodes.forEach((n) => {
      p[n.id] = positions[n.id] ?? { x: n.x ?? 100, y: n.y ?? 100 };
    });
    return p;
  }, [nodes, positions]);

  const onBgDown = (e) => {
    if (e.target === svgRef.current || e.target.dataset?.bg === "1") {
      setDragging({ type: "pan", startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y });
    }
  };
  const onNodeDown = (e, id) => {
    e.stopPropagation();
    setDragging({ type: "node", id, startX: e.clientX, startY: e.clientY, nx: pos[id].x, ny: pos[id].y });
  };
  const onMove = (e) => {
    if (!dragging) return;
    if (dragging.type === "pan") {
      setPan({ x: dragging.panX + (e.clientX - dragging.startX), y: dragging.panY + (e.clientY - dragging.startY) });
    } else if (dragging.type === "node") {
      const nx = dragging.nx + (e.clientX - dragging.startX) / zoom;
      const ny = dragging.ny + (e.clientY - dragging.startY) / zoom;
      setPositions((prev) => ({ ...prev, [dragging.id]: { x: nx, y: ny } }));
    }
  };
  const onUp = () => setDragging(null);

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
      className="bp-grid relative h-full w-full overflow-hidden"
      data-testid="node-graph-canvas"
      onMouseDown={onBgDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onUp}
    >
      {/* zoom controls */}
      <div className="absolute right-4 top-4 z-20 flex gap-2">
        <button className="ue-btn" onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))} data-testid="graph-zoom-in">+</button>
        <button className="ue-btn" onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))} data-testid="graph-zoom-out">−</button>
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
              className={`node-card ${nodeTypeClass(n.node_type)}`}
              style={{ left: p.x, top: p.y, width: nodeWidth, pointerEvents: "auto" }}
              onMouseDown={(e) => onNodeDown(e, n.id)}
              data-testid={`graph-node-${n.id}`}
            >
              <div className="node-header">{n.label}</div>
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
          — generate a system to populate the event graph —
        </div>
      )}
    </div>
  );
}
