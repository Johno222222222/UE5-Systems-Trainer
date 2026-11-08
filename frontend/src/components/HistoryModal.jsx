import React from "react";
import { GitCompareArrows, MessageSquareText, Wand2 } from "lucide-react";
import Modal from "./Modal";

function FixRows({ fixes, pending, onView, testId }) {
  if (!fixes?.length) return null;
  return (
    <div className="mt-1.5 space-y-1" data-testid={testId}>
      {fixes.map((f) => (
        <button key={f.fix_id} className="issue-row w-full text-left flex items-center gap-1.5 rounded px-1.5 py-0.5 -mx-1.5 text-[11px] font-mono text-[var(--text-secondary)]"
          onClick={() => onView(f, pending)} data-testid={`history-fix-${f.fix_id}`}>
          <Wand2 size={11} className="shrink-0 text-[var(--cpp-green)]" />
          <span className="truncate flex-1">{f.changes.map((c) => c.why).filter(Boolean).join("; ") || `${f.changes.length} change(s)`}</span>
          <span className="text-[var(--text-muted)] shrink-0">View →</span>
        </button>
      ))}
    </div>
  );
}

export default function HistoryModal({ versions, current, pending = [], onCompare, onViewFix, onClose }) {
  return (
    <Modal title="Version history" onClose={onClose} testId="history-modal" width={600}>
      {pending.length > 0 && (
        <div className="panel p-2.5 mb-2 border-dashed" data-testid="history-pending">
          <div className="eyebrow">Not saved yet · {pending.length} fix{pending.length === 1 ? "" : "es"}</div>
          <FixRows fixes={pending} pending onView={onViewFix} testId="history-pending-fixes" />
        </div>
      )}
      <ul className="space-y-1.5" data-testid="history-list">
        {versions.map((v) => (
          <li key={v.version} className="panel p-2.5 flex gap-3 items-start" data-testid={`history-item-${v.version}`}>
            <div className="font-mono text-[12px] text-[var(--unreal-orange)] w-9 shrink-0">v{v.version}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-sub font-semibold flex items-center gap-1.5 flex-wrap">
                {v.label && <span className="chip active !py-0 !text-[10px] !cursor-default">★ {v.label}</span>}
                {v.version === current && <span className="chip !py-0 !text-[10px] !cursor-default">latest</span>}
                {v.fixes?.length > 0 && <span className="chip !py-0 !text-[10px] !cursor-default !text-[var(--cpp-green)]">{v.fixes.length} fix{v.fixes.length === 1 ? "" : "es"}</span>}
                <span className="text-[var(--text-secondary)] font-normal font-mono text-[11px]">{v.saved_by_name} · {new Date(v.saved_at).toLocaleString()}</span>
              </div>
              {v.note
                ? <div className="mt-1 text-[12px] text-[var(--text-primary)] flex gap-1.5" data-testid={`history-note-${v.version}`}><MessageSquareText size={12} className="shrink-0 mt-0.5 text-[var(--text-muted)]" /> {v.note}</div>
                : <div className="mt-1 text-[11px] font-mono text-[var(--text-muted)]">No note</div>}
              <FixRows fixes={v.fixes} pending={false} onView={onViewFix} testId={`history-fixes-${v.version}`} />
            </div>
            {v.version !== current && (
              <button className="ue-btn !py-1 !px-2 !text-[11px] shrink-0" onClick={() => onCompare(v.version)} data-testid={`history-compare-${v.version}`}>
                <GitCompareArrows size={12} /> Compare
              </button>
            )}
          </li>
        ))}
        {versions.length === 0 && <li className="text-[12px] font-mono text-[var(--text-muted)]">No saved versions yet.</li>}
      </ul>
    </Modal>
  );
}
