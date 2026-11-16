import fs from "fs";
import path from "path";
import { examQuestion, words, writeTrack, YN } from "./lib.mjs";

const cache = JSON.parse(fs.readFileSync(new URL("../lesson-cpp.json", import.meta.url), "utf8"));

function loadDoc(id) {
  for (const dir of ["templates", "lesson-graphs"]) {
    const file = new URL(`../${dir}/${id}.json`, import.meta.url);
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  }
  throw new Error(`missing graph ${id}`);
}

function clip(text, maxWords) {
  const parts = String(text).split(/\s+/).filter(Boolean);
  return parts.slice(0, maxWords).join(" ");
}

function evidence(graphId) {
  const doc = loadDoc(graphId);
  const notes = clip((doc.graph.nodes || []).map((node) => node.note).filter(Boolean).join(" "), 70);
  const lines = (cache[graphId]?.lines || []).filter((row) => /[=;]|HasAuthority|SetTimer|ProcessEvent|Clamp|Broadcast|PlayFromStart|AddDynamic/.test(row.text)).slice(0, 2);
  const quoted = lines.map((row) => `Line ${row.line} is \`${row.text.trim().slice(0, 110)}\`.`).join(" ");
  return `The figure is the real ${doc.title} graph, with that preset's node positions and wires. ${notes} The C++ beside the figure is the compiler output for this same graph. ${quoted}`;
}

export function quizItems(rows) {
  return rows.map((row, index) => ({
    id: `q${index + 1}`,
    prompt: row[0],
    choices: row[1],
    answer: row[2],
    why: row[3],
  }));
}

export function buildSection(spec) {
  const reading = [
    ...spec.paragraphs.map((paragraph) => paragraph.trim()),
    evidence(spec.graph),
    `Across this track, keep ${spec.depends.join(", ")} distinct. ${spec.why} ${spec.assignment.model}`,
  ];
  const count = words(reading.join(" "));
  if (count < 300 || count > 680) console.error(`RANGE ${spec.id} ${count}`);
  return {
    id: spec.id,
    title: spec.title,
    order: spec.order,
    graph: spec.graph,
    why: spec.why,
    depends: spec.depends,
    reading,
    assignment: spec.assignment,
    quiz: spec.quiz.map((row, index) => ({
      id: `${spec.id}-q${index + 1}`,
      prompt: row[0],
      choices: row[1],
      answer: row[2],
      why: row[3],
    })),
  };
}

export function buildTrack(meta, sections, exam) {
  return {
    ...meta,
    sections: sections.map(buildSection),
    exam: { questions: exam.map((item, index) => examQuestion(meta.id, item, index)) },
  };
}

export function emit(dir, track) {
  writeTrack(dir, track);
}

export { YN };
