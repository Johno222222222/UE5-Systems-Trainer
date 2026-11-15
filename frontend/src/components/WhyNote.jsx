import React, { useState } from "react";
import { showWhyDepth } from "../lib/learning.mjs";

export default function WhyNote({ note, level, testId }) {
  const [open, setOpen] = useState(false);
  if (!note) return null;
  const deep = showWhyDepth(level);
  return (
    <div className="why-callout" data-testid={testId || `why-note-${note.id}`} id={`why-note-${note.id}`}>
      <div className="min-w-0">
        <div><span className="why-label">Why</span>{note.one_line}</div>
        {deep && (
          <button type="button" className="why-more" data-testid={`why-more-${note.id}`} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? "Hide the tradeoff" : "Tradeoff and common mistake"}
          </button>
        )}
        {deep && open && (
          <div className="mt-1" data-testid={`why-depth-${note.id}`}>
            {note.tradeoff && <div><span className="why-label">Tradeoff</span>{note.tradeoff}</div>}
            {note.common_mistake && <div className="mt-1"><span className="why-label">Mistake</span>{note.common_mistake}</div>}
            <a
              className="why-concept"
              href={`#concept-${note.concept_id || "concept"}`}
              data-testid={`why-concept-${note.id}`}
              onClick={(event) => event.preventDefault()}
              title="The concept page arrives in a later stage."
            >
              {note.concept_title || "Related concept"} · opens in a later stage
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
