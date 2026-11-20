import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { filterGlossary, GLOSSARY_REQUESTS_KEY, uniqueTerms } from "../lib/glossary.mjs";

function readRequests() {
  try { return JSON.parse(localStorage.getItem(GLOSSARY_REQUESTS_KEY) || "[]"); }
  catch { return []; }
}

export default function Glossary() {
  const [terms, setTerms] = useState([]);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [requests, setRequests] = useState(readRequests);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get("/glossary").then((response) => setTerms(response.data?.terms || [])).catch(() => setTerms([]));
    const pull = () => setRequests(readRequests());
    window.addEventListener("glossary-requests", pull);
    window.addEventListener("storage", pull);
    return () => {
      window.removeEventListener("glossary-requests", pull);
      window.removeEventListener("storage", pull);
    };
  }, []);

  const listed = useMemo(() => uniqueTerms(terms), [terms]);

  const tags = useMemo(() => {
    const set = new Set();
    listed.forEach((term) => (term.tags || []).forEach((item) => set.add(item)));
    return [...set].sort();
  }, [listed]);

  const shown = useMemo(() => filterGlossary(listed, query, tag), [listed, query, tag]);

  const byId = useMemo(() => new Map(listed.map((term) => [term.id, term])), [listed]);

  const copyRequests = async () => {
    const text = requests.map((item) => item.word).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch { setCopied(false); }
  };

  return (
    <div className="home-screen" data-testid="glossary-screen">
      <div className="home-inner">
        <div className="eyebrow">Glossary</div>
        <h1 className="font-display text-[36px] font-extrabold uppercase tracking-wider leading-none mt-1">Terms</h1>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)] max-w-2xl">Dotted words in lessons open a one-line definition. More adds the Unreal detail when there is one.</p>
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <input
            className="bg-[var(--bg-main)] border border-[var(--border)] rounded px-2 py-1 text-[12px] font-mono text-[var(--text-primary)]"
            data-testid="glossary-search"
            value={query}
            placeholder="Search terms"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="button" className={`chip ${tag === "" ? "active" : ""}`} onClick={() => setTag("")}>All</button>
          {tags.map((item) => (
            <button key={item} type="button" className={`chip ${tag === item ? "active" : ""}`} data-testid={`glossary-tag-${item}`} onClick={() => setTag(item)}>{item}</button>
          ))}
        </div>
        <div className="mt-4 text-[11px] font-mono text-[var(--text-muted)]" data-testid="glossary-count">{shown.length} terms</div>
        <div className="mt-3 grid gap-2">
          {shown.map((term) => (
            <article key={term.id} className="panel p-3" data-testid={`glossary-card-${term.id}`} data-term={term.term}>
              <div className="font-sub font-semibold">{term.term}</div>
              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{term.summary || term.definition}</p>
              {!!term.detail && <p className="mt-1 text-[12px] text-[var(--text-muted)]">{term.detail}</p>}
              <div className="mt-2 flex flex-wrap gap-1">
                {(term.tags || []).map((item) => <span key={item} className="chip !cursor-default">{item}</span>)}
              </div>
              {!!(term.see || []).length && (
                <div className="mt-2 text-[12px] text-[var(--text-secondary)]">
                  See also {(term.see || []).map((id) => byId.get(id)).filter(Boolean).map((item) => (
                    <button key={item.id} type="button" className="glossary-see-link ml-2" onClick={() => { setQuery(item.term); setTag(""); }}>{item.term}</button>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
        <div className="panel p-3 mt-6" data-testid="glossary-requests">
          <div className="eyebrow">Requested</div>
          <p className="mt-1 text-[12px] text-[var(--text-secondary)]">Words you asked about that are not in the glossary yet. Definition coming soon.</p>
          {!requests.length && <p className="mt-2 text-[12px] font-mono text-[var(--text-muted)]">None yet. Right-click a word in a lesson.</p>}
          {!!requests.length && (
            <ul className="mt-2 text-[13px]">
              {requests.map((item) => <li key={item.word}>{item.word}</li>)}
            </ul>
          )}
          <button type="button" className="ue-btn mt-3" data-testid="glossary-requests-copy" disabled={!requests.length} onClick={copyRequests}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
