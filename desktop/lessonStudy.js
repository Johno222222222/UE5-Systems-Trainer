"use strict";

// Loads the authored 1.19.0 study banks from content/study.
// Quizzes, plain-English intros, and expansion examples are data.
// This file does not invent questions from lesson sentences.

const fs = require("fs");
const path = require("path");
const { loadGraph, nodeLabel, cppExcerpt, renderGraph, hubSvg, shortSpoke } = require("./lessonRender");
const { explainLine, nodeWhy, headerNote } = require("./shared/lineExplain");

const STUDY = path.join(__dirname, "..", "content", "study");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(STUDY, name), "utf8"));
}

function lineBank() {
  return readJson("lines.json");
}

function hash(value) {
  let h = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function pickStable(items, key, count) {
  const ranked = items.map((item, index) => ({ item, index, rank: hash(`${key}:${index}:${typeof item === "string" ? item : item.text || item.label || ""}`) }));
  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
  const chosen = ranked.slice(0, Math.min(count, ranked.length));
  chosen.sort((a, b) => a.index - b.index);
  return chosen.map((row) => row.item);
}

function codeLines(cpp) {
  return (cpp || []).filter((row) => {
    const text = String(row.text || "").trim();
    if (text.length < 8) return false;
    if (text.startsWith("#include") || text.startsWith("#pragma") || text.startsWith("//")) return false;
    if (text === "{" || text === "}") return false;
    return true;
  });
}

function graphNodes(graphId) {
  const doc = loadGraph(graphId);
  const nodes = doc?.graph?.nodes || doc?.nodes || [];
  return nodes.map((node) => ({
    key: node.key || node.id,
    label: nodeLabel(node),
    catalog: node.catalog || "",
  })).filter((node) => node.label);
}

function noteForLine(text, bank) {
  const id = (String(text).match(/node:(\S+)/) || [])[1];
  if (id && bank[id]) return bank[id];
  return explainLine(text);
}

function blanksFor(section) {
  const lines = codeLines(section.cpp);
  const picked = pickStable(lines, `${section.graph || section.id}:cpp`, 3);
  const nodes = graphNodes(section.graph);
  const nodeCount = 2 + (hash(`${section.id}:nodes`) % 2);
  const pickedNodes = pickStable(nodes, `${section.graph || section.id}:nodes`, nodeCount);
  return {
    cpp: picked.map((row) => ({ line: row.line, text: String(row.text || "").trim() })),
    nodes: pickedNodes.map((node) => ({ key: node.key, label: node.label })),
  };
}

function fitPrompt(prompt, fallback, model) {
  const text = String(prompt || "").replace(/\s+/g, " ").trim();
  const leaked = /^In your own words:/.test(text)
    || /^Name one thing that would go wrong in a match if this lesson were ignored\./.test(text);
  if (text && text.length <= 200 && !leaked) return { prompt: text, model };
  const first = text.split(/(?<=[.!?])\s/)[0];
  if (first && first.length <= 200 && first.length >= 12 && !/^In your own words:/.test(first)) {
    const rest = text.slice(first.length).trim();
    return { prompt: first, model: [model, rest].filter(Boolean).join(" ") };
  }
  return { prompt: fallback, model: [model, text].filter(Boolean).join(" ") };
}

function tasksFor(section, authored) {
  const base = section.assignment || {};
  const title = String(section.title || "this step").replace(/\.$/, "");
  const repair = fitPrompt(
    base.prompt,
    `What should change in ${title} so the graph matches this lesson?`,
    base.model || "",
  );
  return [
    {
      id: `${section.id}-repair`,
      kind: "text",
      prompt: repair.prompt,
      accept: base.accept || [],
      model: repair.model,
    },
    {
      id: `${section.id}-plain`,
      kind: "text",
      prompt: authored.assignment?.plainPrompt
        || `In your own words, explain why ${title} should be built the way this lesson shows.`,
      accept: [],
      model: authored.plainEnglish,
    },
    {
      id: `${section.id}-why-game`,
      kind: "text",
      prompt: authored.assignment?.whyGamePrompt
        || `Name one thing that would go wrong in a match if ${title} were ignored.`,
      accept: [],
      model: authored.whyGame,
    },
    {
      id: `${section.id}-cpp-blank`,
      kind: "cpp-blank",
      prompt: "Three lines of this lesson's C++ are blank. Copy the block, fill those lines, then reveal to compare.",
    },
    {
      id: `${section.id}-graph-blank`,
      kind: "graph-blank",
      prompt: "Two or three nodes in this lesson's graph are blank. Name what each one does, then reveal the labels.",
    },
  ];
}

function annotateSection(section, authored, bank, nodes) {
  section.quiz = authored.quiz;
  section.plainEnglish = authored.plainEnglish;
  section.whyGame = authored.whyGame;
  section.whyLayman = `${authored.plainEnglish} ${authored.whyGame}`;
  section.expansionExamples = authored.expansions;
  section.lineNotes = (section.cpp || []).map((row) => ({
    line: row.line,
    text: row.text,
    note: noteForLine(row.text, bank),
  }));
  section.blanks = blanksFor(section);
  section.tasks = tasksFor(section, authored);
  const graphDoc = loadGraph(section.graph);
  const blankKeys = (section.blanks.nodes || []).map((node) => node.key).filter(Boolean);
  section.blankImage = graphDoc ? renderGraph(graphDoc, { blankKeys }) : "";
  const spokeSource = (section.depends && section.depends.length)
    ? section.depends
    : (section.reading || []).map((block) => (typeof block === "string" ? block : block.body)).filter(Boolean).slice(0, 4);
  section.hubNotes = spokeSource.slice(0, 6).map((text, index) => ({
    id: `${section.id}-hub-${index}`,
    label: shortSpoke(text),
    full: String(text).replace(/\s+/g, " ").trim(),
  }));
  section.nodeNotes = graphNodes(section.graph).map((node) => ({
    key: node.key,
    label: node.label,
    layman: nodes[node.catalog] || nodeWhy(node.catalog, node.label),
  }));
  section.headerNotes = section.lineNotes
    .filter((row) => /#include\s+"/.test(row.text))
    .map((row) => {
      const header = (String(row.text).match(/"([^"]+)"/) || [])[1];
      return header ? { header, note: headerNote(header) } : null;
    })
    .filter(Boolean);
  return section;
}

function applyRepairWrongs(question, wrongs) {
  if (!wrongs || wrongs.length < 3) return question;
  const choices = question.choices.slice();
  let wrongIndex = 0;
  for (let i = 0; i < choices.length; i += 1) {
    if (i === question.answer) continue;
    choices[i] = wrongs[wrongIndex] || choices[i];
    wrongIndex += 1;
  }
  return { ...question, choices };
}

function enrichTrack(track) {
  const bank = readJson(`programs/${track.id}.json`);
  const notes = lineBank();
  const nodes = readJson("nodes.json");
  for (const section of track.sections || []) {
    const authored = bank.sections[section.id];
    if (!authored || !authored.quiz) throw new Error(`Missing authored bank for ${track.id} ${section.id}`);
    annotateSection(section, authored, notes, nodes);
  }
  const repairs = (track.exam?.questions || []).filter((question) => /repair/.test(question.kind || ""));
  const rewritten = repairs.map((question) => applyRepairWrongs(question, bank.repairWrongs?.[question.id]));
  track.exam.questions = rewritten.concat(bank.exam || []);
  return track;
}

function enrichTracks(tracks) {
  return tracks.map((track) => enrichTrack(track));
}

function enrichCourse(course) {
  if (!course) return course;
  const bank = readJson(`courses/${course.id}.json`);
  const notes = lineBank();
  const copy = structuredClone(course);
  copy.sections = (copy.modules || []).map((mod, index) => {
    const authored = bank.modules[mod.id];
    if (!authored) throw new Error(`Missing authored course bank for ${course.id} ${mod.id}`);
    const graph = authored.graph;
    const reading = String(mod.takeaway || "").split(/\n\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
    const section = {
      id: mod.id,
      title: mod.title,
      order: index + 1,
      graph,
      why: reading[0] ? reading[0].split(/(?<=[.!?])\s+/)[0] : mod.title,
      depends: [],
      reading,
      assignment: {
        prompt: mod.assignment?.prompt || "",
        accept: mod.assignment?.accept || [],
        model: mod.assignment?.prompt || "",
      },
      quiz: authored.quiz,
      cpp: cppExcerpt(graph),
    };
    const doc = loadGraph(graph);
    section.image = doc ? renderGraph(doc, { why: section.why }) : "";
    section.flow = hubSvg(section.title, reading.slice(0, 4));
    annotateSection(section, authored, notes, readJson("nodes.json"));
    mod.quiz = section.quiz.map((question) => ({ ...question, review_prompt: question.review_prompt || question.prompt }));
    mod.graph = graph;
    mod.reading = reading;
    mod.cpp = section.cpp;
    mod.lineNotes = section.lineNotes;
    mod.blanks = section.blanks;
    mod.tasks = section.tasks;
    mod.whyLayman = section.whyLayman;
    mod.plainEnglish = section.plainEnglish;
    mod.whyGame = section.whyGame;
    mod.nodeNotes = section.nodeNotes;
    mod.why = section.why;
    mod.expansionExamples = section.expansionExamples;
    mod.image = section.image;
    mod.flow = section.flow;
    return section;
  });
  copy.study119 = true;
  return copy;
}

module.exports = {
  enrichTracks,
  enrichTrack,
  enrichCourse,
  blanksFor,
  pickStable,
  noteForLine,
};
