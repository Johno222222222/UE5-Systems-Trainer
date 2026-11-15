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

function existsDir(dir) {
  try { return !!(dir && fs.existsSync(dir) && fs.statSync(dir).isDirectory()); }
  catch { return false; }
}

// A packaged app keeps the shipped packs inside the app (asar or resources).
// Dev and tests still find them next to this file. process.cwd() is never used.
function bundledPackCandidates({ appPath, resourcesPath } = {}) {
  const candidates = [];
  if (appPath) candidates.push(path.join(appPath, "content", "packs"));
  if (resourcesPath) {
    candidates.push(path.join(resourcesPath, "app.asar", "content", "packs"));
    candidates.push(path.join(resourcesPath, "app", "content", "packs"));
  }
  candidates.push(DEFAULT_PACKS_DIR);
  return candidates;
}

function userPackDir(userData) {
  return userData ? path.join(userData, "packs") : null;
}

function loadPacks(dir = DEFAULT_PACKS_DIR) {
  const programs = [];
  const courses = [];
  const files = [];
  const problems = [];
  if (!existsDir(dir)) {
    return {
      programs,
      courses,
      files,
      problems: [`Lesson packs folder was not found: ${dir || "(none)"}`],
      dir: dir || null,
    };
  }
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

function loadPackSources({ appPath, resourcesPath, userData, packsDir } = {}) {
  if (packsDir) return { ...loadPacks(packsDir), dirs: [packsDir] };
  const candidates = bundledPackCandidates({ appPath, resourcesPath });
  const bundled = candidates.find((dir) => existsDir(dir)) || null;
  const dirs = [];
  if (bundled) dirs.push(bundled);
  const user = userPackDir(userData);
  if (user && existsDir(user)) dirs.push(user);
  if (!dirs.length) {
    return {
      programs: [],
      courses: [],
      files: [],
      problems: [`No lesson packs folder was found. Looked in: ${candidates.join("; ")}`],
      dir: null,
      dirs: candidates,
    };
  }
  const merged = { programs: [], courses: [], files: [], problems: [], dir: dirs[0], dirs };
  for (const dir of dirs) {
    const one = loadPacks(dir);
    merged.problems.push(...one.problems);
    for (const name of one.files) merged.files.push(name);
    for (const program of one.programs) {
      if (merged.programs.some((item) => item.id === program.id)) merged.problems.push(`Repeats program ${program.id}`);
      else merged.programs.push(program);
    }
    for (const course of one.courses) {
      if (merged.courses.some((item) => item.id === course.id)) merged.problems.push(`Repeats course ${course.id}`);
      else merged.courses.push(course);
    }
  }
  return merged;
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
  bundledPackCandidates,
  userPackDir,
  loadPacks,
  loadPackSources,
  programById,
  courseById,
  taskById,
  problemsForProgram,
  problemsForCourse,
};
