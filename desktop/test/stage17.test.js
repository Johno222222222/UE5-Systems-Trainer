"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("url");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { buildTracks, problemsForTracks, scoreQuestions, trackById } = require("../tracks");
const { loadPacks } = require("../packs");
const { startServer } = require("../server");

test("every genre has both levels, ordered sections, and a repair exam", () => {
  const tracks = buildTracks();
  assert.deepEqual(problemsForTracks(tracks), []);
  for (const track of tracks) {
    assert.ok(track.map.includes("<svg"), track.id);
    assert.ok(track.map.includes(track.genre), track.id);
    const orders = track.sections.map((section) => section.order);
    assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
    const prompts = new Set();
    const minQuiz = track.level === "intermediate" ? 8 : 5;
    const minExam = track.level === "intermediate" ? 30 : 20;
    assert.ok(track.sections.length >= 6 && track.sections.length <= 10, track.id);
    for (const section of track.sections) {
      const reading = section.reading.map((line) => (typeof line === "string" ? line : line.body)).join(" ");
      const count = reading.split(/\s+/).filter(Boolean).length;
      assert.ok(count >= 300 && count <= 700, `${track.id} ${section.id} ${count}`);
      assert.ok(!/is the step you build at position/i.test(reading), section.id);
      assert.ok(section.assignment.prompt && section.assignment.accept.length && section.assignment.model, section.id);
      assert.ok(section.quiz.length >= minQuiz, `${track.id} ${section.id} quiz ${section.quiz.length}`);
      assert.ok(section.image.includes("<svg") && section.image.includes("WHY"), section.id);
      assert.ok((section.image.match(/<rect /g) || []).length >= 4, section.id);
      assert.ok(section.cpp.length >= 3, section.id);
      assert.ok(section.flow && section.flow.includes("<svg"), section.id);
      if (section.graph === "camera" || section.id === "camera") assert.notEqual(section.graph, "interact");
      for (const question of section.quiz) {
        const key = question.prompt.trim().toLowerCase();
        assert.ok(!prompts.has(key), `${track.id} duplicate ${key}`);
        prompts.add(key);
      }
    }
    assert.ok(track.exam.questions.length >= minExam, `${track.id} exam ${track.exam.questions.length}`);
    for (const question of track.exam.questions) {
      const key = question.prompt.trim().toLowerCase();
      assert.ok(!prompts.has(key), `${track.id} exam duplicate ${key}`);
      prompts.add(key);
      if (question.kind === "graph-repair" || question.kind === "cpp-repair") {
        assert.ok(question.sample, question.id);
      }
      if (question.kind === "graph-repair") {
        assert.ok(question.figure && question.figure.includes("<svg") && question.figure.includes("Tick"), question.id);
      }
    }
    const kinds = track.exam.questions.map((item) => item.kind);
    assert.ok(kinds.includes("mc"));
    assert.ok(kinds.includes("tf"));
    assert.ok(kinds.includes("graph-repair"));
    assert.ok(kinds.includes("cpp-repair"));
  }
  const fps = trackById("fps-intermediate");
  const blob = JSON.stringify(fps);
  assert.match(blob, /10-slot|gunsmith/i);
  assert.match(blob, /L2|radial/i);
  assert.match(blob, /clamp/i);
  assert.match(blob, /GASP|motion matching/i);
  const exams = tracks.map((track) => track.exam.questions.map((item) => item.prompt.trim().toLowerCase()));
  for (let i = 0; i < exams.length; i += 1) {
    for (let j = i + 1; j < exams.length; j += 1) {
      const other = new Set(exams[j]);
      const shared = exams[i].filter((prompt) => other.has(prompt));
      assert.ok(shared.length / Math.min(exams[i].length, exams[j].length) <= 0.2, `${tracks[i].id} overlaps ${tracks[j].id}`);
    }
  }
  const camera = tracks.flatMap((track) => track.sections).find((section) => section.id === "camera");
  assert.equal(camera.graph, "camera");
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8"));
  const files = pkg.build.files.map((item) => String(item));
  assert.ok(files.some((item) => item.includes("content/programs")));
  assert.ok(files.some((item) => item.includes("content/lesson-cpp.json")));
});

