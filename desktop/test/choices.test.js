"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

async function load() {
  return import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "choices.mjs")).href);
}

test("a choice shows selected before it is checked, then correct or incorrect", async () => {
  const { choiceMark, choiceNote } = await load();
  assert.equal(choiceMark({ id: 0, picked: null, correct: 0, revealed: false }), "idle");
  assert.equal(choiceMark({ id: 1, picked: 1, correct: 0, revealed: false }), "selected");
  assert.equal(choiceMark({ id: 0, picked: 1, correct: 0, revealed: false }), "idle");
  assert.equal(choiceMark({ id: "right", picked: "right", correct: "left", revealed: false }), "selected");

  assert.equal(choiceMark({ id: 0, picked: 1, correct: 0, revealed: true }), "correct");
  assert.equal(choiceMark({ id: 1, picked: 1, correct: 0, revealed: true }), "incorrect");
  assert.equal(choiceMark({ id: 2, picked: 1, correct: 0, revealed: true }), "idle");
  assert.equal(choiceMark({ id: "left", picked: "right", correct: "left", revealed: true }), "correct");
  assert.equal(choiceMark({ id: "right", picked: "right", correct: "left", revealed: true }), "incorrect");

  assert.equal(choiceNote({ picked: null, correct: 0, why: "Tick is too often.", revealed: true }), "");
  assert.equal(choiceNote({ picked: 0, correct: 0, why: "Tick is too often.", revealed: false }), "");
  assert.equal(choiceNote({ picked: 0, correct: 0, why: "Tick is too often.", revealed: true }), "That's the one.");
  assert.equal(choiceNote({ picked: 1, correct: 0, why: "Tick is too often.", revealed: true }), "Tick is too often.");
  assert.equal(choiceNote({
    picked: "right",
    correct: "left",
    why: "The right side ticks.",
    revealed: true,
    wrongText: "The diff is the other side.",
  }), "The diff is the other side.");
});
