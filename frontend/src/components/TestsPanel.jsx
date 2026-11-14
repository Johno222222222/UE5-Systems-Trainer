import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FlaskConical, Loader2, RefreshCw, Wand2 } from "lucide-react";
import { CodeBox } from "./CodeBox";
import { IssueList } from "./CompileCheck";
import { aiHeaders } from "./AiKeyModal";
import { api, errorText } from "../lib/api";
import { baseName } from "../lib/zipExport";
import { checkTests } from "../lib/compileCheck";

export const codeHash = (s) => {
  let x = 5381;
  const t = `${s?.cpp_header || ""}\n${s?.cpp_source || ""}`;
  for (let i = 0; i < t.length; i += 1) x = ((x * 33) ^ t.charCodeAt(i)) >>> 0;
  return x.toString(36);
};

export const testIssues = (system) => (system?.tests?.code ? checkTests(system.tests.code, baseName(system)) : []);

export default function TestsPanel({ system, projectId, aiKey, canEdit, fixing, onNeedKey, onUsed, onTests, onFix, jump, onJump, unrealVersion }) {
  const [busy, setBusy] = useState(false);
  const tests = system.tests;
  const issues = useMemo(() => testIssues(system), [system]);
  const stale = tests && tests.for !== codeHash(system);

  const generate = async () => {
    if (!aiKey) { onNeedKey(); return; }
    const forId = system.id;
    setBusy(true);
    try {
      const { data } = await api.post("/ai/tests", {
        file_base: baseName(system), cpp_header: system.cpp_header, cpp_source: system.cpp_source, project_id: projectId || null,
        unreal_version: unrealVersion || undefined,
      }, { headers: aiHeaders(aiKey) });
      onTests(forId, { file_name: data.file_name, code: data.code, cases: data.cases, model: data.model, for: codeHash(system), at: new Date().toISOString() });
      toast.success(`Generated ${data.cases.length} test case${data.cases.length === 1 ? "" : "s"}`, { description: "Press Save to keep them with the project." });
    } catch (e) {
      toast.error("Couldn't generate tests", { description: errorText(e) });
    } finally { setBusy(false); onUsed(); }
  };

  return (
    <div className="p-5 h-full overflow-auto" data-testid="tests-panel">
      <div className="panel p-4 mb-4 flex items-start gap-3">
        <FlaskConical size={18} className="text-[var(--cpp-green)] shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-sub font-semibold text-[14px]">Automation tests</div>
          <div className="text-[11.5px] font-mono text-[var(--text-muted)]">
            Unreal Automation Spec tests for this system. Plugin exports put them in a test-only module; run them from Tools &gt; Session Frontend &gt; Automation. Uses your AI key, 1 request.
          </div>
          {tests?.cases?.length > 0 && (
            <ul className="mt-2 grid md:grid-cols-2 gap-x-4" data-testid="tests-cases">
              {tests.cases.map((c, i) => <li key={i} className="text-[11.5px] font-mono text-[var(--text-secondary)]">✓ {c}</li>)}
            </ul>
          )}
          {stale && (
            <div className="mt-2 flex items-center gap-1.5 text-[11.5px] font-mono text-[#e8c547]" data-testid="tests-stale">
              <AlertTriangle size={12} /> Out of date: the system's C++ changed since these tests were written.
            </div>
          )}
        </div>
        {canEdit && (
          <button className="ue-btn ue-btn-primary !text-[12px]" onClick={generate} disabled={busy} data-testid="generate-tests-button">
            {busy ? <Loader2 size={13} className="animate-spin" /> : tests ? <RefreshCw size={13} /> : <FlaskConical size={13} />} {busy ? "Writing tests…" : tests ? "Regenerate tests" : "Generate tests"}
          </button>
        )}
      </div>
      {tests && (
        <>
          <div className="panel mb-4 px-4 py-2.5" style={{ borderColor: issues.some((i) => i.severity === "error") ? "var(--accent-red)" : issues.length ? "#e8c547" : "var(--cpp-green)" }} data-testid="tests-check">
            <div className="flex items-center gap-2">
              <span className="eyebrow flex-1">Compile check · tests</span>
              <span className="text-[11.5px] font-mono" data-testid="tests-check-summary">{issues.length ? `${issues.length} issue${issues.length === 1 ? "" : "s"}` : "No likely mistakes found"}</span>
              {canEdit && issues.length > 0 && (
                <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={() => onFix(issues)} disabled={fixing} data-testid="tests-fix-button"><Wand2 size={12} /> Fix these</button>
              )}
            </div>
            {issues.length > 0 && <div className="mt-2"><IssueList issues={issues} testId="tests-issues" onJump={onJump} onFix={canEdit && !fixing ? (i) => onFix([i]) : null} /></div>}
          </div>
          <CodeBox title={tests.file_name} code={tests.code} lang="cpp" testId="tests-code" target={jump?.file === "tests" ? jump : null} />
        </>
      )}
    </div>
  );
}
