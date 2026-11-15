import React from "react";
import { CheckCircle2 } from "lucide-react";
import { WhyCallout } from "./AnnotatedPseudocode";
import GlossaryText from "./GlossaryText";

export default function SetupGuide({ steps, done = {}, onToggle }) {
  if (!steps?.length) {
    return <div className="text-sm text-slate-500 font-mono p-6">— no setup steps yet —</div>;
  }
  return (
    <div className="space-y-2 p-4 overflow-y-auto h-full">
      {steps.map((s) => {
        const active = !!done[s.step];
        return (
          <div
            key={s.step}
            className={`panel p-3 flex items-start gap-3 transition-colors ${active ? "border-[var(--cpp-green)] bg-[rgba(0,230,118,0.05)]" : "hover:border-[var(--unreal-orange)]"}`}
          >
            <button
              onClick={() => onToggle?.(s.step)}
              aria-label={`Mark step ${s.step} ${active ? "not done" : "done"}`}
              data-testid={`setup-step-${s.step}`}
              className={`h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center font-mono text-[11px] font-bold ${active ? "border-[var(--cpp-green)] text-[var(--cpp-green)] bg-[rgba(0,230,118,0.1)]" : "border-[var(--border)] text-[var(--text-secondary)]"}`}
            >
              {active ? <CheckCircle2 size={14} /> : s.step}
            </button>
            <div className="flex-1 min-w-0">
              <div className="font-sub font-semibold text-[13px] text-[var(--text-primary)]">{s.title}</div>
              <div className="text-[12px] text-[var(--text-secondary)] leading-relaxed mt-0.5 font-mono"><GlossaryText text={s.detail} /></div>
              {s.why && <div className="mt-2"><WhyCallout text={s.why} testId={`why-note-step-${s.step}`} /></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
