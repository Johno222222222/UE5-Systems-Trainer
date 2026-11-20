"use strict";

// Shuffle choices every time a quiz is opened. The correct text moves with the
// choice, so it does not stay glued to position A.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleQuestion(question, rng) {
  const choices = [...(question?.choices || [])];
  if (choices.length < 2) return { ...question, choices };
  const correct = choices[Number(question.answer)] ?? choices[0];
  for (let i = choices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = choices[i];
    choices[i] = choices[j];
    choices[j] = swap;
  }
  let answer = choices.indexOf(correct);
  if (answer < 0) answer = 0;
  return { ...question, choices, answer };
}

function presentQuiz(questions, seed) {
  const rng = mulberry32(Number(seed) || 1);
  return (Array.isArray(questions) ? questions : []).map((question) => shuffleQuestion(question, rng));
}

function positionShare(questions) {
  const counts = {};
  let total = 0;
  for (const question of questions || []) {
    const choices = question?.choices || [];
    if (choices.length < 2) continue;
    const index = Number(question.answer);
    if (!Number.isInteger(index) || index < 0 || index >= choices.length) continue;
    counts[index] = (counts[index] || 0) + 1;
    total += 1;
  }
  const max = Math.max(0, ...Object.values(counts));
  return { counts, total, max, share: total ? max / total : 0 };
}

function isTrueFalse(question) {
  const choices = (question?.choices || []).map((choice) => String(choice).trim().toLowerCase());
  return choices.length === 2 && choices.includes("true") && choices.includes("false");
}

module.exports = {
  mulberry32,
  shuffleQuestion,
  presentQuiz,
  positionShare,
  isTrueFalse,
};
