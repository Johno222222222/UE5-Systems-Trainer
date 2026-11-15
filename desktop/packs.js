"use strict";

// Lesson packs are plain JSON files. The server reads the folder at startup.
// Dropping a new .json file into the folder is enough. No code change.

const fs = require("fs");
const path = require("path");

const DEFAULT_PACKS_DIR = path.join(__dirname, "..", "content", "packs");

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function problemsForProgram(program, file) {
  const problems = [];
  const where = `${file} program ${program?.id || "?"}`;
  if (!program?.id || !program?.title) problems.push(`${where} needs an id and a title`);
  const modules = asList(program?.modules);
  if (!modules.length) problems.push(`${where} needs a module`);
  for (const mod of modules) {
    for (const step of asList(mod?.steps)) {
      if (!step?.predict?.prompt || !Array.isArray(step?.predict?.choices) || step.predict.choices.length < 2) {
        problems.push(`${where} step ${step?.id || "?"} needs a predict question`);
      }
      if (!step?.why || !step?.task) problems.push(`${where} step ${step?.id || "?"} needs a why and a task`);
      const reveal = step?.reveal;
      const revealed = asList(reveal?.nodes).length + asList(reveal?.functions).length;
      if (!revealed) problems.push(`${where} step ${step?.id || "?"} reveals nothing`);
    }
  }
  if (asList(program?.modify_tasks).length < 5) problems.push(`${where} needs at least 5 modify tasks`);
  for (const task of asList(program?.modify_tasks)) {
    if (!task?.id || !task?.pass) problems.push(`${where} task ${task?.id || "?"} needs a pass rule`);
  }
  if (asList(program?.compares).length < 1) problems.push(`${where} needs a compare`);
  const mapIds = new Set(asList(program?.map?.nodes).map((node) => node.id));
  for (const id of ["input", "interaction", "health", "ui"]) {
    if (!mapIds.has(id)) problems.push(`${where} map is missing ${id}`);
  }
  if (!program?.starter?.system_name || !program?.starter?.cpp_header || !program?.starter?.cpp_source) {
    problems.push(`${where} needs a starter project`);
  }
  return problems;
}

function problemsForCourse(course, file) {
  const problems = [];
  const where = `${file} course ${course?.id || "?"}`;
  if (!course?.id || !course?.title) problems.push(`${where} needs an id and a title`);
  const modules = asList(course?.modules);
  if (modules.length < 4) problems.push(`${where} needs at least 4 modules`);
  for (const mod of modules) {
    if (!mod?.takeaway) problems.push(`${where} module ${mod?.id || "?"} needs a takeaway`);
    if (!mod?.assignment?.prompt || !asList(mod?.assignment?.accept).length) problems.push(`${where} module ${mod?.id || "?"} needs an assignment`);
    if (!asList(mod?.quiz).length) problems.push(`${where} module ${mod?.id || "?"} needs a quiz`);
    for (const question of asList(mod?.quiz)) {
      if (!question?.review_prompt) problems.push(`${where} question ${question?.id || "?"} needs a reworded review prompt`);
      if (!Array.isArray(question?.choices) || !Number.isInteger(question?.answer)) problems.push(`${where} question ${question?.id || "?"} needs choices`);
    }
    if (!mod?.diff?.left?.code || !mod?.diff?.right?.code || (mod?.diff?.bug !== "left" && mod?.diff?.bug !== "right")) {
      problems.push(`${where} module ${mod?.id || "?"} needs a diff quiz`);
    }
  }
  return problems;
}

function loadPacks(dir = DEFAULT_PACKS_DIR) {
  const programs = [];
  const courses = [];
  const files = [];
  const problems = [];
  if (!dir || !fs.existsSync(dir)) return { programs, courses, files, problems, dir };
  const names = fs.readdirSync(dir).filter((name) => name.endsWith(".json")).sort();
  for (const name of names) {
    const full = path.join(dir, name);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(full, "utf8"));
    } catch (exc) {
      problems.push(`${name} is not readable JSON (${exc.message})`);
      continue;
    }
    files.push(name);
    for (const program of asList(parsed.programs)) {
      const found = problemsForProgram(program, name);
      if (found.length) problems.push(...found);
      else if (!programs.some((item) => item.id === program.id)) programs.push(program);
      else problems.push(`${name} repeats program ${program.id}`);
    }
    for (const course of asList(parsed.courses)) {
      const found = problemsForCourse(course, name);
      if (found.length) problems.push(...found);
      else if (!courses.some((item) => item.id === course.id)) courses.push(course);
      else problems.push(`${name} repeats course ${course.id}`);
    }
  }
  return { programs, courses, files, problems, dir };
}

function programById(catalog, id) {
  return catalog.programs.find((item) => item.id === id) || null;
}

function courseById(catalog, id) {
  return catalog.courses.find((item) => item.id === id) || null;
}

function taskById(program, id) {
  return asList(program?.modify_tasks).find((item) => item.id === id) || null;
}

module.exports = {
  DEFAULT_PACKS_DIR,
  loadPacks,
  programById,
  courseById,
  taskById,
  problemsForProgram,
  problemsForCourse,
};
