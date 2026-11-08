import React, { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Lightbulb } from "lucide-react";
import { highlightBlueprint } from "../lib/highlight";

const WHY_RE = /^(\s*)(?:\/\/\s*)?WHY:\s*(.*)$/i;

export function WhyCallout({ text, testId, indent = 0 }) {
  return (
    <div className="why-callout" style={{ marginLeft: indent }} data-testid={testId}>
      <Lightbulb size={12} className="shrink-0 mt-[2px]" />
      <span><span className="why-label">Why</span>{text}</span>
    </div>
  );
}

export default function AnnotatedPseudocode({ code }) {
  const [showWhy, setShowWhy] = useState(true);
  const lines = (code || "").split("\n");
  const whyCount = lines.filter((l) => WHY_RE.test(l)).length;

  const copy = async () => {
    await navigator.clipboard.writeText((code || "").replace(/^(\s*)WHY:/gim, "$1// WHY:"));
    toast.success("Blueprint pseudocode copied");
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([code || ""], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url; a.download = "Blueprint_Pseudocode.txt"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="code-box">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--blueprint-blue)]" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-secondary)]">Blueprint Pseudocode</span>
        </div>
        <div className="flex gap-1.5">
          <button
            className={`ue-btn !py-1 !px-2 !text-[11px] ${showWhy ? "!border-[#e8c547] !text-[#e8c547]" : ""}`}
            onClick={() => setShowWhy((v) => !v)}
            aria-pressed={showWhy}
            data-testid="toggle-why-notes"
          >
            <Lightbulb size={12} /> Why notes ({whyCount})
          </button>
          <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={copy} data-testid="copy-blueprint-code"><Copy size={12} /> Copy</button>
          <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={download} data-testid="download-blueprint-code"><Download size={12} /> .txt</button>
        </div>
      </div>
      <div className="px-5 py-4 font-mono text-[12.5px] leading-[1.65] text-[#d8dee9]" data-testid="blueprint-code">
        {!code && <span className="tok-com">// awaiting generation…</span>}
        {code && lines.map((line, i) => {
          const m = line.match(WHY_RE);
          if (m) {
            return showWhy ? <WhyCallout key={i} text={m[2]} indent={m[1].length * 7.5} testId={`why-note-bp-${i}`} /> : null;
          }
          return <div key={i} className="whitespace-pre" dangerouslySetInnerHTML={{ __html: highlightBlueprint(line) || "&nbsp;" }} />;
        })}
      </div>
    </div>
  );
}
