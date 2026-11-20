import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api";
import { addGlossaryRequest, GLOSSARY_REQUESTS_KEY, linkTerms, phrasesForTags, prepareGlossary } from "../lib/glossary.mjs";

let cachedTerms = null;
let cached = null;
let loading = null;

function loadGlossary() {
  if (cached) return Promise.resolve({ phrases: cached, terms: cachedTerms || [] });
  if (!loading) {
    loading = api.get("/glossary").then((response) => {
      cachedTerms = response.data?.terms || [];
      cached = prepareGlossary(cachedTerms);
      return { phrases: cached, terms: cachedTerms };
    }).catch(() => {
      cachedTerms = [];
      cached = [];
      return { phrases: cached, terms: cachedTerms };
    });
  }
  return loading;
}

export function useGlossary() {
  const [state, setState] = useState({ phrases: cached || [], terms: cachedTerms || [] });
  useEffect(() => {
    let live = true;
    loadGlossary().then((next) => { if (live) setState(next); });
    return () => { live = false; };
  }, []);
  return state;
}

export function useGlossaryPhrases() {
  return useGlossary().phrases;
}

export const GlossaryTags = React.createContext(null);

function readRequests() {
  try { return JSON.parse(localStorage.getItem(GLOSSARY_REQUESTS_KEY) || "[]"); }
  catch { return []; }
}

export function saveGlossaryRequest(word) {
  const next = addGlossaryRequest(readRequests(), word);
  localStorage.setItem(GLOSSARY_REQUESTS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("glossary-requests"));
  return next;
}

function wordFromEvent(event) {
  const selected = window.getSelection && !window.getSelection().isCollapsed
    ? window.getSelection().toString().trim()
    : "";
  if (/^[A-Za-z][A-Za-z0-9_+.-]{1,40}$/.test(selected)) return selected;
  const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
  const node = range?.startContainer;
  if (!node || node.nodeType !== 3) return "";
  const text = node.textContent || "";
  const offset = range.startOffset || 0;
  let start = offset;
  let end = offset;
  while (start > 0 && /[A-Za-z0-9_+.-]/.test(text[start - 1])) start -= 1;
  while (end < text.length && /[A-Za-z0-9_+.-]/.test(text[end])) end += 1;
  return text.slice(start, end);
}

function Popup({ term, termId, summary, detail, see, terms, onClose, pending, anchor }) {
  const ref = useRef(null);
  const [more, setMore] = useState(false);
  const [focus, setFocus] = useState(null);
  const shown = focus || { term, summary, detail, see };
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
  const related = (shown.see || []).map((id) => (terms || []).find((item) => item.id === id)).filter(Boolean);
  const style = {
    position: "fixed",
    left: Math.max(8, Math.min(anchor?.left || 16, window.innerWidth - 300)),
    top: Math.max(8, anchor?.bottom ? anchor.bottom + 6 : 80),
    zIndex: 4200,
    width: "min(280px, 70vw)",
  };
  return createPortal(
    <span ref={ref} className="glossary-pop top-pop" style={style} role="dialog" aria-label={shown.term} data-testid="glossary-popup">
      <span className="glossary-pop-term">{shown.term}</span>
      <span className="glossary-pop-body">{pending ? "Definition coming soon." : (shown.summary || shown.definition || "")}</span>
      {!pending && shown.detail && (
        <button type="button" className="glossary-more" data-testid="glossary-more" onClick={() => setMore((value) => !value)}>
          {more ? "Less" : "More"}
        </button>
      )}
      {!pending && more && shown.detail && (
        <span className="glossary-pop-detail" data-testid="glossary-detail">
          <span className="glossary-pop-kicker">In UE5 this means</span>
          {shown.detail}
        </span>
      )}
      {!pending && (
        <button
          type="button"
          className="glossary-more"
          data-testid="glossary-see-more"
          onClick={() => {
            window.dispatchEvent(new CustomEvent("open-glossary-term", { detail: { id: termId || "", term: shown.term } }));
            onClose();
          }}
        >
          See more
        </button>
      )}
      {!pending && !!related.length && (
        <span className="glossary-see">
          See also
          {related.map((item) => (
            <button key={item.id} type="button" className="glossary-see-link" data-testid={`glossary-see-${item.id}`} onClick={() => { setFocus(item); setMore(false); }}>
              {item.term}
            </button>
          ))}
        </span>
      )}
    </span>,
    document.body,
  );
}

export default function GlossaryText({ text, className }) {
  const { phrases, terms } = useGlossary();
  const tags = React.useContext(GlossaryTags);
  const visible = useMemo(() => phrasesForTags(phrases, tags), [phrases, tags]);
  const parts = useMemo(() => linkTerms(text, visible), [text, visible]);
  const [openId, setOpenId] = useState(null);
  const [anchor, setAnchor] = useState(null);
  const [menu, setMenu] = useState(null);
  if (!text) return null;
  const known = (word) => visible.some((phrase) => phrase.lower === String(word || "").toLowerCase())
    || phrases.some((phrase) => phrase.lower === String(word || "").toLowerCase());
  return (
    <span
      className={className}
      onContextMenu={(event) => {
        const word = wordFromEvent(event);
        if (!word || known(word)) return;
        event.preventDefault();
        setMenu({ word, x: event.clientX, y: event.clientY });
      }}
    >
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
              onClick={(event) => {
                if (open) { setOpenId(null); return; }
                setAnchor(event.currentTarget.getBoundingClientRect());
                setOpenId(index);
              }}
            >
              {part.text}
            </button>
            {open && (
              <Popup
                term={part.term}
                termId={part.id}
                summary={part.summary || part.definition}
                detail={part.detail}
                see={part.see}
                terms={terms}
                anchor={anchor}
                onClose={() => setOpenId(null)}
              />
            )}
          </span>
        );
      })}
      {menu && createPortal(
        <span className="glossary-request top-pop" style={{ left: menu.x, top: menu.y, zIndex: 4200 }} data-testid="glossary-request-menu">
          <button
            type="button"
            data-testid="glossary-request"
            onClick={() => { saveGlossaryRequest(menu.word); setMenu(null); }}
          >
            Request definition
          </button>
        </span>,
        document.body,
      )}
    </span>
  );
}
