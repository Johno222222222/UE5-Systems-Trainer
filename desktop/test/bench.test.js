"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { TEMPLATES } = require("../logic");

test("the bench has the 8 templates plus two extra systems", () => {
  const file = path.join(__dirname, "..", "..", "bench", "prompts.json");
  const bench = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(bench.target_unreal, "5.8");
  assert.equal(bench.prompts.length, 10);
  const byId = Object.fromEntries(bench.prompts.map((p) => [p.id, p]));
  for (const template of TEMPLATES) {
    assert.equal(byId[template.id].source, "template");
    assert.equal(byId[template.id].prompt, template.prompt);
    assert.equal(byId[template.id].default_class, template.default_class);
    assert.equal(byId[template.id].title, template.title);
  }
  assert.equal(byId.tactical_fps_weapon.source, "bench");
  assert.match(byId.tactical_fps_weapon.prompt, /weapon/i);
  assert.equal(byId.gas_character.source, "bench");
  assert.match(byId.gas_character.prompt, /Gameplay Ability System/);
  assert.equal(byId.gas_character.default_class, "Character");
  const doc = fs.readFileSync(path.join(__dirname, "..", "..", "bench", "BASELINE.md"), "utf8");
  assert.match(doc, /5\.8/);
  assert.match(doc, /first try/i);
});