"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildTracks } = require("../tracks");
const { loadPacks } = require("../packs");
const { enrichCourse } = require("../lessonStudy");
const { nodeWhy } = require("../shared/lineExplain");
const { visibleCppLines, visibleGraphNodes } = require("../shared/assignmentView");
const { startServer } = require("../server");

function sentences(text) {
  return (String(text || "").match(/[^.!?]+[.!?]+/g) || []).map((item) => item.trim()).filter((item) => item.split(/\s+/).length >= 6);
}

function lessonBody(section) {
  return [
    section.plainEnglish,
    section.whyGame,
    ...(section.reading || []).map((block) => (typeof block === "string" ? block : block.body)),
  ].filter(Boolean).join("\n");
}

function windows(text, size) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  const found = [];
  for (let i = 0; i + size <= clean.length; i += size) found.push(clean.slice(i, i + size));
  return found;
}

test("an explainer sentence is shared by at most two node types", () => {
  const authored = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "content", "study", "nodes.json"), "utf8"));
  const counts = new Map();
  for (const [catalog, text] of Object.entries(authored)) {
    const note = nodeWhy(catalog, catalog);
    assert.equal(note, text, catalog);
    assert.doesNotMatch(note, /one step in the chain|pins on its right|wires out of it wait|when a pawn needs that step/);
    for (const sentence of new Set(sentences(note))) {
      if (!counts.has(sentence)) counts.set(sentence, new Set());
      counts.get(sentence).add(catalog);
    }
  }
  const hot = [...counts].filter(([, catalogs]) => catalogs.size > 2);
  assert.deepEqual(hot.map(([sentence, catalogs]) => `${[...catalogs].join(", ")} :: ${sentence}`), []);
  assert.match(authored["begin-play"], /does not start servers or the match/);
  assert.match(authored["begin-play"], /spawned or placed/);
});

test("assignment prompts stay short and do not paste the lesson", () => {
  const sections = [];
  for (const track of buildTracks()) sections.push(...track.sections);
  for (const course of loadPacks().courses) sections.push(...enrichCourse(course).sections);
  assert.ok(sections.length > 20);
  for (const section of sections) {
    const banned = windows(lessonBody(section), 48);
    for (const task of section.tasks || []) {
      assert.ok(task.prompt.length <= 200, `${task.id} ${task.prompt.length}`);
      assert.doesNotMatch(task.prompt, /^In your own words:/);
      for (const slice of banned) {
        assert.ok(!task.prompt.includes(slice), `${task.id} embeds lesson text`);
      }
    }
  }
});

test("blanked assignments keep the surrounding code and graph nodes", () => {
  const section = buildTracks().find((track) => track.id === "fps-beginner").sections[0];
  const hidden = visibleCppLines(section.lineNotes, section.blanks, false);
  const shown = visibleCppLines(section.lineNotes, section.blanks, true);
  assert.ok(hidden.length > section.blanks.cpp.length);
  assert.equal(hidden.filter((row) => row.text === "________").length, 3);
  assert.ok(hidden.some((row) => row.text !== "________" && row.text.includes(" ")));
  assert.ok(shown.every((row) => row.text !== "________"));
  assert.ok(shown.some((row) => section.blanks.cpp.some((blank) => blank.text === row.text.trim())));
  const graph = visibleGraphNodes(section.nodeNotes, section.blanks, false);
  assert.ok(graph.filter((node) => node.label === "Blank node").length >= 2);
  assert.ok(graph.some((node) => node.label !== "Blank node"));
  const revealed = visibleGraphNodes(section.nodeNotes, section.blanks, true);
  assert.ok(revealed.every((node) => node.label !== "Blank node"));
  assert.ok(revealed.some((node) => node.label === "Line Trace" || node.label === "Branch" || node.label === "Interact"));
  const studio = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "shell", "LessonStudio.jsx"), "utf8");
  assert.match(studio, /PRACTICE ASSIGNMENTS/);
  assert.match(studio, /visibleCppLines/);
  assert.match(studio, /visibleGraphNodes/);
  assert.match(studio, /data-testid="lesson-save"/);
});

test("dependency boxes wrap on a word and keep the full text for a click", () => {
  const course = enrichCourse(loadPacks().courses.find((item) => item.id === "data-driven"));
  const section = course.sections[0];
  assert.ok(section.hubNotes.length >= 1);
  for (const item of section.hubNotes) {
    const shown = item.label.replace(/…$/, "").trim();
    assert.ok(item.full.startsWith(shown), item.label);
    assert.doesNotMatch(item.label, /desig$/);
  }
  assert.ok(section.hubNotes.some((item) => /data table/i.test(item.full)));
  assert.match(section.flow, /<title>/);
  assert.doesNotMatch(section.flow, />A data table is a list of rows desig</);
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "index.css"), "utf8");
  assert.match(css, /course-screen/);
  assert.match(css, /overflow:\s*auto/);
});

test("overlays portal to the body instead of stacking under the page", () => {
  const workspace = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "pages", "Workspace.jsx"), "utf8");
  const glossary = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "components", "GlossaryText.jsx"), "utf8");
  const graph = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "components", "EventGraph.jsx"), "utf8");
  assert.match(workspace, /createPortal\([\s\S]*generation-error/);
  assert.match(workspace, /createPortal\([\s\S]*synthesize-more-pop/);
  assert.match(glossary, /createPortal\([\s\S]*glossary-popup/);
  assert.match(graph, /createPortal\([\s\S]*graph-explain-text/);
  assert.match(graph, /createPortal\([\s\S]*graph-menu/);
  const css = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "index.css"), "utf8");
  assert.match(css, /\.top-layer\s*\{[^}]*z-index:\s*4000/s);
});

test("save restores the lesson, checks, and quiz answers", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-save-"));
  const handle = await startServer({ dataDir, port: 0, staticDir: path.join(__dirname, "missing-ui"), fetchImpl: async () => new Response("{}", { status: 200 }) });
  try {
    const saved = await (await fetch(`http://127.0.0.1:${handle.port}/api/tracks/fps-beginner/checkpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sectionIndex: 2,
        examMode: false,
        phase: "quiz",
        answers: { "input-q1": 1 },
        checked: { "input-repair": true },
        seed: 21,
        scores: { percent: 80, passed: true },
      }),
    })).json();
    assert.equal(saved.checkpoint.sectionIndex, 2);
    const again = await (await fetch(`http://127.0.0.1:${handle.port}/api/tracks/fps-beginner`)).json();
    assert.equal(again.state.checkpoint.phase, "quiz");
    assert.equal(again.state.checkpoint.answers["input-q1"], 1);
    assert.equal(again.state.checkpoint.checked["input-repair"], true);
    assert.equal(again.state.checkpoint.scores.percent, 80);
    const course = await (await fetch(`http://127.0.0.1:${handle.port}/api/courses/data-driven/checkpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionIndex: 1, phase: "lesson", answers: {}, checked: { a: true }, seed: 4 }),
    })).json();
    assert.equal(course.checkpoint.sectionIndex, 1);
    const loaded = await (await fetch(`http://127.0.0.1:${handle.port}/api/courses/data-driven`)).json();
    assert.equal(loaded.state.checkpoint.checked.a, true);
    assert.equal(loaded.state.checkpoint.seed, 4);
  } finally {
    await handle.close();
  }
});
