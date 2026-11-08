import React, { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Copy, Download } from "lucide-react";
import { highlightCpp, highlightBlueprint } from "../lib/highlight";

const LINE_PX = 20;
const PAD_PX = 18;

// target: {line, nonce} scrolls to and pulses that line
export function CodeBox({ title, code, lang = "cpp", testId, target }) {
  const html = useMemo(() => (lang === "cpp" ? highlightCpp(code) : highlightBlueprint(code)), [code, lang]);
  const count = (code || "").split("\n").length;
  const markRef = useRef(null);
  useEffect(() => {
    if (target && markRef.current) markRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [target?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code || "");
      toast.success(`${title} copied to clipboard`);
    } catch { toast.error("Your browser blocked the clipboard. Use the download button instead."); }
  };
  const ext = lang === "cpp" ? (title.includes(".h") ? "h" : "cpp") : "txt";
  const download = () => {
    const blob = new Blob([code || ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = title.replace(/[^a-z0-9.-]/gi, "_").replace(new RegExp(`\\.${ext}$`), "") + `.${ext}`;
    a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="code-box" data-testid={`codebox-${testId}`}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${lang === "cpp" ? "bg-[var(--cpp-green)]" : "bg-[var(--blueprint-blue)]"}`} />
          <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-secondary)]">{title}</span>
        </div>
        <div className="flex gap-1.5">
          <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={copy} data-testid={`copy-${testId}`}><Copy size={12} /> Copy</button>
          <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={download} data-testid={`download-${testId}`}><Download size={12} /> .{ext}</button>
        </div>
      </div>
      <div className="relative flex">
        {code && (
          <div className="select-none text-right pr-3 pl-3 font-mono text-[11px] text-[var(--text-muted)] border-r border-[var(--border-soft)] shrink-0" style={{ paddingTop: PAD_PX, paddingBottom: PAD_PX, lineHeight: `${LINE_PX}px` }} aria-hidden="true">
            {Array.from({ length: count }, (_, i) => <div key={i}>{i + 1}</div>)}
          </div>
        )}
        {target && target.line <= count && (
          <div key={target.nonce} ref={markRef} className="code-line-mark absolute left-0 right-0 pointer-events-none" style={{ top: PAD_PX + (target.line - 1) * LINE_PX, height: LINE_PX }} data-testid={`line-mark-${testId}`} data-line={target.line} />
        )}
        <pre className="flex-1 !pl-4" style={{ lineHeight: `${LINE_PX}px` }} dangerouslySetInnerHTML={{ __html: html || `<span class="tok-com">// awaiting generation…</span>` }} />
      </div>
    </div>
  );
}
