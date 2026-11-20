"use strict";

// Loads authored program and course JSON and attaches figures from the real graphs.

const fs = require("fs");
const path = require("path");
const { loadGraph, renderGraph, hubSvg, cppExcerpt } = require("./lessonRender");

const GENRES = ["fps", "tps", "horror", "strategy"];
const LEVELS = ["beginner", "intermediate"];
const ROOT = path.join(__dirname, "..", "content");

function readDir(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith(".json")).sort().map((name) => {
    return JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
  });
}

function wordsOf(section) {
  const parts = [];
  for (const block of section.reading || []) {
    if (typeof block === "string") parts.push(block);
    else parts.push(`${block.heading || ""} ${block.body || ""}`);
  }
  return parts.join(" ").split(/\s+/).filter(Boolean).length;
}

function attach(track) {
  const spokes = (track.sections || []).map((section) => section.title);
  track.map = hubSvg(track.title, spokes).replace("depends on", `${track.genre} · depends on`);
  for (const section of track.sections || []) {
    const doc = loadGraph(section.graph);
    section.image = doc ? renderGraph(doc, { why: section.why || section.title }) : "";
    section.flow = hubSvg(section.title, section.depends || spokes);
    section.cpp = cppExcerpt(section.graph);
    section.words = wordsOf(section);
  }
  for (const question of track.exam?.questions || []) {
    if (question.graph) {
      const doc = loadGraph(question.graph);
      if (doc) question.figure = renderGraph(doc, { broken: question.kind === "graph-repair", why: question.sample || "" });
    }
  }
  return track;
}

function buildTracks() {
  return readDir(path.join(ROOT, "programs")).map(attach);
}

function buildCourses() {
  return readDir(path.join(ROOT, "courses")).map(attach);
}

function trackById(id) {
  return buildTracks().find((track) => track.id === id) || buildCourses().find((track) => track.id === id) || null;
}

function scoreQuestions(questions, answers) {
  const list = Array.isArray(questions) ? questions : [];
  const given = answers && typeof answers === "object" ? answers : {};
  let correct = 0;
  for (const question of list) {
    if (Number(given[question.id]) === question.answer) correct += 1;
  }
  const total = list.length;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  return { correct, total, percent, passed: percent >= 70 };
}

function problemsForTracks(tracks = buildTracks()) {
  const problems = [];
  const seen = new Set();
  for (const genre of GENRES) {
    for (const level of LEVELS) {
      if (!tracks.some((track) => track.genre === genre && track.level === level)) problems.push(`${genre} ${level} is missing`);
    }
  }
  const exams = [];
  for (const track of tracks) {
    if (seen.has(track.id)) problems.push(`repeated track ${track.id}`);
    seen.add(track.id);
    const prompts = new Set();
    let last = 0;
    const minQuiz = track.level === "intermediate" ? 8 : 5;
    const minExam = track.level === "intermediate" ? 30 : 20;
    if ((track.sections || []).length < 6 || (track.sections || []).length > 10) problems.push(`${track.id} needs 6 to 10 sections`);
    for (const section of track.sections || []) {
      if (section.order < last) problems.push(`${track.id} section ${section.id} is out of order`);
      last = section.order;
      if (wordsOf(section) < 300) problems.push(`${track.id} ${section.id} lesson is ${wordsOf(section)} words`);
      if (!section.assignment?.prompt || !section.assignment?.accept?.length || !section.assignment?.model) problems.push(`${track.id} ${section.id} assignment is incomplete`);
      if ((section.quiz || []).length < minQuiz) problems.push(`${track.id} ${section.id} quiz is short`);
      if (!section.image || !section.image.includes("<svg") || (section.image.match(/<rect /g) || []).length < 4) problems.push(`${track.id} ${section.id} graph image is not a real graph`);
      if (!section.cpp || section.cpp.length < 3) problems.push(`${track.id} ${section.id} has no C++ excerpt`);
      for (const question of section.quiz || []) {
        const key = String(question.prompt || "").trim().toLowerCase();
        if (prompts.has(key)) problems.push(`${track.id} repeats prompt ${key.slice(0, 80)}`);
        prompts.add(key);
      }
    }
    if ((track.exam?.questions || []).length < minExam) problems.push(`${track.id} exam is short`);
    let repairs = 0;
    for (const question of track.exam?.questions || []) {
      const key = String(question.prompt || "").trim().toLowerCase();
      if (prompts.has(key)) problems.push(`${track.id} exam repeats ${key.slice(0, 80)}`);
      prompts.add(key);
      if (question.kind === "graph-repair" || question.kind === "cpp-repair") {
        repairs += 1;
        if (!question.sample) problems.push(`${track.id} ${question.id} repair has no sample`);
        if (question.kind === "graph-repair") {
          const sample = String(question.sample || "").replace(/\s+/g, " ").trim().slice(0, 20);
          if (!question.figure || !question.figure.includes("<svg") || !sample || !question.figure.includes(sample)) {
            problems.push(`${track.id} ${question.id} repair graph does not show its broken sample`);
          }
        }
      }
    }
    if (repairs < 4) problems.push(`${track.id} exam needs several repairs`);
    exams.push({ id: track.id, prompts: [...prompts] });
  }
  for (let i = 0; i < exams.length; i += 1) {
    for (let j = i + 1; j < exams.length; j += 1) {
      const a = new Set(exams[i].prompts);
      const shared = exams[j].prompts.filter((prompt) => a.has(prompt));
      const ratio = shared.length / Math.min(a.size, exams[j].prompts.length);
      if (ratio > 0.2) problems.push(`${exams[i].id} and ${exams[j].id} share ${shared.length} prompts`);
    }
  }
  return problems;
}

module.exports = {
  GENRES,
  LEVELS,
  buildTracks,
  buildCourses,
  trackById,
  scoreQuestions,
  problemsForTracks,
  wordsOf,
};
