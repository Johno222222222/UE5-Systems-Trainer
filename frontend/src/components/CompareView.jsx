import React, { useMemo, useState } from "react";
import { ArrowRight, GitCompareArrows } from "lucide-react";
import { computeChanges, sideBySideDiff } from "../lib/changes";

const VIEWS = [
  ["blueprint", "Pseudocode"],
  ["header", "C++ .h"],
  ["source", "C++ .cpp"],
  ["setup", "Setup Guide"],
  ["params", "Parameters & Modules"],
];

const textFor = (sys, view) => {
  if (!sys) return "";
  if (view === "blueprint") return sys.blueprint_pseudocode || "";
  if (view === "header") return sys.cpp_header || "";
  if (view === "source") return sys.cpp_source || "";
  if (view === "setup") return (sys.setup_guide || []).map((s) => `${s.step}. ${s.title}\n   ${s.detail}${s.why ? `\n   WHY: ${s.why}` : ""}`).join("\n");
  return [
    "# Parameters",
    ...(sys.tunable_parameters || []).map((p) => `${p.label || p.key} = ${p.value}${p.unit ? ` ${p.unit}` : ""}`),
    "",
    "# Modules",
    ...(sys.modules || []).map((m) => `${m.included ? "[x]" : "[ ]"} ${m.name}`),
  ].join("\n");
};

// What changed in the inputs between the two syntheses
function inputDiff(before, after) {
  const c = after.context || {};
  return computeChanges(before, {
    prompt: c.prompt ?? "", blueprint_class: c.blueprint_class, network_replicated: c.network_replicated,
    complexity: c.complexity, modularity: c.modularity, performance_vs_flexibility: c.performance_vs_flexibility,
    tick_rate: c.tick_rate, params: {}, extra: c.extra_modules || [], notes: "",
  }).filter((x) => x.kind !== "module");
}


export default function CompareView({ before, after, picker = null }) {
  const [view, setView] = useState("blueprint");
  const rows = useMemo(() => sideBySideDiff(textFor(before, view), textFor(after, view)), [before, after, view]);
  const changed = rows.filter((r) => r.type !== "same").length;

  if (!before || !after) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-500 font-mono text-sm" data-testid="compare-empty">
        <GitCompareArrows size={22} className="text-[var(--text-muted)]" />
        {picker ? "Pick a saved version to compare against, or regenerate to compare with the previous synthesis." : "Synthesize twice (e.g. change a dial and regenerate) to compare before and after."}
        {picker}
      </div>
    );
  }
  const inputs = inputDiff(before, after);

  return (
    <div className="h-full flex flex-col min-h-0" data-testid="compare-view">
      <div className="px-5 py-3 border-b border-[var(--border-soft)] flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-[12px] font-sub min-w-0">
          <span className="chip danger !cursor-default" data-testid="compare-before-name">Before · {before.version_label || before.system_name}</span>
          <ArrowRight size={13} className="text-[var(--text-muted)]" />
          <span className="chip active !cursor-default" data-testid="compare-after-name">After · {after.system_name}</span>
        </div>
        {picker}
        <div className="flex-1" />
        <div className="flex flex-wrap gap-1">
          {VIEWS.map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} aria-pressed={view === id} data-testid={`compare-view-${id}`}
              className={`ue-btn !py-1 !px-2 !text-[11px] ${view === id ? "!border-[var(--unreal-orange)] !text-[var(--unreal-orange)]" : ""}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {inputs.length > 0 && (
        <div className="px-5 py-2 border-b border-[var(--border-soft)] flex flex-wrap gap-1.5 items-center" data-testid="compare-input-changes">
          <span className="eyebrow mr-1">Input changes</span>
          {inputs.map((c, i) => <span key={i} className="chip !cursor-default max-w-[420px] truncate" title={c.text}>{c.text}</span>)}
        </div>
      )}
      <div className="px-5 py-1.5 text-[10.5px] font-mono uppercase tracking-widest text-[var(--text-muted)]" data-testid="compare-changed-count">
        {changed} changed line{changed === 1 ? "" : "s"}
      </div>
      <div className="flex-1 min-h-0 overflow-auto px-5 pb-5">
        <div className="code-box !overflow-visible grid grid-cols-2 font-mono text-[12px] leading-[1.6]">
          {rows.map((r, i) => (
            <React.Fragment key={i}>
              <div className={`px-3 whitespace-pre-wrap break-words border-r border-[var(--border-soft)] ${r.type === "del" || r.type === "change" ? "diff-del" : ""}`}>{r.left ?? ""}</div>
              <div className={`px-3 whitespace-pre-wrap break-words ${r.type === "add" || r.type === "change" ? "diff-add" : ""}`}>{r.right ?? ""}</div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
