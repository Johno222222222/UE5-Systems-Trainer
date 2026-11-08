import React from "react";
import { GitCompareArrows, MessageSquareText } from "lucide-react";
import Modal from "./Modal";

export default function HistoryModal({ versions, current, onCompare, onClose }) {
  return (
    <Modal title="Version history" onClose={onClose} testId="history-modal" width={560}>
      <ul className="space-y-1.5" data-testid="history-list">
        {versions.map((v) => (
          <li key={v.version} className="panel p-2.5 flex gap-3 items-start" data-testid={`history-item-${v.version}`}>
            <div className="font-mono text-[12px] text-[var(--unreal-orange)] w-9 shrink-0">v{v.version}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-sub font-semibold flex items-center gap-1.5 flex-wrap">
                {v.label && <span className="chip active !py-0 !text-[10px] !cursor-default">★ {v.label}</span>}
                {v.version === current && <span className="chip !py-0 !text-[10px] !cursor-default">latest</span>}
                <span className="text-[var(--text-secondary)] font-normal font-mono text-[11px]">{v.saved_by_name} · {new Date(v.saved_at).toLocaleString()}</span>
              </div>
              {v.note
                ? <div className="mt-1 text-[12px] text-[var(--text-primary)] flex gap-1.5" data-testid={`history-note-${v.version}`}><MessageSquareText size={12} className="shrink-0 mt-0.5 text-[var(--text-muted)]" /> {v.note}</div>
                : <div className="mt-1 text-[11px] font-mono text-[var(--text-muted)]">No note</div>}
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
