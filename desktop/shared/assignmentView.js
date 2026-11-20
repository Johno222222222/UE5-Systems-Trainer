"use strict";

// Shared blanking rules for the practice assignment. The lesson screen and the
// tests both use this so a blank sits inside the real C++ and the real graph.

function visibleCppLines(notes, blanks, revealed) {
  const hidden = new Set((blanks?.cpp || []).map((row) => row.line));
  return (notes || []).map((row) => ({
    line: row.line,
    text: !revealed && hidden.has(row.line) ? "________" : row.text,
    blank: hidden.has(row.line),
  }));
}

function visibleGraphNodes(nodes, blanks, revealed) {
  const hidden = new Set((blanks?.nodes || []).flatMap((node) => [node.key, node.label].filter(Boolean)));
  return (nodes || []).map((node) => {
    const key = node.key || node.label;
    const blank = hidden.has(key) || hidden.has(node.label);
    return {
      key,
      label: !revealed && blank ? "Blank node" : node.label,
      blank,
    };
  });
}

module.exports = { visibleCppLines, visibleGraphNodes };
