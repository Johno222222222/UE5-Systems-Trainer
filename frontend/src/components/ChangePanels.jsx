import React from "react";
import { CheckCircle2, GitCommitHorizontal, Link2 } from "lucide-react";

const KIND_COLOR = {
  prompt: "var(--accent-cyan)",
  dial: "var(--unreal-orange)",
  param: "var(--cpp-green)",
  module: "var(--accent-purple)",
  note: "#e8c547",
};

export function PendingChanges({ changes }) {
  if (!changes.length) return null;
  return (
    <div className="p-4 border-b border-[var(--border-soft)] bg-[rgba(255,107,0,0.04)]" data-testid="pending-changes-panel">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <GitCommitHorizontal size={14} className="text-[var(--unreal-orange)]" />
          <span className="eyebrow !text-[var(--unreal-orange)]">Queued for next synthesis</span>
        </div>
        <span className="font-mono text-[10px] text-[var(--unreal-orange)]" data-testid="pending-changes-count">{changes.length}</span>
      </div>
      <ul className="space-y-1">
        {changes.map((c, i) => (
          <li key={i} className="flex gap-2 text-[11.5px] font-mono text-[var(--text-secondary)] leading-snug" data-testid={`pending-change-${i}`}>
            <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: KIND_COLOR[c.kind] }} />
            <span>{c.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AppliedChanges({ result }) {
  const applied = result?.applied_changes || [];
  const shared = result?.shared_attributes || [];
  if (!applied.length && !shared.length) return null;
  return (
    <div className="p-4 border-b border-[var(--border-soft)]" data-testid="applied-changes-panel">
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 size={14} className="text-[var(--cpp-green)]" />
        <span className="eyebrow !text-[var(--cpp-green)]">Applied in this synthesis</span>
      </div>
      <ul className="space-y-1.5">
        {applied.map((c, i) => (
          <li key={i} className="flex gap-2 text-[11.5px] font-mono text-[var(--text-secondary)] leading-snug" data-testid={`applied-change-${i}`}>
            <CheckCircle2 size={11} className="mt-[3px] shrink-0 text-[var(--cpp-green)]" />
            <span>{c}</span>
          </li>
        ))}
      </ul>
      {shared.length > 0 && (
        <div className="mt-3" data-testid="shared-attributes">
          <div className="eyebrow mb-1.5 flex items-center gap-1.5"><Link2 size={11} /> Shared attributes</div>
          <div className="flex flex-wrap gap-1.5">
            {shared.map((s) => <span key={s} className="chip active">{s}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}
