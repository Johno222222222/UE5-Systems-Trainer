// Turns lesson text into plain runs and glossary links.
// Longest phrase wins, whole words only, first mention of each term only.

const WORD = /[A-Za-z0-9_]/;

function edge(text, index) {
  if (index < 0 || index >= text.length) return true;
  return !WORD.test(text[index]);
}

export function prepareGlossary(entries) {
  const phrases = [];
  for (const entry of entries || []) {
    if (!entry || entry.match === "skip") continue;
    const names = [entry.term, ...(entry.aliases || [])].filter(Boolean);
    for (const name of names) {
      phrases.push({
        id: entry.id || entry.term,
        term: entry.term,
        definition: entry.summary || entry.definition || "",
        summary: entry.summary || entry.definition || "",
        detail: entry.detail || "",
        see: Array.isArray(entry.see) ? entry.see : [],
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        phrase: String(name),
        lower: String(name).toLowerCase(),
        capital: entry.match === "capital",
      });
    }
  }
  phrases.sort((a, b) => b.lower.length - a.lower.length || a.lower.localeCompare(b.lower));
  return phrases;
}

export function linkTerms(text, phrases) {
  const source = String(text ?? "");
  const list = phrases || [];
  const used = new Set();
  const parts = [];
  let i = 0;
  let plain = 0;
  const flush = (end) => {
    if (end > plain) parts.push({ type: "text", text: source.slice(plain, end) });
  };
  while (i < source.length) {
    let found = null;
    if (edge(source, i - 1)) {
      for (const phrase of list) {
        if (!phrase.lower || used.has(phrase.id)) continue;
        const end = i + phrase.lower.length;
        if (end > source.length) continue;
        const slice = source.slice(i, end);
        if (slice.toLowerCase() !== phrase.lower) continue;
        if (!edge(source, end)) continue;
        if (phrase.capital && slice[0] === slice[0].toLowerCase()) continue;
        found = { phrase, end, slice };
        break;
      }
    }
    if (!found) {
      i += 1;
      continue;
    }
    flush(i);
    used.add(found.phrase.id);
    parts.push({
      type: "term",
      text: found.slice,
      id: found.phrase.id,
      term: found.phrase.term,
      definition: found.phrase.summary || found.phrase.definition,
      summary: found.phrase.summary || found.phrase.definition,
      detail: found.phrase.detail,
      see: found.phrase.see,
      tags: found.phrase.tags,
    });
    i = found.end;
    plain = i;
  }
  flush(source.length);
  return parts;
}

export const GLOSSARY_REQUESTS_KEY = "ue5_architect_glossary_requests";

export function addGlossaryRequest(list, word) {
  const text = String(word || "").trim().replace(/\s+/g, " ").slice(0, 48);
  if (text.length < 2) return Array.isArray(list) ? list : [];
  const key = text.toLowerCase();
  const next = (Array.isArray(list) ? list : []).filter((item) => String(item.word || "").toLowerCase() !== key);
  next.unshift({ word: text, at: new Date().toISOString() });
  return next.slice(0, 40);
}

export function phrasesForTags(phrases, tags) {
  if (!Array.isArray(tags) || !tags.length) return phrases || [];
  const wanted = new Set(tags);
  return (phrases || []).filter((phrase) => (phrase.tags || []).some((tag) => wanted.has(tag)));
}
