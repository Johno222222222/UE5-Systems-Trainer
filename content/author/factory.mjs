import fs from "fs";
import { examQuestion, words, writeTrack, YN } from "./lib.mjs";

const cache = JSON.parse(fs.readFileSync(new URL("../lesson-cpp.json", import.meta.url), "utf8"));

function loadDoc(id) {
  for (const dir of ["templates", "lesson-graphs"]) {
    const file = new URL(`../${dir}/${id}.json`, import.meta.url);
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  }
  throw new Error(`missing graph ${id}`);
}

function cites(graphId) {
  const lines = (cache[graphId]?.lines || []).filter((row) => /[=;]|HasAuthority|SetTimer|ProcessEvent|Clamp|Broadcast|PlayFromStart|AddDynamic/.test(row.text)).slice(0, 3);
  return lines.map((row) => `Line ${row.line} is \`${row.text.trim().slice(0, 90)}\`.`).join(" ");
}

function takeaway(spec) {
  const doc = loadDoc(spec.graph);
  const quoted = cites(spec.graph);
  const neighbors = (spec.depends || []).map((name) => `${name} stays on its own event and is not written from ${spec.title}.`).join(" ");
  return [
    `${spec.title} closes on ${doc.title}. ${spec.why}`,
    quoted || `${doc.title} is the graph this lesson compiles.`,
    neighbors,
    spec.assignment?.model || "",
    `The assignment names the repair to keep. ${spec.title} does not borrow a write from a neighbor graph, and a Tick stand-in is the broken sample rather than the schedule ${doc.title} already uses.`,
  ].join(" ");
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
    takeaway(spec),
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
