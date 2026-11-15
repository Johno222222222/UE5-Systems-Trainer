// Manual C++ edits stay on the system until the user reverts or a new
// synthesis replaces them on purpose.

export function lineSpan(text, line) {
  const rows = String(text || "").split("\n");
  const count = Math.max(rows.length, 1);
  const n = Math.min(Math.max(1, Number(line) || 1), count);
  let from = 0;
  for (let i = 0; i < n - 1; i += 1) from += rows[i].length + 1;
  return { line: n, from, to: from + (rows[n - 1] || "").length };
}

export function applyManualEdit(system, file, text) {
  const current = system || {};
  const generated = current.generated_cpp || {
    header: current.cpp_header || "",
    source: current.cpp_source || "",
  };
  return {
    ...current,
    cpp_header: file === ".h" ? text : (current.cpp_header || ""),
    cpp_source: file === ".cpp" ? text : (current.cpp_source || ""),
    manual_cpp: true,
    generated_cpp: generated,
  };
}

export function revertManualEdit(system) {
  if (!system?.generated_cpp) return { ...(system || {}), manual_cpp: false };
  return {
    ...system,
    cpp_header: system.generated_cpp.header,
    cpp_source: system.generated_cpp.source,
    manual_cpp: false,
  };
}

export function synthesisAfterManual(body, system, choice) {
  if (choice !== "discard" || !system?.generated_cpp) return body;
  const previous = body?.previous_system && typeof body.previous_system === "object" ? body.previous_system : null;
  if (!previous) return body;
  return {
    ...body,
    previous_system: {
      ...previous,
      cpp_header: system.generated_cpp.header,
      cpp_source: system.generated_cpp.source,
      manual_cpp: false,
    },
  };
}
