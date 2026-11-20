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
const { visibleCppLines } = require("../shared/assignmentView");
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

test("every lesson authors its own prompts, and Input does not grow a Begin Play note", () => {
  const study = path.join(__dirname, "..", "..", "content", "study");
  const texts = new Map();
  let lessons = 0;
  for (const dir of ["programs", "courses"]) {
    for (const name of fs.readdirSync(path.join(study, dir)).filter((item) => item.endsWith(".json"))) {
      const data = JSON.parse(fs.readFileSync(path.join(study, dir, name), "utf8"));
      const bucket = data.sections || data.modules;
      for (const [id, section] of Object.entries(bucket)) {
        lessons += 1;
        const assignment = section.assignment || {};
        assert.ok(assignment.plainPrompt && assignment.whyGamePrompt, `${name} ${id}`);
        for (const text of [assignment.plainPrompt, assignment.whyGamePrompt]) {
          assert.ok(text.length <= 200, `${name} ${id}`);
          assert.doesNotMatch(text, /should be built the way this lesson shows/);
          assert.doesNotMatch(text, /if this lesson were ignored/);
          assert.ok(!texts.has(text), `${text} shared`);
          texts.set(text, `${name}:${id}`);
        }
      }
    }
  }
  assert.equal(lessons, 113);
  const input = buildTracks().find((track) => track.id === "fps-beginner").sections.find((section) => section.id === "input");
  const plain = input.tasks.find((task) => task.kind === "text" && task.id.endsWith("-plain"));
  assert.equal(plain.prompt, "Why does the look start from the use key instead of Tick?");
  const shown = [input.whyLayman, ...input.nodeNotes.map((node) => `${node.label}\n${node.layman}`)].join("\n");
  assert.doesNotMatch(shown, /Begin Play/);
  assert.doesNotMatch(shown, /does not start servers/);
  assert.ok(input.nodeNotes.every((node) => node.label !== "Begin Play"));
});

test("blanked assignments keep indentation, wires, and the other nodes", () => {
  const indented = visibleCppLines(
    [{ line: 4, text: "    Health -= 1.f;" }],
    { cpp: [{ line: 4, text: "Health -= 1.f;" }] },
    false,
  );
  assert.equal(indented[0].text, "    ________");
  const section = buildTracks().find((track) => track.id === "fps-beginner").sections[0];
  const hidden = visibleCppLines(section.lineNotes, section.blanks, false);
  const shown = visibleCppLines(section.lineNotes, section.blanks, true);
  assert.ok(hidden.length > section.blanks.cpp.length);
  assert.equal(hidden.filter((row) => row.blank).length, 3);
  for (const row of hidden.filter((item) => item.blank)) {
    const original = section.lineNotes.find((item) => item.line === row.line).text;
    const indent = (String(original).match(/^[ \t]*/) || [""])[0];
    assert.equal(row.text, `${indent}________`);
  }
  assert.ok(hidden.some((row) => !row.blank && row.text.includes(" ")));
  assert.ok(shown.some((row) => section.blanks.cpp.some((blank) => blank.text === row.text.trim())));
  assert.match(section.blankImage, /<path /);
  assert.match(section.blankImage, /stroke-dasharray="6 4"/);
  assert.match(section.blankImage, /Blank node/);
  assert.ok(["Line Trace", "Branch", "Interact", "IA_Interact", "Print"].some((label) => section.blankImage.includes(label)));
  const dashed = (section.blankImage.match(/data-blank="yes"/g) || []).length;
  assert.ok(dashed >= 2 && dashed <= 3);
  const studio = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "shell", "LessonStudio.jsx"), "utf8");
  assert.match(studio, /PRACTICE ASSIGNMENTS/);
  assert.match(studio, /visibleCppLines/);
  assert.match(studio, /blankImage/);
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
