import React, { useState } from "react";
import { showWhyDepth } from "../lib/learning.mjs";
import { useShell } from "../shell/ShellContext";

export default function WhyNote({ note, level, testId, forceOpen = false }) {
  const shell = useShell();
  const [open, setOpen] = useState(false);
  if (!note) return null;
  const deep = forceOpen || showWhyDepth(level);
  const shown = forceOpen || open;
  return (
    <div className="why-callout" data-testid={testId || `why-note-${note.id}`} id={`why-note-${note.id}`}>
      <div className="min-w-0">
        <div><span className="why-label">Why</span>{note.one_line}</div>
        {deep && !forceOpen && (
          <button type="button" className="why-more" data-testid={`why-more-${note.id}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? "Hide the tradeoff" : "Tradeoff and common mistake"}
          </button>
        )}
        {deep && shown && (
          <div className="mt-1" data-testid={`why-depth-${note.id}`}>
            {note.tradeoff && <div><span className="why-label">Tradeoff</span>{note.tradeoff}</div>}
            {note.common_mistake && <div className="mt-1"><span className="why-label">Mistake</span>{note.common_mistake}</div>}
            <button
              type="button"
              className="why-concept"
              data-testid={`why-concept-${note.id}`}
              onClick={() => shell.openConcept(note.concept_id)}
            >
              {note.concept_title || "Related concept"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
