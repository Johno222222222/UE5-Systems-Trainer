"use strict";

// Draws a lesson figure from a real event-graph document (template or lesson graph).
// Node positions, names, and wires come from that document.

const fs = require("fs");
const path = require("path");

const LABELS = {
  "begin-play": "Begin Play",
  "end-play": "End Play",
  tick: "Tick",
  "enhanced-input": "Enhanced Input",
  "line-trace": "Line Trace",
  branch: "Branch",
  "interface-call": "Interface",
  "print-string": "Print",
  "set-timer": "Set Timer",
  "set-timer-event": "Timer Event",
  "set-timer-function": "Timer Function",
  "custom-event": "Custom Event",
  "set-variable": "Set",
  "get-variable": "Get",
  "any-damage": "Any Damage",
  "has-authority": "Has Authority",
  "on-rep": "OnRep",
  literal: "Literal",
  add: "Add",
  subtract: "Subtract",
  multiply: "Multiply",
  divide: "Divide",
  clamp: "Clamp",
  equal: "Equal",
  greater: "Greater",
  less: "Less",
  and: "AND",
  timeline: "Timeline",
  flipflop: "FlipFlop",
  delay: "Delay",
  "cast-to": "Cast To",
  "dispatcher-bind": "Bind Dispatcher",
  "dispatcher-call": "Call Dispatcher",
  "make-struct": "Make Struct",
  "break-struct": "Break Struct",
  "call-function": "Call Function",
  "begin-overlap": "Begin Overlap",
  sequence: "Sequence",
  gate: "Gate",
  "do-once": "Do Once",
};

const ROOT = path.join(__dirname, "..", "content");

