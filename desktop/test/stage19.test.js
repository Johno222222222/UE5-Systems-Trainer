"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { attachStarters, PACKS } = require("../templateLearning");
const { TEMPLATES } = require("../logic");
const { composeStack } = require("../stackMap");
const { catalog } = require("../references");

function strip(text) {
  return String(text || "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, "")
    .replace(/"(?:\\.|[^"\\])*"/g, "\"\"");
}

function declaredNames(text) {
  const names = new Set();
  const code = strip(text);
  for (const match of code.matchAll(/\b(?:class|struct|enum)\s+(?:[A-Z0-9_]+_API\s+)?([A-Za-z_]\w*)/g)) names.add(match[1]);
  for (const match of code.matchAll(/\b[A-Za-z_]\w*(?:<[^>\n]+>)?\s*(?:\*+|\&)?\s*([A-Za-z_]\w*)\s*(?:=|;|,|\))/g)) {
    names.add(match[1]);
  }
  return names;
}

function memberUses(source) {
  const code = strip(source);
  const uses = new Set();
  for (const match of code.matchAll(/(?:^|[^:\w])([A-Za-z_]\w*)\s*(?:\+\+|--|->|\.)/g)) uses.add(match[1]);
  for (const match of code.matchAll(/(?:^|[^:\w])([A-Za-z_]\w*)\s*=(?!=)/g)) uses.add(match[1]);
  for (const match of code.matchAll(/[(,]\s*([A-Za-z_]\w*)\s*(?=[,)])/g)) uses.add(match[1]);
  return [...uses];
}

function undeclaredMembers(header, source) {
  const known = declaredNames(`${header}\n${source}`);
  return memberUses(source).filter((name) => !known.has(name));
}

test("preset and stacked C++ do not use an undeclared member", () => {
  const starters = attachStarters(TEMPLATES);
  assert.equal(PACKS.length, starters.filter((item) => item.starter).length);
  for (const template of starters) {
    const system = template.starter;
    assert.ok(system, template.id);
    const missing = undeclaredMembers(system.cpp_header, system.cpp_source);
    assert.deepEqual(missing, [], `${template.id} uses ${missing.join(", ")}`);
    assert.doesNotMatch(system.cpp_source, /\n\};/);
  }
  const combat = starters.find((item) => item.id === "combat").starter;
  assert.match(combat.cpp_header, /int32 ComboIndex = 0;/);
  assert.match(combat.cpp_source, /ComboIndex\+\+;/);

  const examples = catalog().examples.filter((item) => item.starter?.cpp_header);
  for (let i = 0; i < examples.length; i += 1) {
    for (let j = i + 1; j < examples.length; j += 1) {
      const stacked = composeStack([examples[i].starter, examples[j].starter], { name: "Pair" });
      const known = declaredNames(`${stacked.system.cpp_header}\n${stacked.system.cpp_source}`);
      const bumped = [...strip(stacked.system.cpp_source).matchAll(/\b([A-Za-z_]\w*)\s*\+\+/g)].map((match) => match[1]);
      const missing = bumped.filter((name) => !known.has(name));
      assert.deepEqual(missing, [], `${examples[i].title} + ${examples[j].title} increments ${missing.join(", ")}`);
      assert.doesNotMatch(stacked.system.cpp_source, /GetLifetimeReplicatedProps[\s\S]*?\n\};/);
    }
  }
});
