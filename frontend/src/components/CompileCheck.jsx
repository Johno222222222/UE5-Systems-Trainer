import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, Sparkles, XCircle } from "lucide-react";
import { api, errorText } from "../lib/api";
import { aiHeaders } from "./AiKeyModal";
import { baseName } from "../lib/zipExport";
import { issueText } from "../lib/compileCheck";

export function IssueList({ issues, testId }) {
  return (
    <ul className="space-y-1.5" data-testid={testId}>
      {issues.map((i, n) => (
        <li key={n} className="flex gap-2 text-[11.5px] font-mono leading-relaxed" data-testid={`${testId}-item-${n}`}>
          {i.severity === "error" ? <XCircle size={13} className="shrink-0 mt-0.5 text-[var(--accent-red)]" /> : <AlertTriangle size={13} className="shrink-0 mt-0.5 text-[#e8c547]" />}
          <div className="min-w-0">
            <span className="text-[var(--text-muted)] mr-1.5">{i.file}{i.line ? `:${i.line}` : ""}</span>
            <span className="text-[var(--text-primary)]">{i.message}</span>
            {i.fix && <div className="text-[var(--text-muted)]">→ {i.fix}</div>}
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

export default function CompileCheck({ system, issues, aiKey, onNeedKey, onUsed, onAiIssues }) {
  const [open, setOpen] = useState(true);
  const [ai, setAi] = useState(null); // null | "running" | {issues, model} | {error}
  const seq = useRef(0);
  useEffect(() => { seq.current += 1; setAi(null); }, [system?.id]);
  const { e, w } = tally(issues);

  const review = async () => {
    if (!aiKey) { onNeedKey(); return; }
    const mine = ++seq.current;
    setAi("running");
    try {
      const { data } = await api.post("/ai/review-cpp", {
        file_base: baseName(system), cpp_header: system.cpp_header, cpp_source: system.cpp_source,
        known_issues: issues.map(issueText),
      }, { headers: aiHeaders(aiKey) });
      if (mine === seq.current) { setAi(data); onAiIssues(system.id, data.issues); }
    } catch (err) {
      if (mine === seq.current) setAi({ error: errorText(err) });
    } finally {
      onUsed();
    }
  };

  const color = e ? "var(--accent-red)" : w ? "#e8c547" : "var(--cpp-green)";
  return (
    <div className="panel mb-4" style={{ borderColor: color }} data-testid="compile-check-panel">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button className="flex items-center gap-2 flex-1 min-w-0 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="compile-check-toggle">
          {e || w ? <AlertTriangle size={14} style={{ color }} /> : <CheckCircle2 size={14} style={{ color }} />}
          <span className="eyebrow">Compile check</span>
          <span className="text-[11.5px] font-mono" style={{ color }} data-testid="compile-check-summary">
            {e || w ? `${e} error${e === 1 ? "" : "s"} · ${w} warning${w === 1 ? "" : "s"}` : "No likely mistakes found"}
          </span>
          <ChevronDown size={13} className={`text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={review} disabled={ai === "running"} data-testid="ai-review-button">
          {ai === "running" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {ai === "running" ? "Reviewing…" : "AI review"}
        </button>
      </div>
      {open && (
        <div className="px-4 pb-3 space-y-3">
          {issues.length > 0 && <IssueList issues={issues} testId="compile-issues" />}
          <div className="text-[10.5px] font-mono text-[var(--text-muted)]">
            Instant pattern check: catches common mistakes, not every compiler error. AI review reads both files with your key ({aiKey?.model || "no key yet"}) and counts as 1 request.
          </div>
          {ai && ai !== "running" && (
            <div className="border-t border-[var(--border-soft)] pt-3" data-testid="ai-review-result">
              <div className="eyebrow mb-2 flex items-center gap-1.5"><Sparkles size={11} /> AI review {ai.model && <span className="normal-case tracking-normal font-normal">· {ai.model}</span>}</div>
              {ai.error && <div className="text-[11.5px] font-mono text-[var(--accent-red)]" data-testid="ai-review-error">{ai.error}</div>}
              {ai.issues?.length === 0 && <div className="text-[11.5px] font-mono text-[var(--cpp-green)]" data-testid="ai-review-clean">No further problems found.</div>}
              {ai.issues?.length > 0 && <IssueList issues={ai.issues} testId="ai-review-issues" />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