function esc(value) {
  return String(value || "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[ch]));
}

function loadGraph(id) {
  const candidates = [
    path.join(ROOT, "templates", `${id}.json`),
    path.join(ROOT, "lesson-graphs", `${id}.json`),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  }
  return null;
}

function nodeLabel(node) {
  if (node.label) return node.label;
  if (node.data?.action) return node.data.action;
  if (node.data?.variable) return `${LABELS[node.catalog] || node.catalog} ${node.data.variable}`;
  if (node.data?.function) return node.data.function;
  if (node.data?.name) return node.data.name;
  return LABELS[node.catalog] || node.key || node.catalog;
}

function wrapWords(text, maxChars) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitLines(text, maxChars, maxLines) {
  const lines = wrapWords(text, maxChars);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  const room = Math.max(8, maxChars - 1);
  kept[maxLines - 1] = `${last.length > room ? last.slice(0, last.lastIndexOf(" ") > 8 ? last.lastIndexOf(" ") : room) : last}…`;
  return kept;
}

function renderGraph(doc, { broken = false, why = "", blankKeys = [] } = {}) {
  const graph = doc?.graph || doc;
  const nodes = graph?.nodes || [];
  if (!nodes.length) return "";
  const pad = 28;
  const minX = Math.min(...nodes.map((node) => node.x || 0));
  const minY = Math.min(...nodes.map((node) => node.y || 0));
  const maxX = Math.max(...nodes.map((node) => (node.x || 0) + 168));
  const maxY = Math.max(...nodes.map((node) => (node.y || 0) + 72));
  const width = Math.max(640, maxX - minX + pad * 2);
  const whyLinesForHeight = why ? fitLines(String(why).replace(/\s+/g, " ").trim(), 78, 3) : [];
  const height = Math.max(220, maxY - minY + pad * 2 + (whyLinesForHeight.length ? 28 + whyLinesForHeight.length * 16 : 16) + (broken ? 56 : 0));
  const at = (node) => ({ x: (node.x || 0) - minX + pad, y: (node.y || 0) - minY + pad });
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const wires = (graph.wires || []).map((wire) => {
    const from = byKey.get(wire.from);
    const to = byKey.get(wire.to);
    if (!from || !to) return "";
    const a = at(from);
    const b = at(to);
    return `<path d="M ${a.x + 150} ${a.y + 28} C ${a.x + 190} ${a.y + 28}, ${b.x - 40} ${b.y + 28}, ${b.x} ${b.y + 28}" fill="none" stroke="#ff7a1a" stroke-width="2"/>`;
  }).join("");
  const blankSet = new Set(blankKeys || []);
  const boxes = nodes.map((node) => {
    const p = at(node);
    const full = nodeLabel(node);
    const blank = blankSet.has(node.key) || blankSet.has(node.id);
    const label = blank
      ? "Blank node"
      : (full.length <= 22 ? full : shortSpoke(full).replace(/…$/, "").slice(0, 22).replace(/\s+\S*$/, "") || full.slice(0, 22));
    const stroke = blank ? "#9aa4b2" : "#0099ff";
    const fill = blank ? "#0c1018" : "#121826";
    const dash = blank ? ` stroke-dasharray="6 4"` : "";
    return `<rect x="${p.x}" y="${p.y}" width="150" height="52" rx="6" fill="${fill}" stroke="${stroke}"${dash} data-node="${esc(node.key || node.id || "")}" data-blank="${blank ? "yes" : "no"}"/>
      <title>${esc(blank ? "Blank node" : full)}</title>
      <text x="${p.x + 75}" y="${p.y + 30}" fill="${blank ? "#9aa4b2" : "#e8eef8"}" font-size="11" text-anchor="middle" font-family="sans-serif">${esc(label)}</text>`;
  }).join("");
  const scenario = String(why || "").replace(/\s+/g, " ").trim();
  let extra = "";
  if (broken) {
    const first = nodes[0];
    const p = at(first);
    const label = esc(scenario.slice(0, 22) || "Broken write");
    extra += `<desc>${esc(scenario || "Broken write")}</desc>
      <rect x="${p.x}" y="${Math.max(8, p.y - 70)}" width="168" height="52" rx="6" fill="#2a1012" stroke="#e02424"/>
      <text x="${p.x + 84}" y="${Math.max(8, p.y - 70) + 30}" fill="#ffb4b4" font-size="10" text-anchor="middle" font-family="sans-serif">${label}</text>
      <path d="M ${p.x + 84} ${Math.max(8, p.y - 70) + 52} V ${p.y}" stroke="#e02424" stroke-width="3" stroke-dasharray="6 4"/>`;
  }
  const note = scenario || "";
  const whyLines = note ? fitLines(note, 78, 3) : [];
  const footH = whyLines.length ? 20 + whyLines.length * 16 : 0;
  const foot = whyLines.length
    ? `<rect x="16" y="${height - footH - 10}" width="${width - 32}" height="${footH}" rx="6" fill="#1a1208" stroke="#ff7a1a"/>
       <title>${esc(note)}</title>
       <text x="28" y="${height - footH + 8}" fill="#ffb06a" font-size="12" font-family="sans-serif">${whyLines.map((line, index) => `<tspan x="28" dy="${index === 0 ? 0 : 16}">${index === 0 ? "WHY " : ""}${esc(line)}</tspan>`).join("")}</text>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#0c1018"/>
  ${wires}${extra}${boxes}${foot}
</svg>`;
}

function shortSpoke(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  const sentence = clean.split(/(?<=[.!?])\s/)[0] || clean;
  if (sentence.length <= 72) return sentence;
  const cut = sentence.slice(0, 72);
  const space = cut.lastIndexOf(" ");
  return `${(space > 24 ? cut.slice(0, space) : cut).trim()}…`;
}

function hubSvg(title, spokes) {
  const items = (spokes || []).slice(0, 6).map((item) => String(item || ""));
  const left = items.filter((_, index) => index % 2 === 0);
  const right = items.filter((_, index) => index % 2 === 1);
  const boxH = 72;
  const box = (label, x, y) => {
    const lines = fitLines(label, 32, 3);
    return `<g><title>${esc(label)}</title><rect x="${x}" y="${y}" width="280" height="${boxH}" rx="8" fill="#121826" stroke="#3d4d66"/>
    <text x="${x + 14}" y="${y + 22}" fill="#9ecbff" font-size="13" font-family="sans-serif">${lines.map((line, index) => `<tspan x="${x + 14}" dy="${index === 0 ? 0 : 16}">${esc(line)}</tspan>`).join("")}</text></g>`;
  };
  const col = (list, x) => list.map((label, index) => box(label, x, 24 + index * (boxH + 12))).join("");
  const height = Math.max(220, 24 + Math.max(left.length, right.length) * (boxH + 12) + 24);
  const titleLines = fitLines(title, 24, 2);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 ${height}">
  <rect width="920" height="${height}" fill="#0c1018"/>
  ${col(left, 16)}${col(right, 624)}
  <rect x="320" y="${Math.max(40, height / 2 - 48)}" width="280" height="88" rx="10" fill="#101828" stroke="#0099ff"/>
  <text x="460" y="${Math.max(40, height / 2 - 48) + 36}" fill="#e8eef8" font-size="15" text-anchor="middle" font-family="sans-serif">${titleLines.map((line, index) => `<tspan x="460" dy="${index === 0 ? 0 : 16}">${esc(line)}</tspan>`).join("")}</text>
  <text x="460" y="${Math.max(40, height / 2 - 48) + 70}" fill="#ff7a1a" font-size="12" text-anchor="middle" font-family="sans-serif">depends on</text>
</svg>`;
}

function loadCppCache() {
  const file = path.join(ROOT, "lesson-cpp.json");
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function cppExcerpt(id) {
  const entry = loadCppCache()[id];
  if (!entry?.lines?.length) return [];
  return entry.lines;
}

module.exports = { loadGraph, renderGraph, hubSvg, cppExcerpt, nodeLabel, shortSpoke, fitLines };
