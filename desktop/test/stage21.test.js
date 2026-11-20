"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildTracks, problemsForTracks, scoreQuestions } = require("../tracks");
const { enrichCourse } = require("../lessonStudy");
const { loadPacks } = require("../packs");
const { loadGlossary } = require("../glossary");
const { presentQuiz, positionShare, isTrueFalse } = require("../../frontend/src/lib/quizShuffle");
const { CATALOG_EXPLAIN, explainLine, headerNote } = require("../../frontend/src/lib/lineExplain");

function slotKey(prompt) {
  return String(prompt || "")
    .replace(/`[^`]*`/g, "CODE")
    .replace(/"[^"]*"/g, "QUOTE")
    .replace(/\b(?:FPS|TPS|Horror|Strategy|Beginner|Intermediate)\b/gi, "GENRE")
    .replace(/\b[A-Z][A-Za-z0-9_]{2,}/g, "NAME")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function allQuestions(tracks) {
  const rows = [];
  for (const track of tracks) {
    for (const section of track.sections) {
      for (const question of section.quiz) rows.push({ track: track.id, section: section.id, question });
    }
    for (const question of track.exam.questions) rows.push({ track: track.id, section: "exam", question });
  }
  return rows;
}

test("opened quizzes do not leave the correct answer on one position", () => {
  const tracks = buildTracks();
  const bank = allQuestions(tracks).map((row) => row.question);
  const raw = positionShare(bank);
  assert.ok(raw.share > 0.6, `authored bank should still cluster before shuffle, share ${raw.share}`);
  const opened = [];
  for (let seed = 1; seed <= 24; seed += 1) opened.push(...presentQuiz(bank, seed));
  const spread = positionShare(opened);
  assert.ok(spread.total > 1000, spread.total);
  assert.ok(spread.share < 0.4, `correct answers clustered at ${spread.share}`);
});

test("added questions are not title-swapped copies, and every lesson quiz is long enough", () => {
  const tracks = buildTracks();
  assert.deepEqual(problemsForTracks(tracks), []);
  const groups = new Map();
  for (const row of allQuestions(tracks)) {
    const question = row.question;
    assert.ok(question.prompt && question.choices.length >= 2, question.id);
    assert.ok(question.choices[question.answer], question.id);
    if (!String(question.id).includes("x119")) continue;
    const key = slotKey(question.prompt);
    if (key.split(" ").length < 8) continue;
    const list = groups.get(key) || [];
    list.push(`${row.track}/${row.section}`);
    groups.set(key, list);
  }
  for (const [key, list] of groups) {
    assert.ok(list.length <= 6, `${list.length} copies of ${key.slice(0, 140)}`);
  }
  for (const track of tracks) {
    assert.ok(track.exam.questions.length >= 48, `${track.id} exam ${track.exam.questions.length}`);
    for (const section of track.sections) {
      assert.ok(section.quiz.length >= 10, `${track.id} ${section.id} ${section.quiz.length}`);
      assert.ok(section.quiz.some(isTrueFalse), `${section.id} has no true/false`);
      assert.ok(section.quiz.some((q) => q.choices.length > 2), `${section.id} has no multiple choice`);
      assert.ok(section.quiz.some((q) => /what does this line mean/i.test(q.prompt)), `${section.id} has no C++ question`);
      assert.ok(section.quiz.some((q) => /node do/i.test(q.prompt)), `${section.id} has no graph question`);
      assert.equal(section.blanks.cpp.length, 3, section.id);
      assert.ok(section.blanks.nodes.length >= 2 && section.blanks.nodes.length <= 3, section.id);
      assert.ok(section.lineNotes.every((row) => row.note), `${section.id} line note`);
      const again = require("../lessonStudy").blanksFor(section);
      assert.deepEqual(again.cpp.map((row) => row.line), section.blanks.cpp.map((row) => row.line));
    }
  }
});

test("course sections use the lesson engine and do not share a templated quiz", () => {
  const packs = loadPacks();
  assert.deepEqual(packs.problems, []);
  for (const course of packs.courses) {
    const enriched = enrichCourse(course);
    assert.equal(enriched.sections.length, course.modules.length);
    const prompts = new Set();
    for (const section of enriched.sections) {
      assert.ok(section.quiz.length >= 10 && section.quiz.length <= 20, `${course.id} ${section.id} ${section.quiz.length}`);
      assert.ok(section.quiz.some(isTrueFalse), section.id);
      assert.ok(section.quiz.some((q) => q.choices.length > 2), section.id);
      assert.ok(section.cpp.length >= 3, section.id);
      assert.ok(section.lineNotes.every((row) => row.note), section.id);
      assert.equal(section.blanks.cpp.length, 3, section.id);
      for (const question of section.quiz) {
        const key = question.prompt.trim().toLowerCase();
        assert.ok(!prompts.has(key), `${course.id} duplicate ${key.slice(0, 80)}`);
        prompts.add(key);
      }
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
  assert.equal(explainLine("hold_time = 0.f;"), "start the hold timer at zero");
  assert.match(explainLine("void UKitComponent::Graph_IA_Reload_tpl_tacticalammo_input() // node:tpl_tactical-ammo_input"), /Graph_IA_Reload_tpl_tacticalammo_input/);
  assert.match(explainLine("if (GetOwner() && GetOwner()->HasAuthority())"), /authority/);
  assert.match(headerNote("GameFramework/DamageType.h"), /damage/i);
  assert.notEqual(headerNote("GameFramework/DamageType.h"), headerNote("NiagaraSystem.h"));
  assert.match(headerNote("NiagaraSystem.h"), /Niagara/i);
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
