import React from "react";
import { FolderOpen, Plus, Search } from "lucide-react";
import { EMPTY_ACTIONS } from "../lib/shell.mjs";

const ICONS = {
  "start-new": Plus,
  "load-saved": FolderOpen,
  browse: Search,
};

// Shown when a section exists but nothing is open in it.
export default function EmptySection({ section, open, onAction }) {
  if (open) {
    return (
      <div className="empty-section" data-testid="section-remembered">
        <div className="empty-section-card">
          <div className="eyebrow">{section?.label || "Section"}</div>
          <h1 className="font-display text-[32px] font-extrabold uppercase tracking-wider leading-none mt-2">Still open</h1>
          <p className="mt-3 text-[13px] text-[var(--text-secondary)]" data-testid="remembered-label">
            {open.label || "Untitled"} is what this section had open.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {EMPTY_ACTIONS.map((action) => {
              const Icon = ICONS[action.id] || Plus;
              return (
                <button key={action.id} type="button" className="ue-btn" data-testid={`empty-${action.id}`} onClick={() => onAction(action.id)}>
                  <Icon size={14} /> {action.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="empty-section" data-testid="empty-section">
      <div className="empty-section-card">
        <div className="eyebrow">{section?.label || "Section"}</div>
        <h1 className="font-display text-[32px] font-extrabold uppercase tracking-wider leading-none mt-2">Nothing open</h1>
        <p className="mt-3 text-[13px] text-[var(--text-secondary)]">
          This section does not have anything open yet.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {EMPTY_ACTIONS.map((action) => {
            const Icon = ICONS[action.id] || Plus;
            return (
              <button
                key={action.id}
                type="button"
                className={`ue-btn ${action.id === "start-new" ? "ue-btn-primary" : ""}`}
                data-testid={`empty-${action.id}`}
                onClick={() => onAction(action.id)}
              >
                <Icon size={14} /> {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
