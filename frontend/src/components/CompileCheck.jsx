import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, ClipboardCopy, EyeOff, Loader2, RefreshCw, Sparkles, Undo2, Wand2, XCircle } from "lucide-react";
import { api, errorText } from "../lib/api";
import { aiHeaders } from "./AiKeyModal";
import { baseName } from "../lib/zipExport";
import { issueText } from "../lib/compileCheck";

// onJump/onFix/onIgnore/onRestore are optional per-row actions
export function IssueList({ issues, testId, onJump, onFix, onIgnore, onRestore }) {
  const stop = (fn, i) => (ev) => { ev.stopPropagation(); fn(i); };
  return (
    <ul className="space-y-1" data-testid={testId}>
      {issues.map((i, n) => (
        <li key={n} className={`issue-row group flex gap-2 text-[11.5px] font-mono leading-relaxed rounded px-1.5 py-1 -mx-1.5 ${onJump ? "cursor-pointer" : ""}`}
          onClick={onJump ? () => onJump(i) : undefined} role={onJump ? "button" : undefined} tabIndex={onJump ? 0 : undefined}
          onKeyDown={onJump ? (ev) => { if (ev.key === "Enter") onJump(i); } : undefined}
          title={onJump ? "Show this line in the code" : undefined} data-testid={`${testId}-item-${n}`}>
          {i.severity === "error" ? <XCircle size={13} className="shrink-0 mt-0.5 text-[var(--accent-red)]" /> : <AlertTriangle size={13} className="shrink-0 mt-0.5 text-[#e8c547]" />}
          <div className="min-w-0 flex-1">
            {i.file && <span className="text-[var(--text-muted)] mr-1.5">{i.file}{i.line ? `:${i.line}` : ""}</span>}
            <span className="text-[var(--text-primary)]">{i.message}</span>
            {i.fix && <div className="text-[var(--text-muted)]">→ {i.fix}</div>}
          </div>
          <div className="flex items-start gap-1 shrink-0">
            {onFix && <button className="chip !py-0 !px-1.5 !text-[10px]" onClick={stop(onFix, i)} data-testid={`${testId}-fix-${n}`}><Wand2 size={10} /> Fix</button>}
            {onIgnore && <button className="chip !py-0 !px-1.5 !text-[10px]" onClick={stop(onIgnore, i)} data-testid={`${testId}-ignore-${n}`}><EyeOff size={10} /> Ignore</button>}
            {onRestore && <button className="chip !py-0 !px-1.5 !text-[10px]" onClick={stop(onRestore, i)} data-testid={`${testId}-restore-${n}`}><Undo2 size={10} /> Restore</button>}
            {onJump && <ArrowRight size={12} className="mt-1 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />}
          </div>
        </li>
      ))}
    </ul>
  );
}

const tally = (issues) => {
  const e = issues.filter((i) => i.severity === "error").length;
  return { e, w: issues.length - e };
};

// Lives in Workspace so a running review survives tab switches; results are tied to the reviewed system id
export function useAiReview(system, issues, aiKey, onNeedKey, onUsed) {
  const [state, setState] = useState(null); // {id, status: "running"|"done"|"error", issues, model, error}
  const seq = useRef(0);
  useEffect(() => { seq.current += 1; setState(null); }, [system?.id, system?.cpp_header, system?.cpp_source]);
  const review = async () => {
    if (!aiKey) { onNeedKey(); return; }
    const mine = ++seq.current;
    const id = system.id;
    setState({ id, status: "running" });
    try {
      const { data } = await api.post("/ai/review-cpp", {
        file_base: baseName(system), cpp_header: system.cpp_header, cpp_source: system.cpp_source,
        known_issues: issues.slice(0, 40).map(issueText),
      }, { headers: aiHeaders(aiKey) });
      if (mine === seq.current) setState({ id, status: "done", issues: data.issues, model: data.model });
    } catch (err) {
      if (mine === seq.current) setState({ id, status: "error", error: errorText(err) });
    } finally {
      onUsed();
    }
  };
  return [state && state.id === system?.id ? state : null, review];
}

export default function CompileCheck({ issues, ignored, ai, onReview, aiKey, canEdit, fixing, onJump, onFix, onRegenerate, onIgnore, onRestore, onCopy }) {
  const [open, setOpen] = useState(true);
  const [showIgnored, setShowIgnored] = useState(false);
  const { e, w } = tally(issues);
  const running = ai?.status === "running";
  const aiIssues = ai?.status === "done" ? ai.issues : [];
  const fixable = issues.length + aiIssues.length;

  const color = e ? "var(--accent-red)" : w ? "#e8c547" : "var(--cpp-green)";
  return (
    <div className="panel mb-4" style={{ borderColor: color }} data-testid="compile-check-panel">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button className="flex items-center gap-2 flex-1 min-w-0 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="compile-check-toggle">
          {e || w ? <AlertTriangle size={14} style={{ color }} /> : <CheckCircle2 size={14} style={{ color }} />}
          <span className="eyebrow">Compile check</span>
          <span className="text-[11.5px] font-mono" style={{ color }} data-testid="compile-check-summary">
            {e || w ? `${e} error${e === 1 ? "" : "s"} · ${w} warning${w === 1 ? "" : "s"}` : "No likely mistakes found"}
          </span>
          {ignored.length > 0 && <span className="text-[10.5px] font-mono text-[var(--text-muted)]">· {ignored.length} ignored</span>}
          <ChevronDown size={13} className={`text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {canEdit && (
          <button className="ue-btn ue-btn-primary !py-1 !px-2 !text-[11px]" onClick={() => onFix([...issues, ...aiIssues])} disabled={!fixable || fixing} data-testid="fix-all-button">
            {fixing ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} {fixing ? "Fixing…" : `Fix these${fixable ? ` (${fixable})` : ""}`}
          </button>
        )}
        {canEdit && (
          <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={() => onRegenerate([...issues, ...aiIssues])} disabled={!fixable || fixing}
            title="For structural problems: regenerate the whole system with these issues as change requests (1 synthesis)" data-testid="fix-regenerate-button">
            <RefreshCw size={12} /> Fix &amp; regenerate
          </button>
        )}
        <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={() => onCopy([...issues, ...aiIssues])} disabled={!fixable} data-testid="copy-issues-button"><ClipboardCopy size={12} /> Copy issues</button>
        <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={onReview} disabled={running} data-testid="ai-review-button">
          {running ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {running ? "Reviewing…" : "AI review"}
        </button>
      </div>
      {open && (
        <div className="px-4 pb-3 space-y-3">
          {issues.length > 0 && <IssueList issues={issues} testId="compile-issues" onJump={onJump} onFix={canEdit && !fixing ? (i) => onFix([i]) : null} onIgnore={canEdit ? onIgnore : null} />}
          {ignored.length > 0 && (
            <div>
              <button className="eyebrow flex items-center gap-1.5 hover:text-[var(--text-primary)]" onClick={() => setShowIgnored((v) => !v)} aria-expanded={showIgnored} data-testid="ignored-toggle">
                <EyeOff size={11} /> Ignored ({ignored.length}) <ChevronDown size={11} className={showIgnored ? "rotate-180" : ""} />
              </button>
              {showIgnored && <div className="mt-2 opacity-70"><IssueList issues={ignored} testId="ignored-issues" onJump={onJump} onRestore={canEdit ? onRestore : null} /></div>}
            </div>
          )}
          <div className="text-[10.5px] font-mono text-[var(--text-muted)]">
            Click an issue to see its line. Instant pattern check: catches common mistakes, not every compiler error. AI review and Fix use your key ({aiKey?.model || "no key yet"}), 1 request each.
          </div>
          {ai && !running && (
            <div className="border-t border-[var(--border-soft)] pt-3" data-testid="ai-review-result">
              <div className="eyebrow mb-2 flex items-center gap-1.5"><Sparkles size={11} /> AI review {ai.model && <span className="normal-case tracking-normal font-normal">· {ai.model}</span>}</div>
              {ai.error && <div className="text-[11.5px] font-mono text-[var(--accent-red)]" data-testid="ai-review-error">{ai.error}</div>}
              {ai.issues?.length === 0 && <div className="text-[11.5px] font-mono text-[var(--cpp-green)]" data-testid="ai-review-clean">No further problems found.</div>}
              {ai.issues?.length > 0 && <IssueList issues={ai.issues} testId="ai-review-issues" onJump={onJump} onFix={canEdit && !fixing ? (i) => onFix([i]) : null} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
