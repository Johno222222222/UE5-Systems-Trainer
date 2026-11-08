const DIALS = [
  ["complexity", "Complexity"],
  ["modularity", "Modularity"],
  ["performance_vs_flexibility", "Perf ↔ Flex"],
  ["tick_rate", "Tick Rate (Hz)"],
];

// Lists every edit made since the last synthesis, phrased as instructions for the model
export function computeChanges(result, current) {
  if (!result) return [];
  const base = result.context || {};
  const out = [];
  if (base.prompt !== undefined && current.prompt.trim() !== (base.prompt || "").trim()) {
    out.push({ kind: "prompt", text: `Description changed to: "${current.prompt.trim()}"` });
  }
  if (base.blueprint_class && current.blueprint_class !== base.blueprint_class) {
    out.push({ kind: "dial", text: `Change base class from ${base.blueprint_class} to ${current.blueprint_class}` });
  }
  if (base.network_replicated !== undefined && current.network_replicated !== base.network_replicated) {
    out.push({ kind: "dial", text: current.network_replicated ? "Make the system network replicated" : "Remove network replication (local only)" });
  }
  DIALS.forEach(([key, label]) => {
    if (base[key] !== undefined && current[key] !== base[key]) {
      out.push({ kind: "dial", text: `${label} ${base[key]} → ${current[key]}` });
    }
  });
  (result.tunable_parameters || []).forEach((p) => {
    const v = current.params[p.key];
    if (v !== undefined && Number(v) !== Number(p.value)) {
      out.push({ kind: "param", text: `Set ${p.label || p.key} (${p.key}) = ${v}${p.unit ? ` ${p.unit}` : ""} (was ${p.value})` });
    }
  });
  const original = Object.fromEntries((result.baseline_modules || result.modules || []).map((m) => [m.name, m.included]));
  (result.modules || []).forEach((m) => {
    if (original[m.name] === true && !m.included) out.push({ kind: "module", text: `Remove module ${m.name}` });
    if (original[m.name] === false && m.included) out.push({ kind: "module", text: `Re-enable module ${m.name}` });
  });
  const known = new Set([...(result.modules || []).map((m) => m.name), ...(base.extra_modules || [])]);
  current.extra.filter((x) => !known.has(x)).forEach((x) => out.push({ kind: "module", text: `Add new module ${x}` }));
  if (current.notes.trim()) out.push({ kind: "note", text: `Designer note: ${current.notes.trim()}` });
  return out;
}

// Line diff (LCS) paired into side-by-side rows: {left, right, type: same|change|del|add}
export function sideBySideDiff(a = "", b = "") {
  const A = a.split("\n");
  const B = b.split("\n");
  const n = A.length, m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const rows = [];
  let dels = [], adds = [];
  const flush = () => {
    const k = Math.max(dels.length, adds.length);
    for (let x = 0; x < k; x++) {
      const l = dels[x], r = adds[x];
      rows.push({ left: l, right: r, type: l !== undefined && r !== undefined ? "change" : l !== undefined ? "del" : "add" });
    }
    dels = []; adds = [];
  };
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) { flush(); rows.push({ left: A[i], right: B[j], type: "same" }); i++; j++; }
    else if (j < m && (i >= n || dp[i][j + 1] >= dp[i + 1][j])) { adds.push(B[j]); j++; }
    else { dels.push(A[i]); i++; }
  }
  flush();
  return rows;
}

export function compactForApi(sys) {
  return {
    system_name: sys.system_name,
    summary: sys.summary,
    modules: (sys.modules || []).map((m) => ({ name: m.name, included: m.included })),
    tunable_parameters: sys.tunable_parameters || [],
    network_notes: sys.network_notes,
    cpp_header: (sys.cpp_header || "").slice(0, 4000),
  };
}
