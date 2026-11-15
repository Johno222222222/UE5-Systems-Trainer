import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { linkTerms, prepareGlossary } from "../lib/glossary.mjs";

let cached = null;
let loading = null;

function loadPhrases() {
  if (cached) return Promise.resolve(cached);
  if (!loading) {
    loading = api.get("/glossary").then((response) => {
      cached = prepareGlossary(response.data?.terms || []);
      return cached;
    }).catch(() => {
      cached = [];
      return cached;
    });
  }
  return loading;
}

export function useGlossaryPhrases() {
  const [phrases, setPhrases] = useState(cached || []);
  useEffect(() => {
    let live = true;
    loadPhrases().then((next) => { if (live) setPhrases(next); });
    return () => { live = false; };
  }, []);
  return phrases;
}

function Popup({ term, definition, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose(); };
    const onPointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [onClose]);
  return (
    <span ref={ref} className="glossary-pop" role="dialog" aria-label={term} data-testid="glossary-popup">
      <span className="glossary-pop-term">{term}</span>
      <span className="glossary-pop-body">{definition}</span>
    </span>
  );
}

export default function GlossaryText({ text, className }) {
  const phrases = useGlossaryPhrases();
  const parts = useMemo(() => linkTerms(text, phrases), [text, phrases]);
  const [openId, setOpenId] = useState(null);
  if (!text) return null;
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type !== "term") return <React.Fragment key={index}>{part.text}</React.Fragment>;
        const open = openId === index;
        return (
          <span key={index} className="glossary-wrap">
            <button
              type="button"
              className="glossary-term"
              data-testid={`glossary-term-${part.id}`}
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : index)}
            >
              {part.text}
            </button>
            {open && <Popup term={part.term} definition={part.definition} onClose={() => setOpenId(null)} />}
          </span>
        );
      })}
    </span>
  );
}
