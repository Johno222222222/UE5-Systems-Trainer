const FILES = [[".h", "cpp_header"], [".cpp", "cpp_source"]];
const MAX = 400;

// One hunk per file: the lines between the common prefix and common suffix
function hunk(file, before, after) {
  if (before === after) return null;
  const a = before.split("\n");
  const b = after.split("\n");
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p += 1;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s += 1;
  return { file, start: p + 1, removed: a.slice(p, a.length - s).slice(0, MAX), added: b.slice(p, b.length - s).slice(0, MAX) };
}

export function makeFixEntry(before, after, data) {
  return {
    fix_id: `fix_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    model: data.model || "",
    changes: (data.changes || []).map((c) => ({ file: c.file, why: c.why || "" })),
    hunks: FILES.map(([f, k]) => hunk(f, before[k] || "", after[k] || "")).filter(Boolean),
  };
}

const fixNote = (entry) => `Fixed: ${entry.changes.map((c) => c.why).filter(Boolean).join("; ") || `${entry.changes.length} compile issue(s)`}`;
export { fixNote };

// Replace the fix's added lines with its removed lines; null if the code no longer matches
export function undoFixEntry(system, entry) {
  const next = { ...system };
  for (const h of entry.hunks) {
    const key = h.file === ".cpp" ? "cpp_source" : "cpp_header";
    const lines = (next[key] || "").split("\n");
    const at = (i) => h.added.every((l, k) => lines[i + k] === l);
    let idx = h.start - 1;
    if (!(idx <= lines.length - h.added.length && at(idx))) {
      const hits = [];
      for (let i = 0; i <= lines.length - h.added.length; i += 1) if (at(i)) hits.push(i);
      if (hits.length !== 1 || !h.added.length) return null;
      [idx] = hits;
    }
    lines.splice(idx, h.added.length, ...h.removed);
    next[key] = lines.join("\n");
  }
  return next;
}
