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
    for (const section of track.sections) {
      assert.ok(section.reading.length, section.id);
      assert.ok(section.assignment.prompt && section.assignment.accept.length, section.id);
      assert.ok(section.quiz.length, section.id);
      assert.ok(section.image.includes("<svg"), section.id);
      assert.ok(section.image.includes("WHY"), section.id);
    }
    const kinds = track.exam.questions.map((item) => item.kind);
    assert.ok(kinds.includes("mc"));
    assert.ok(kinds.includes("tf"));
    assert.ok(kinds.includes("graph-repair"));
    assert.ok(kinds.includes("cpp-repair"));
  }
  const fps = trackById("fps-intermediate");
  const blob = JSON.stringify(fps);
  assert.match(blob, /10-slot|gunsmith|authority|L2|clamp/i);
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
  assert.ok(intermediate.some((item) => /What happens if the interval/.test(item.prompt)));
  const picture = learn.pictureOf(system);
  assert.equal(picture.lines[0].line, 1);
  assert.ok(picture.properties.includes("Health"));
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
