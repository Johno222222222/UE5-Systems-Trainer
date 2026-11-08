import React, { useEffect } from "react";
import { X } from "lucide-react";

export default function Modal({ title, onClose, children, testId, width = 520 }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,7,11,0.72)] backdrop-blur-sm p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className="panel w-full p-5 glow-orange-soft max-h-[90vh] overflow-y-auto" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()} data-testid={testId}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-display text-[17px] font-extrabold uppercase tracking-wider">{title}</div>
          {onClose && <button onClick={onClose} aria-label="Close" className="text-[var(--text-muted)] hover:text-[var(--text-primary)]" data-testid={`${testId}-close`}><X size={16} /></button>}
        </div>
        {children}
      </div>
    </div>
  );
}
