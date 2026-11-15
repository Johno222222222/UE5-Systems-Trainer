import React, { useMemo } from "react";
import { Check, Loader2, RefreshCw, RotateCcw, Undo2, Wand2, X } from "lucide-react";
import Modal from "./Modal";
import { sideBySideDiff } from "../lib/changes";

export function FileDiff({ label, before, after, testId }) {
  // Show only changed lines with 2 lines of context to keep the review short
  const rows = useMemo(() => {
    if (before === after) return [];
    const all = sideBySideDiff(before, after);
    const keep = new Set();
    all.forEach((r, i) => { if (r.type !== "same") for (let k = i - 2; k <= i + 2; k += 1) keep.add(k); });
    const out = [];
    all.forEach((r, i) => {
      if (keep.has(i)) out.push(r);
      else if (keep.has(i - 1)) out.push({ gap: true });
    });
    return out;
  }, [before, after]);
  if (before === after) return null;
  return (
    <div className="mb-4" data-testid={testId}>
      <div className="eyebrow mb-1.5">{label}</div>
      <div className="code-box !overflow-auto max-h-[300px] grid grid-cols-2 font-mono text-[11.5px] leading-[1.6]">
        <div className="px-3 py-1 border-b border-r border-[var(--border-soft)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Before</div>
        <div className="px-3 py-1 border-b border-[var(--border-soft)] text-[10px] uppercase tracking-widest text-[var(--text-muted)]">After</div>
        {rows.map((r, i) => r.gap ? (
          <React.Fragment key={i}><div className="px-3 text-[var(--text-muted)] border-r border-[var(--border-soft)]">⋯</div><div className="px-3 text-[var(--text-muted)]">⋯</div></React.Fragment>
        ) : (
          <React.Fragment key={i}>
            <div className={`px-3 whitespace-pre-wrap break-words border-r border-[var(--border-soft)] ${r.type === "del" || r.type === "change" ? "diff-del" : ""}`}>{r.left ?? ""}</div>
            <div className={`px-3 whitespace-pre-wrap break-words ${r.type === "add" || r.type === "change" ? "diff-add" : ""}`}>{r.right ?? ""}</div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// fix: {status: "running"|"review"|"error", count, data?, error?}
export default function FixReviewModal({ fix, system, base, onAccept, onDiscard, onCancel, onRetry, onRegenerate, onJump, progress, discardLabel, acceptLabel, footnote }) {
  const exporting = !!fix.thenExport;
  const jumpIssue = (fix.list || []).find((item) => item && Number(item.line) > 0);
  return (
    <Modal title={`${progress ? `${progress} · ` : ""}${fix.status === "running" ? "Writing a fix…" : fix.status === "error" ? "Fix not applied" : "Review the fix"}`} onClose={onCancel || onDiscard} testId="fix-modal" width={980}>
      {fix.status === "running" && (
        <div className="flex items-center gap-2 text-[12.5px] font-mono text-[var(--text-secondary)]" data-testid="fix-running">
          <Loader2 size={14} className="animate-spin text-[var(--unreal-orange)]" /> Patching {fix.count} issue{fix.count === 1 ? "" : "s"} with your AI key. Only the lines that need changing are touched.
        </div>
      )}
      {fix.status === "error" && (
        <>
          <div className="text-[12.5px] font-mono text-[var(--accent-red)] mb-4" data-testid="fix-error">{fix.error}</div>
          <div className="text-[12px] text-[var(--text-secondary)] mb-4">Nothing in your code was changed. For structural problems, regenerating the system with these issues as change requests often works better (1 synthesis).</div>
          <div className="flex gap-2 justify-end">
            {jumpIssue && onJump && (
              <button type="button" className="ue-btn mr-auto" data-testid="fix-jump" onClick={() => { onJump(jumpIssue); (onCancel || onDiscard)?.(); }}>Jump to line</button>
            )}
            <button className="ue-btn" onClick={onDiscard} data-testid="fix-close"><X size={13} /> {discardLabel || (exporting ? "Export without fixing" : "Close")}</button>
            {onRegenerate && <button className="ue-btn" onClick={onRegenerate} data-testid="fix-error-regenerate"><RefreshCw size={13} /> Fix &amp; regenerate</button>}
            <button className="ue-btn ue-btn-primary" onClick={onRetry} data-testid="fix-retry"><RotateCcw size={13} /> Try again</button>
          </div>
        </>
      )}
      {fix.status === "review" && (
        <>
          <div className="panel p-3 mb-4" data-testid="fix-change-list">
            <div className="eyebrow mb-1.5 flex items-center gap-1.5"><Wand2 size={11} /> {fix.data.changes.length} change{fix.data.changes.length === 1 ? "" : "s"} · {fix.data.model}</div>
            <ul className="space-y-0.5">
              {fix.data.changes.map((c, i) => (
                <li key={i} className="text-[11.5px] font-mono text-[var(--text-primary)]"><span className="text-[var(--text-muted)] mr-1.5">{c.file}</span>{c.why || "Edit"}</li>
              ))}
            </ul>
          </div>
          <FileDiff label={`${base}.h`} before={system.cpp_header || ""} after={fix.data.cpp_header} testId="fix-diff-h" />
          <FileDiff label={`${base}.cpp`} before={system.cpp_source || ""} after={fix.data.cpp_source} testId="fix-diff-cpp" />
          <div className="flex items-center gap-2 justify-end">
            <span className="text-[10.5px] font-mono text-[var(--text-muted)] mr-auto">{footnote || (exporting ? "Auto-fix before export: your zip downloads after you choose." : "Accepting changes the workspace only. Press Save to keep it.")}</span>
            <button className="ue-btn" onClick={onDiscard} data-testid="fix-discard"><X size={13} /> {discardLabel || (exporting ? "Discard and export" : "Discard")}</button>
            <button className="ue-btn ue-btn-primary" onClick={onAccept} disabled={fix.saving} data-testid="fix-accept"><Check size={13} /> {acceptLabel || (exporting ? "Accept fix and export" : "Accept fix")}</button>
          </div>
        </>
      )}
    </Modal>
  );
}

export function FixDetailModal({ entry, pending, canUndo, onUndo, onClose }) {
  return (
    <Modal title={pending ? "Fix (not saved yet)" : "Past fix"} onClose={onClose} testId="fix-detail-modal" width={980}>
      <div className="panel p-3 mb-4">
        <div className="eyebrow mb-1.5">{new Date(entry.at).toLocaleString()}{entry.model ? ` · ${entry.model}` : ""}</div>
        <ul className="space-y-0.5">
          {entry.changes.map((c, i) => <li key={i} className="text-[11.5px] font-mono"><span className="text-[var(--text-muted)] mr-1.5">{c.file}</span>{c.why || "Edit"}</li>)}
        </ul>
      </div>
      {entry.hunks.map((h) => (
        <FileDiff key={h.file} label={`${h.file} · from line ${h.start}`} before={h.removed.join("\n")} after={h.added.join("\n")} testId={`fix-detail-diff-${h.file.slice(1)}`} />
      ))}
      <div className="flex items-center gap-2 justify-end">
        <span className="text-[10.5px] font-mono text-[var(--text-muted)] mr-auto">Undo puts the old lines back in the workspace if they still match. Press Save to keep it.</span>
        <button className="ue-btn" onClick={onClose} data-testid="fix-detail-close">Close</button>
        {canUndo && <button className="ue-btn ue-btn-primary" onClick={onUndo} data-testid="fix-detail-undo"><Undo2 size={13} /> Undo this fix</button>}
      </div>
    </Modal>
  );
}
