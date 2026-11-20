"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { buildTracks, problemsForTracks, scoreQuestions } = require("../tracks");
const { enrichCourse } = require("../lessonStudy");
const { loadPacks } = require("../packs");
const { loadGlossary } = require("../glossary");
const { presentQuiz, positionShare, isTrueFalse } = require("../shared/quizShuffle");
const { CATALOG_EXPLAIN, explainLine, headerNote } = require("../shared/lineExplain");

function normClause(text) {
  return String(text || "")
    .replace(/\b[A-Z][A-Za-z0-9_]*\b/g, " ")
    .replace(/\b\d+(?:\.\d+)?f?\b/g, " ")
    .replace(/[^a-z\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function clauses(text) {
  return String(text || "")
    .split(/\.\s+|\s+—\s+|,|\s+because\s+|\s+so\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function firstClause(text) {
  return normClause(clauses(text)[0] || "");
}

function lastClause(text) {
  const parts = clauses(text);
  return normClause(parts[parts.length - 1] || "");
}

function firstSix(text) {
  return normClause(text).split(" ").filter(Boolean).slice(0, 6).join(" ");
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

function trueCount(questions) {
  let trues = 0;
  let total = 0;
  for (const question of questions) {
    if (!isTf(question)) continue;
    total += 1;
    if (String(question.choices[question.answer]).trim().toLowerCase() === "true") trues += 1;
  }
  return { trues, total, share: total ? trues / total : 0 };
}

test("true and false stay between 40 and 60 percent", () => {
  const { questions } = collect();
  const overall = trueCount(questions);
  assert.ok(overall.share >= 0.4 && overall.share <= 0.6, `overall true share ${overall.share}`);
  const root = path.join(__dirname, "..", "..", "content", "study");
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!name.endsWith(".json")) continue;
      const bank = JSON.parse(fs.readFileSync(full, "utf8"));
      const stored = [];
      for (const section of Object.values(bank.sections || {})) stored.push(...(section.quiz || []));
      stored.push(...(bank.exam || []));
      for (const mod of Object.values(bank.modules || {})) stored.push(...(mod.quiz || []));
      const fileShare = trueCount(stored);
      if (fileShare.total < 8) continue;
      assert.ok(fileShare.share >= 0.4 && fileShare.share <= 0.6, `${path.relative(root, full)} true share ${fileShare.share}`);
    }
  }
  walk(root);
});

test("each study bank is shuffled through the quiz path", () => {
  const studio = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "shell", "LessonStudio.jsx"), "utf8");
  const programs = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "shell", "Programs.jsx"), "utf8");
  const courses = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "shell", "Courses.jsx"), "utf8");
  const learn = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "shell", "Learn.jsx"), "utf8");
  assert.match(studio, /presentQuiz\(source, seed\)/);
  assert.match(studio, /examMode \? \(examQuestions/);
  assert.match(programs, /LessonStudio/);
  assert.match(programs, /examQuestions=\{track\.exam\?\.questions/);
  assert.match(courses, /LessonStudio/);
  assert.match(learn, /presentQuiz\(learnQuestions/);
  const banks = [];
  const { tracks } = collect();
  for (const track of tracks) {
    for (const section of track.sections) banks.push([`${track.id} ${section.id}`, section.quiz]);
    banks.push([`${track.id} exam`, track.exam.questions]);
  }
  for (const course of loadPacks().courses) {
    const enriched = enrichCourse(course);
    for (const section of enriched.sections) banks.push([`${course.id} ${section.id}`, section.quiz]);
  }
  assert.ok(banks.length >= 60);
  for (const [name, questions] of banks) {
    const indexes = [];
    for (const seed of [1, 2, 3, 8, 21, 99]) {
      for (const shown of presentQuiz(questions, seed)) {
        if ((shown.choices || []).length < 2) continue;
        indexes.push(Number(shown.answer));
      }
    }
    assert.ok(new Set(indexes).size >= 2, `${name} correct answer did not move`);
    assert.ok(indexes.some((index) => index !== 0), `${name} stayed on the first choice`);
  }
});

test("the keyed choice is the longest in at most 45 percent of questions", () => {
  const { questions } = collect();
  let multiple = 0;
  let longest = 0;
  for (const question of questions) {
    if (isTf(question) || (question.choices || []).length < 3) continue;
    multiple += 1;
    const lengths = question.choices.map((choice) => String(choice).trim().length);
    const longestOther = Math.max(...lengths.filter((_, index) => index !== question.answer));
    if (lengths[question.answer] > longestOther) longest += 1;
  }
  const share = longest / multiple;
  assert.ok(share <= 0.45, `longest correct share ${share}`);
});

test("authored banks are specific and every lesson meets its count", () => {
  const { tracks, questions } = collect();
  assert.deepEqual(problemsForTracks(tracks), []);
  const distractors = new Map();
  const openings = new Map();
  const endings = new Map();
  for (const question of questions) {
    assert.ok(question.choices[question.answer], question.id);
    const opening = firstSix(question.prompt) || "(empty)";
    const ending = lastClause(question.prompt) || "(empty)";
    openings.set(opening, (openings.get(opening) || 0) + 1);
    endings.set(ending, (endings.get(ending) || 0) + 1);
    if (isTf(question)) {
      const length = String(question.prompt || "").trim().split(/\s+/).length;
      assert.ok(length <= 30, `${question.id} true/false is ${length} words`);
      continue;
    }
    question.choices.forEach((choice, index) => {
      if (index === question.answer) return;
      const key = firstClause(choice) || "(empty)";
      if (!distractors.has(key)) distractors.set(key, []);
      distractors.get(key).push(`${question.id}: ${choice}`);
    });
  }
  for (const [key, uses] of distractors) {
    assert.ok(uses.length <= 3, `distractor clause "${key}" used ${uses.length} times`);
  }
  for (const [key, count] of openings) {
    assert.ok(count <= 5, `stem opening "${key}" used ${count} times`);
  }
  for (const [key, count] of endings) {
    assert.ok(count <= 5, `stem ending "${key}" used ${count} times`);
  }
  for (const track of tracks) {
    assert.ok(track.exam.questions.length >= 40 && track.exam.questions.length <= 50, `${track.id} exam ${track.exam.questions.length}`);
    for (const section of track.sections) {
      assert.ok(section.quiz.length >= 10, `${track.id} ${section.id} ${section.quiz.length}`);
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

test("no script in the repo emits quiz prompts", () => {
  const root = path.join(__dirname, "..", "..");
  const banned = ["fromSentence", "sentencesOf", "sectionQuiz", "courseQuiz", "function keeps(", "function breaks("];
  const hits = [];
  function walk(dir) {
    for (const name of fs.readdirSync(dir)) {
      if (name === "node_modules" || name === ".git") continue;
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(js|mjs|cjs)$/.test(name)) continue;
      if (full.endsWith(`${path.sep}stage21.test.js`)) continue;
      const source = fs.readFileSync(full, "utf8");
      for (const token of banned) {
        if (source.includes(token)) hits.push(`${path.relative(root, full)} contains ${token}`);
      }
    }
  }
  walk(root);
  assert.deepEqual(hits, []);
});

test("course sections use authored banks", () => {
  for (const course of loadPacks().courses) {
    const enriched = enrichCourse(course);
    assert.equal(enriched.sections.length, course.modules.length);
    for (const section of enriched.sections) {
      assert.ok(section.quiz.length >= 10, `${course.id} ${section.id} ${section.quiz.length}`);
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
