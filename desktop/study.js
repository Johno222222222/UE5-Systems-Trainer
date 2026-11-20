"use strict";

// Stage 5 study rules. Checking a task, scoring a quiz, and scheduling a
// review never call the model. Old libraries have no study block and still open.

function emptyStudy() {
  return {
    session: 0,
    launch_id: "",
    programs: {},
    courses: {},
    reviews: [],
  };
}

function ensureStudy(progress) {
  const base = progress && typeof progress === "object" && !Array.isArray(progress) ? progress : {};
  if (!Array.isArray(base.answered)) base.answered = [];
  if (!Array.isArray(base.practiced)) base.practiced = [];
  if (!base.study || typeof base.study !== "object" || Array.isArray(base.study)) base.study = emptyStudy();
  const study = base.study;
  if (!Number.isInteger(study.session) || study.session < 0) study.session = 0;
  if (typeof study.launch_id !== "string") study.launch_id = "";
  if (!study.programs || typeof study.programs !== "object") study.programs = {};
  if (!study.courses || typeof study.courses !== "object") study.courses = {};
  if (!Array.isArray(study.reviews)) study.reviews = [];
  return base;
}

function same(value, expected) {
  if (typeof expected === "number") return Number(value) === expected && value !== "" && value !== null && value !== undefined;
  if (typeof expected === "boolean") return value === expected;
  return value === expected;
}

function matches(value, rule) {
  if (Object.prototype.hasOwnProperty.call(rule, "eq")) return same(value, rule.eq);
  if (Object.prototype.hasOwnProperty.call(rule, "gte")) return Number(value) >= Number(rule.gte);
  if (Object.prototype.hasOwnProperty.call(rule, "lte")) return Number(value) <= Number(rule.lte);
  if (Object.prototype.hasOwnProperty.call(rule, "neq")) return !same(value, rule.neq);
  return false;
}

// A task passes only when every clause matches. Anything else fails.
function evaluateRule(rule, settings) {
  if (!rule || typeof rule !== "object") return { pass: false, failed: [] };
  if (Array.isArray(rule.all)) {
    const parts = rule.all.map((part) => evaluateRule(part, settings || {}));
    return {
      pass: parts.every((part) => part.pass),
      failed: parts.flatMap((part) => part.failed),
    };
  }
  if (Array.isArray(rule.any)) {
    const parts = rule.any.map((part) => evaluateRule(part, settings || {}));
    const pass = parts.some((part) => part.pass);
    return { pass, failed: pass ? [] : parts.flatMap((part) => part.failed) };
  }
  if (rule.key) {
    const pass = matches(settings ? settings[rule.key] : undefined, rule);
    return { pass, failed: pass ? [] : [rule.key] };
  }
  return { pass: false, failed: [] };
}

function checkTask(task, settings) {
  const result = evaluateRule(task?.pass, settings || {});
  const hints = Array.isArray(task?.hints) ? task.hints : [];
  const notes = result.failed.map((key) => hints.find((hint) => hint.key === key)?.text).filter(Boolean);
  return {
    pass: result.pass,
    failed: result.failed,
    detail: result.pass
      ? (task?.pass_detail || "That matches this task.")
      : (notes[0] || task?.fail_detail || "Those settings do not pass this task."),
  };
}

function acceptText(accept, text) {
  const hay = String(text || "").trim().toLowerCase();
  if (!hay) return false;
  return (Array.isArray(accept) ? accept : []).some((token) => hay.includes(String(token).toLowerCase()));
}

function scoreAttempt(module, attempt, passMark) {
  const questions = Array.isArray(module?.quiz) ? module.quiz : [];
  const answers = attempt?.answers && typeof attempt.answers === "object" ? attempt.answers : {};
  let correct = 0;
  const wrong = [];
  for (const question of questions) {
    const choices = question.choices || [];
    const given = answers[question.id];
    const correctText = choices[Number(question.answer)];
    const hit = typeof given === "string" && choices.includes(given)
      ? given === correctText
      : Number(given) === question.answer;
    if (hit) correct += 1;
    else wrong.push(question);
  }
  const diff = module?.diff;
  const diffOk = !!diff && attempt?.diff === diff.bug;
  if (diff && diffOk) correct += 1;
  if (diff && !diffOk) wrong.push({ ...diff, id: diff.id, review_prompt: diff.review_prompt, choices: ["Left", "Right"], answer: diff.bug === "left" ? 0 : 1 });
  const total = questions.length + (diff ? 1 : 0);
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const mark = Number.isFinite(Number(passMark)) ? Number(passMark) : 70;
  return {
    correct,
    total,
    percent,
    passed: percent >= mark,
    assignment_ok: acceptText(module?.assignment?.accept, attempt?.assignment),
    wrong,
  };
}

function bumpSession(study, launchId) {
  const current = ensureStudy({ study }).study;
  const id = String(launchId || "").slice(0, 80);
  if (!id || id === current.launch_id) return current;
  current.launch_id = id;
  current.session += 1;
  return current;
}

function queueReviews(study, session, questions) {
  const current = ensureStudy({ study }).study;
  const from = Number(session) || 0;
  for (const question of questions || []) {
    if (!question?.id) continue;
    current.reviews = current.reviews.filter((item) => item.id !== question.id);
    current.reviews.push({
      id: String(question.id),
      prompt: String(question.review_prompt || question.prompt || "Try this again."),
      original_prompt: String(question.prompt || ""),
      choices: Array.isArray(question.choices) ? question.choices.slice(0, 4).map((choice) => String(choice)) : [],
      answer: Number.isInteger(question.answer) ? question.answer : 0,
      why: String(question.why || question.why_people_pick || ""),
      from_session: from,
      show_from: from + 1,
      show_until: from + 3,
    });
  }
  return current;
}

function dueReviews(study, session) {
  const current = ensureStudy({ study }).study;
  const at = Number(session) || 0;
  return current.reviews.filter((item) => at >= item.show_from && at <= item.show_until);
}

function answerReview(study, id, choice) {
  const current = ensureStudy({ study }).study;
  const review = current.reviews.find((item) => item.id === id);
  if (!review) return { found: false, correct: false, study: current };
  const correct = Number(choice) === review.answer;
  if (correct) current.reviews = current.reviews.filter((item) => item.id !== id);
  else {
    review.from_session = current.session;
    review.show_from = current.session + 1;
    review.show_until = current.session + 3;
  }
  return { found: true, correct, why: review.why, study: current };
}

module.exports = {
  emptyStudy,
  ensureStudy,
  evaluateRule,
  checkTask,
  acceptText,
  scoreAttempt,
  bumpSession,
  queueReviews,
  dueReviews,
  answerReview,
};
