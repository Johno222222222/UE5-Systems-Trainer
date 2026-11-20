"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { buildTracks } = require("../tracks");
const { loadPacks } = require("../packs");

const AFFIRMED = new Set([
  "true or false: mapping contexts let one input action serve a keyboard and a gamepad.",
  "true or false: a miss should still heat the barrel, while damage waits for the hit.",
  "true or false: equippedid, heat, and the limb floats are worth packing, and the animation pose is not.",
  "true or false: the server struct is what both strategy clients load.",
  "true or false: a third-person miss should still heat the barrel.",
  "true or false: equippedid is enough to rebuild the ten slots after load.",
]);

function questionsOf() {
  const found = [];
  for (const track of buildTracks()) {
    for (const section of track.sections || []) {
      for (const question of section.quiz || []) found.push([`${track.id} ${section.id}`, question]);
    }
    for (const question of track.exam?.questions || []) found.push([`${track.id} exam`, question]);
  }
  for (const course of loadPacks().courses) {
    for (const mod of course.modules || []) {
      for (const question of mod.quiz || []) found.push([`${course.id} ${mod.id}`, question]);
    }
  }
  return found;
}

test("true/false keys point at the claim's real polarity", () => {
  let seen = 0;
  for (const [where, question] of questionsOf()) {
    const choices = (question.choices || []).map((item) => String(item).trim().toLowerCase());
    if (choices.length !== 2 || !choices.includes("true") || !choices.includes("false")) continue;
    if (String(question.id || "").startsWith("study-") || /-(s|c)\d/.test(String(question.id || ""))) continue;
    const prompt = String(question.prompt || "").trim().toLowerCase();
    assert.ok(prompt.startsWith("true or false:"), `${where} looks like true/false without the prompt`);
    const picked = choices[question.answer];
    const expect = AFFIRMED.has(prompt) ? "true" : "false";
    assert.equal(picked, expect, `${where}: ${prompt} keyed ${picked}`);
    seen += 1;
  }
  assert.ok(seen >= 9, `expected the course true/false questions, saw ${seen}`);
});

test("every multiple-choice key is inside its choices", () => {
  for (const [where, question] of questionsOf()) {
    assert.ok(Number.isInteger(question.answer), where);
    assert.ok(question.answer >= 0 && question.answer < question.choices.length, `${where} answer ${question.answer}`);
  }
});

test("courses cover general and the four genres at both levels", () => {
  const packs = loadPacks();
  assert.deepEqual(packs.problems, []);
  const wanted = {
    "general-beginner": ["general", "beginner"],
    "general-intermediate": ["general", "intermediate"],
    "data-driven": ["general", "beginner"],
    "gas-basics": ["general", "intermediate"],
    "replication-basics": ["general", "intermediate"],
    "fps-beginner": ["fps", "beginner"],
    "tactical-fps-course": ["fps", "intermediate"],
    "tps-beginner": ["tps", "beginner"],
    "tps-intermediate": ["tps", "intermediate"],
    "horror-beginner": ["horror", "beginner"],
    "horror-intermediate": ["horror", "intermediate"],
    "strategy-beginner": ["strategy", "beginner"],
    "strategy-intermediate": ["strategy", "intermediate"],
  };
  for (const [id, [genre, level]] of Object.entries(wanted)) {
    const course = packs.courses.find((item) => item.id === id);
    assert.ok(course, id);
    assert.equal(course.genre, genre, id);
    assert.equal(course.level, level, id);
    assert.ok(course.modules.length >= 3 && course.modules.length <= 5, id);
    for (const mod of course.modules) {
      assert.ok(mod.takeaway && mod.assignment?.accept?.length && mod.diff?.left?.code && mod.diff?.right?.code, `${id} ${mod.id}`);
      assert.ok(mod.quiz.length >= 1, mod.id);
    }
  }
  for (const course of packs.courses) {
    assert.ok(["general", "fps", "tps", "horror", "strategy"].includes(course.genre), course.id);
    assert.ok(["beginner", "intermediate"].includes(course.level), course.id);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8"));
  assert.ok(pkg.build.files.some((item) => String(item).includes("content/packs")));
  assert.ok(fs.existsSync(path.join(__dirname, "..", "..", "content", "packs", "genre-courses.json")));
});

test("broken exam graphs show the question's own sample", () => {
  for (const track of buildTracks()) {
    const repairs = (track.exam?.questions || []).filter((item) => item.kind === "graph-repair");
    assert.ok(repairs.length >= 2, track.id);
    const figures = repairs.map((question) => {
      const sample = String(question.sample).replace(/\s+/g, " ").trim();
      assert.ok(question.figure.includes(sample.slice(0, 20)), `${track.id} ${question.id}`);
      return question.figure;
    });
    assert.equal(new Set(figures).size, figures.length, `${track.id} reused one broken graph`);
  }
});

test("program lessons link glossary text and leave the C++ excerpt plain", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "shell", "LessonStudio.jsx"), "utf8");
  assert.match(source, /GlossaryText text=\{body\}/);
  assert.match(source, /GlossaryText text=\{task\.prompt\}/);
  assert.match(source, /GlossaryText text=\{question\.prompt\}/);
  const cpp = source.slice(source.indexOf('data-testid="track-cpp"'), source.indexOf('data-testid="track-cpp"') + 500);
  assert.ok(!cpp.includes("GlossaryText"));
  assert.match(fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "shell", "Programs.jsx"), "utf8"), /LessonStudio/);
  const learn = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "shell", "Learn.jsx"), "utf8");
  assert.match(learn, /data-testid="learn-thumbs"/);
  assert.ok(!learn.includes('className={`chip ${pane'));
});
