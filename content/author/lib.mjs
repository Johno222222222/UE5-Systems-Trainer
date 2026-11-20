import fs from "fs";
import path from "path";

export function words(text) {
  return String(text).split(/\s+/).filter(Boolean).length;
}

export function reading(parts) {
  return parts.filter(Boolean).map((body, index) => ({
    heading: body.heading,
    body: body.body || body,
  }));
}

export function section(spec) {
  const body = spec.paragraphs.map((paragraph) => paragraph.trim()).join("\n\n");
  const count = words(body);
  if (count < 300 || count > 700) {
    console.error(`SHORT ${spec.id} ${count}`);
  }
  return {
    id: spec.id,
    title: spec.title,
    order: spec.order,
    graph: spec.graph,
    why: spec.why,
    depends: spec.depends,
    reading: spec.paragraphs.map((paragraph) => paragraph.trim()),
    assignment: spec.assignment,
    quiz: spec.quiz.map((item, index) => ({
      id: `${spec.id}-q${index + 1}`,
      prompt: item[0],
      choices: item[1],
      answer: item[2],
      why: item[3],
    })),
  };
}

export function mc(prompt, choices, answer, why) {
  return [prompt, choices, answer, why];
}

export function examQuestion(trackId, item, index) {
  return {
    id: `${trackId}-e${index + 1}`,
    kind: item.kind || "mc",
    graph: item.graph,
    sample: item.sample,
    prompt: item.prompt,
    choices: item.choices,
    answer: item.answer,
    why: item.why,
  };
}

export function writeTrack(dir, track) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${track.id}.json`);
  fs.writeFileSync(file, JSON.stringify(track, null, 2));
  const quiz = track.sections.reduce((sum, item) => sum + item.quiz.length, 0);
  const lessonWords = track.sections.map((item) => words(item.reading.join(" ")));
  console.log(track.id, "sections", track.sections.length, "words", lessonWords.join(","), "quiz", quiz, "exam", track.exam.questions.length);
}

export const YN = ["True", "False"];
