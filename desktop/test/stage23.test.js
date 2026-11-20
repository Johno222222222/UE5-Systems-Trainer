"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { catalog } = require("../references");
const { composeStack } = require("../stackMap");
const { startServer } = require("../server");

const BANNED = /does the job printed on the node|one step in the chain|wires out of it wait/;

function sentences(text) {
  return (String(text || "").match(/[^.!?]+[.!?]+/g) || []).map((item) => item.trim()).filter((item) => item.split(/\s+/).length >= 5);
}

function typeOf(node) {
  return String(node.catalog || node.label || node.id || "node");
}

test("every built-in preset, template, and stack has a real Learn note", async () => {
  const learn = await import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "learnQuiz.mjs")).href);
  const systems = [];
  for (const example of catalog().examples) {
    if (example.starter) systems.push(example.starter);
  }
  const dir = path.join(__dirname, "..", "..", "content", "templates");
  for (const name of fs.readdirSync(dir).filter((item) => item.endsWith(".json"))) {
    const template = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
    systems.push({
      system_name: template.title || template.id,
      graphs: { items: [{ ...template.graph, id: "event", kind: template.graph?.kind || "event" }] },
    });
  }
  const examples = catalog().examples.filter((item) => item.starter);
  systems.push(composeStack([examples[0].starter, examples[1].starter], { name: "Stacked pair" }).system);
  assert.ok(systems.length >= 9);
  const bySentence = new Map();
  for (const system of systems) {
    const picture = learn.pictureOf(system);
    assert.ok(picture.whyNotes.length > 0, system.system_name);
    for (const note of picture.whyNotes) {
      assert.ok(note.layman && note.layman.length > 8, `${system.system_name} ${note.label}: ${note.layman}`);
      assert.doesNotMatch(note.layman, BANNED, `${system.system_name} ${note.label}: ${note.layman}`);
      const kind = typeOf(note.label ? { label: note.label, catalog: "" } : {});
      for (const sentence of new Set(sentences(note.layman))) {
        if (!bySentence.has(sentence)) bySentence.set(sentence, new Set());
        bySentence.get(sentence).add(`${kind}:${note.label}`);
      }
    }
  }
  const focus = learn.pictureOf(examples.find((item) => item.title === "Character Interaction").starter);
  const labels = focus.whyNotes.map((item) => item.label);
  assert.ok(labels.includes("Event BeginPlay"));
  assert.ok(labels.includes("Trace For Focus"));
  assert.ok(labels.includes("Branch Valid Focus"));
  assert.ok(labels.includes("Broadcast OnFocusChanged"));
  const trace = focus.whyNotes.find((item) => item.label === "Trace For Focus");
  assert.match(trace.layman, /camera/i);
  assert.doesNotMatch(trace.layman, BANNED);
  const hot = [...bySentence].filter(([, kinds]) => kinds.size > 2);
  assert.deepEqual(hot.map(([sentence, kinds]) => `${[...kinds].slice(0, 4).join(", ")} :: ${sentence}`), []);
});

test("a course save restores through Load saved", async () => {
  const courses = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "shell", "Courses.jsx"), "utf8");
  assert.match(courses, /course-load-saved/);
  assert.match(courses, /course-page-load-saved/);
  assert.match(courses, /ue5_course_bookmarks/);
  assert.match(courses, /openCourse/);
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-course-save-"));
  const handle = await startServer({ dataDir, port: 0, staticDir: path.join(__dirname, "missing-ui"), fetchImpl: async () => new Response("{}", { status: 200 }) });
  try {
    const saved = await (await fetch(`http://127.0.0.1:${handle.port}/api/courses/fps-beginner/checkpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sectionIndex: 2,
        phase: "quiz",
        answers: { "fpsc-press-1": 1 },
        checked: { "magazine-plain": true },
        seed: 9,
        scores: { percent: 70, passed: true },
      }),
    })).json();
    assert.equal(saved.checkpoint.sectionIndex, 2);
    const loaded = await (await fetch(`http://127.0.0.1:${handle.port}/api/courses/fps-beginner`)).json();
    assert.equal(loaded.course.id, "fps-beginner");
    assert.equal(loaded.state.checkpoint.phase, "quiz");
    assert.equal(loaded.state.checkpoint.sectionIndex, 2);
    assert.equal(loaded.state.checkpoint.answers["fpsc-press-1"], 1);
    assert.equal(loaded.state.checkpoint.checked["magazine-plain"], true);
    assert.equal(loaded.state.checkpoint.scores.percent, 70);
    assert.equal(loaded.state.checkpoint.seed, 9);
  } finally {
    await handle.close();
  }
});
