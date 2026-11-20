"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { buildTracks, problemsForTracks, scoreQuestions } = require("../tracks");
const { enrichCourse } = require("../lessonStudy");
const { loadPacks } = require("../packs");
const { loadGlossary } = require("../glossary");
const { presentQuiz, positionShare, isTrueFalse } = require("../../frontend/src/lib/quizShuffle");
const { CATALOG_EXPLAIN, explainLine, headerNote } = require("../../frontend/src/lib/lineExplain");

function slot(prompt) {
  return String(prompt || "")
    .replace(/`[^`]*`/g, " ")
    .replace(/"[^"]*"/g, " ")
    .replace(/\b[A-Z][A-Za-z0-9_]{2,}/g, " ")
    .replace(/\b\d+(?:\.\d+)?f?\b/g, " ")
    .replace(/[^a-z\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isTf(question) {
  return isTrueFalse(question);
}

function collect() {
  const questions = [];
  const tracks = buildTracks();
  for (const track of tracks) {
    for (const section of track.sections) {
      for (const question of section.quiz) questions.push(question);
    }
    for (const question of track.exam.questions) questions.push(question);
  }
  for (const course of loadPacks().courses) {
    const enriched = enrichCourse(course);
    for (const section of enriched.sections) {
      for (const question of section.quiz) questions.push(question);
    }
  }
  return { tracks, questions };
}

test("opened quizzes do not leave the correct answer on one position", () => {
  const { questions } = collect();
  const opened = [];
  for (let seed = 1; seed <= 24; seed += 1) opened.push(...presentQuiz(questions, seed));
  const spread = positionShare(opened);
  assert.ok(spread.share < 0.4, `correct answers clustered at ${spread.share}`);
});

test("authored banks are not templated and every lesson meets its count", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "lessonStudy.js"), "utf8");
  assert.ok(!source.includes("fromSentence"), "questions must not be generated from lesson sentences");
  assert.ok(!source.includes("sentencesOf"));
  const { tracks, questions } = collect();
  assert.deepEqual(problemsForTracks(tracks), []);
  const distractors = new Map();
  const templates = new Map();
  let tf = 0;
  let tfTrue = 0;
  let mc = 0;
  for (const question of questions) {
    assert.ok(question.choices[question.answer], question.id);
    const key = slot(question.prompt);
    assert.ok(!templates.has(key), `shared template: ${key.slice(0, 140)}`);
    templates.set(key, question.id);
    if (isTf(question)) {
      tf += 1;
      if (question.answer === 0) tfTrue += 1;
    } else {
      mc += 1;
      question.choices.forEach((choice, index) => {
        if (index === question.answer) return;
        const text = String(choice).trim();
        distractors.set(text, (distractors.get(text) || 0) + 1);
      });
    }
  }
  for (const [text, count] of distractors) {
    assert.ok(count <= 2, `distractor used ${count} times: ${text.slice(0, 120)}`);
  }
  const trueShare = tfTrue / tf;
  assert.ok(trueShare >= 0.35 && trueShare <= 0.65, trueShare);
  assert.ok(mc / (mc + tf) >= 0.6, mc / (mc + tf));
  for (const track of tracks) {
    assert.ok(track.exam.questions.length >= 48, `${track.id} exam ${track.exam.questions.length}`);
    for (const section of track.sections) {
      assert.ok(section.quiz.length >= 10 && section.quiz.length <= 15, `${track.id} ${section.id}`);
      assert.ok(section.quiz.some(isTf) && section.quiz.some((q) => q.choices.length > 2), section.id);
      assert.ok(section.plainEnglish && section.whyGame, section.id);
      assert.ok(section.expansionExamples.length >= 2, section.id);
      assert.equal(section.blanks.cpp.length, 3, section.id);
      assert.ok(section.lineNotes.some((row) => /node:tpl_/.test(row.text) && row.note && !/function that node became/i.test(row.note)), section.id);
    }
  }
  const banks = fs.readdirSync(path.join(__dirname, "..", "..", "content", "study", "programs"));
  assert.ok(banks.length >= 8);
});

test("course sections use authored banks", () => {
  for (const course of loadPacks().courses) {
    const enriched = enrichCourse(course);
    assert.equal(enriched.sections.length, course.modules.length);
    for (const section of enriched.sections) {
      assert.ok(section.quiz.length >= 10 && section.quiz.length <= 20, `${course.id} ${section.id} ${section.quiz.length}`);
      assert.ok(section.plainEnglish && section.whyGame, section.id);
      assert.ok(section.quiz.some(isTf), section.id);
      assert.ok(fs.existsSync(path.join(__dirname, "..", "..", "content", "study", "courses", `${course.id}.json`)));
    }
  }
});

test("every generated line type has its own layman note", () => {
  const notes = new Map();
  for (const [catalog, note] of Object.entries(CATALOG_EXPLAIN)) {
    assert.ok(note.length > 20, catalog);
    assert.ok(!notes.has(note), `${catalog} repeats another note`);
    notes.set(note, catalog);
    assert.equal(explainLine("x", catalog), note);
  }
  const authored = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "content", "study", "nodes.json"), "utf8"));
  for (const catalog of Object.keys(CATALOG_EXPLAIN)) {
    assert.match(authored[catalog], /For example/, catalog);
  }
  assert.equal(explainLine("hold_time = 0.f;"), "start the hold timer at zero");
  const lines = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "content", "study", "lines.json"), "utf8"));
  assert.match(lines["tpl_tactical-ammo_setmag"], /magazine/i);
  assert.match(lines["tpl_replicated-health_auth"], /authority/i);
  assert.doesNotMatch(lines["tpl_interact_input"], /function that node became/i);
  assert.match(headerNote("GameFramework/DamageType.h"), /damage/i);
  assert.notEqual(headerNote("GameFramework/DamageType.h"), headerNote("NiagaraSystem.h"));
});

test("a shuffled answer still scores, and glossary see-also links resolve", () => {
  const tracks = buildTracks();
  const section = tracks[0].sections[0];
  const [shown] = presentQuiz(section.quiz, 7);
  const byText = { [shown.id]: shown.choices[shown.answer] };
  const scored = scoreQuestions(section.quiz, byText);
  assert.equal(scored.correct, 1);
  const glossary = loadGlossary();
  const ids = new Set(glossary.terms.map((term) => term.id));
  let links = 0;
  for (const term of glossary.terms) {
    for (const id of term.see || []) {
      links += 1;
      assert.ok(ids.has(id), `${term.id} see ${id}`);
    }
  }
  assert.ok(links > 20);
});