test("a track quiz scores and the general courses still load beside the old ones", async () => {
  const packs = loadPacks();
  assert.deepEqual(packs.problems, []);
  assert.ok(packs.courses.some((course) => course.id === "tactical-fps-course"));
  assert.ok(packs.courses.some((course) => course.id === "general-beginner" && course.level === "beginner"));
  assert.ok(packs.courses.some((course) => course.id === "general-intermediate" && course.level === "intermediate"));
  const track = trackById("horror-beginner");
  const answers = Object.fromEntries(track.sections[0].quiz.map((question) => [question.id, question.answer]));
  const scored = scoreQuestions(track.sections[0].quiz, answers);
  assert.equal(scored.passed, true);
  const exam = scoreQuestions(track.exam.questions, { "graph-repair": 1, "cpp-repair": 1 });
  assert.equal(exam.total, track.exam.questions.length);

  const learn = await import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "learnQuiz.mjs")).href);
  const system = {
    system_name: "Health",
    network_notes: "replicated",
    cpp_header: "UPROPERTY(Replicated) float Health;",
    cpp_source: "void Apply() { Health -= 1; }\n",
    node_graph_nodes: [{ label: "Any Damage" }],
    learning: { challenges: [{ id: "owned", prompt: "What runs the damage?", choices: ["Authority", "Tick"], answer: 0, why_people_pick: "Authority." }] },
  };
  const beginner = learn.learnQuestions(system, "beginner");
  const intermediate = learn.learnQuestions(system, "intermediate");
  assert.ok(beginner.length > 1);
  assert.ok(intermediate.length > beginner.length);
  assert.equal(new Set(beginner.map((item) => item.prompt)).size, beginner.length);
  assert.ok(beginner.some((item) => item.prompt.includes("Any Damage")));
  assert.ok(intermediate.some((item) => item.prompt.includes("Health -= 1") && item.prompt.includes("Health")));
  assert.ok(!intermediate.some((item) => item.prompt.includes("changes from 0.1 to 0.5") && !item.prompt.includes("Health")));
  const picture = learn.pictureOf(system);
  assert.equal(picture.lines[0].line, 1);
  assert.ok(picture.properties.includes("Health"));
  assert.ok(picture.nodes.some((node) => node.label === "Any Damage"));
  assert.ok(picture.expansions.some((item) => item.includes("Health")));
  const other = learn.pictureOf({ system_name: "Door", cpp_source: "void Tick() { Open(); }\n", node_graph_nodes: [{ id: "t", label: "Tick", x: 10, y: 20 }] });
  assert.notDeepEqual(picture.expansions, other.expansions);
});

test("track progress is stored and a clean compile check drops stale outcome items", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-tracks-"));
  const handle = await startServer({ dataDir, port: 0, staticDir: path.join(__dirname, "missing-ui"), fetchImpl: async () => new Response("{}", { status: 200 }) });
  try {
    const list = await (await fetch(`http://127.0.0.1:${handle.port}/api/tracks`)).json();
    assert.equal(list.problems.length, 0);
    assert.equal(list.tracks.length, 8);
    const track = trackById("strategy-intermediate");
    const answers = Object.fromEntries(track.exam.questions.map((question) => [question.id, question.answer]));
    const exam = await (await fetch(`http://127.0.0.1:${handle.port}/api/tracks/strategy-intermediate/exam`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    })).json();
    assert.equal(exam.passed, true);
    const again = await (await fetch(`http://127.0.0.1:${handle.port}/api/tracks/strategy-intermediate`)).json();
    assert.equal(again.state.exam.passed, true);
  } finally {
    await handle.close();
  }
});
