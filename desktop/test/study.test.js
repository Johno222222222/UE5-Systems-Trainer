"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { startServer } = require("../server");
const { loadPacks } = require("../packs");
const { checkTask, scoreAttempt, dueReviews, bumpSession, queueReviews, emptyStudy } = require("../study");

function boot(packsDir) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-study-"));
  let calls = 0;
  return startServer({
    dataDir,
    port: 0,
    packsDir,
    staticDir: path.join(__dirname, "missing-ui"),
    fetchImpl: async () => {
      calls += 1;
      return new Response("{}", { status: 500 });
    },
  }).then((handle) => ({
    handle,
    dataDir,
    base: `http://127.0.0.1:${handle.port}`,
    calls: () => calls,
  }));
}

async function json(res) {
  const body = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`);
  return body;
}

test("the shipped tactical pack is a complete program and course", () => {
  const catalog = loadPacks();
  assert.deepEqual(catalog.problems, []);
  assert.ok(catalog.files.includes("tactical-fps.json"));
  const program = catalog.programs.find((item) => item.id === "tactical-fps");
  assert.ok(program);
  assert.ok(program.modify_tasks.length >= 5);
  const titles = program.modules.map((mod) => mod.title);
  assert.ok(titles.includes("Interaction"));
  assert.ok(titles.includes("Inventory"));
  assert.ok(titles.includes("Weapon wear"));
  assert.ok(titles.includes("Replication notes"));
  for (const mod of program.modules) {
    for (const step of mod.steps) {
      assert.ok(step.predict.choices.length >= 2);
      assert.ok(step.why && step.task);
      assert.ok(step.reveal.nodes.length + step.reveal.functions.length >= 1);
    }
  }
  assert.ok(program.compares.length >= 2);
  const mapIds = program.map.nodes.map((node) => node.id);
  for (const id of ["input", "interaction", "health", "ui"]) assert.ok(mapIds.includes(id));
  assert.match(program.starter.cpp_header, /TraceDistance = 500/);
  assert.match(program.starter.cpp_source, /AddIgnoredActor/);
  assert.equal(/EnhancedInput|GameplayAbilities|Niagara|ChaosVehicles/.test(program.starter.cpp_header + program.starter.cpp_source), false);
  const course = catalog.courses.find((item) => item.id === "tactical-fps-course");
  assert.ok(course.modules.length >= 4);
  assert.equal(course.pass_mark, 70);
  for (const mod of course.modules) {
    assert.ok(mod.quiz.length >= 1);
    assert.ok(mod.diff.bug === "left" || mod.diff.bug === "right");
    assert.ok(mod.assignment.accept.length >= 1);
    assert.ok(mod.takeaway);
  }
});

test("each modify task passes only with the right settings", () => {
  const tasks = loadPacks().programs.find((item) => item.id === "tactical-fps").modify_tasks;
  const right = {
    "trace-500-ignore": { trace_distance: 500, ignore_player: true },
    "timer-not-tick": { use_tick: false, trace_interval: 0.1 },
    "stack-on-data": { max_stack: 10, stored_on: "data_asset" },
    "wear-repnotify": { replicate_wear: true, replicate_mesh: false },
    "damage-on-authority": { run_on: "authority" },
    "ui-listens": { ui_mode: "event" },
  };
  const wrong = {
    "trace-500-ignore": { trace_distance: 250, ignore_player: true },
    "timer-not-tick": { use_tick: true, trace_interval: 0.1 },
    "stack-on-data": { max_stack: 10, stored_on: "widget" },
    "wear-repnotify": { replicate_wear: true, replicate_mesh: true },
    "damage-on-authority": { run_on: "client" },
    "ui-listens": { ui_mode: "tick" },
  };
  assert.ok(tasks.length >= 5);
  for (const task of tasks) {
    assert.equal(checkTask(task, right[task.id]).pass, true, task.id);
    assert.equal(checkTask(task, wrong[task.id]).pass, false, task.id);
    assert.equal(checkTask(task, {}).pass, false, task.id);
  }
});

test("a quiz scores against the pass mark and a wrong answer is reworded for the next three sessions", () => {
  const course = loadPacks().courses[0];
  const mod = course.modules[0];
  const good = { answers: {}, diff: mod.diff.bug, assignment: "500 and ignore the player" };
  for (const question of mod.quiz) good.answers[question.id] = question.answer;
  const passed = scoreAttempt(mod, good, course.pass_mark);
  assert.equal(passed.passed, true);
  assert.equal(passed.assignment_ok, true);
  const bad = { answers: {}, diff: mod.diff.bug === "left" ? "right" : "left", assignment: "no" };
  for (const question of mod.quiz) bad.answers[question.id] = question.answer === 0 ? 1 : 0;
  const failed = scoreAttempt(mod, bad, course.pass_mark);
  assert.equal(failed.passed, false);
  assert.equal(failed.assignment_ok, false);
  const study = emptyStudy();
  bumpSession(study, "launch-1");
  queueReviews(study, study.session, failed.wrong);
  assert.equal(dueReviews(study, study.session).length, 0);
  const due = dueReviews(study, study.session + 1);
  assert.ok(due.length >= 1);
  const reworded = due.find((item) => item.id === mod.quiz[0].id);
  assert.equal(reworded.prompt, mod.quiz[0].review_prompt);
  assert.notEqual(reworded.prompt, mod.quiz[0].prompt);
  assert.ok(dueReviews(study, study.session + 3).some((item) => item.id === reworded.id));
  assert.equal(dueReviews(study, study.session + 4).some((item) => item.id === reworded.id), false);
});

test("packs, tasks, quizzes, and the starter do not call the model", async () => {
  const session = await boot();
  try {
    const study = await json(await fetch(`${session.base}/api/study`));
    assert.ok(study.programs.some((item) => item.id === "tactical-fps"));
    assert.equal(study.programs.find((item) => item.id === "tactical-fps").complete, false);
    const program = await json(await fetch(`${session.base}/api/programs/tactical-fps`));
    const step = await json(await fetch(`${session.base}/api/programs/tactical-fps/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step_id: "look-timer", answer: "BeginPlay" }),
    }));
    assert.equal(step.pass, true);
    const miss = await json(await fetch(`${session.base}/api/programs/tactical-fps/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step_id: "look-timer", answer: "Tick" }),
    }));
    assert.equal(miss.pass, false);
    const failTask = await json(await fetch(`${session.base}/api/programs/tactical-fps/tasks/trace-500-ignore/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { trace_distance: 250, ignore_player: false } }),
    }));
    assert.equal(failTask.pass, false);
    const passTask = await json(await fetch(`${session.base}/api/programs/tactical-fps/tasks/trace-500-ignore/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { trace_distance: 500, ignore_player: true } }),
    }));
    assert.equal(passTask.pass, true);

    await json(await fetch(`${session.base}/api/study/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ launch_id: "launch-a" }),
    }));
    const course = program && (await json(await fetch(`${session.base}/api/courses/tactical-fps-course`))).course;
    const mod = course.modules[0];
    const wrong = { answers: {}, diff: "left", assignment: "nope" };
    for (const question of mod.quiz) wrong.answers[question.id] = 1;
    const attempt = await json(await fetch(`${session.base}/api/courses/tactical-fps-course/modules/${mod.id}/attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wrong),
    }));
    assert.equal(attempt.passed, false);
    const sameSession = await json(await fetch(`${session.base}/api/study`));
    assert.equal(sameSession.reviews.length, 0);
    const next = await json(await fetch(`${session.base}/api/study/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ launch_id: "launch-b" }),
    }));
    assert.equal(next.session, 2);
    assert.ok(next.reviews.length >= 1);
    assert.equal(next.reviews[0].prompt, mod.quiz[0].review_prompt);
    const again = await json(await fetch(`${session.base}/api/courses/tactical-fps-course/modules/${mod.id}/attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: Object.fromEntries(mod.quiz.map((question) => [question.id, question.answer])),
        diff: mod.diff.bug,
        assignment: "500 cm and ignore the player",
      }),
    }));
    assert.equal(again.passed, true);
    assert.equal(again.assignment_ok, true);
    const saved = await json(await fetch(`${session.base}/api/study`));
    assert.equal(saved.courses.find((item) => item.id === "tactical-fps-course").modules.find((item) => item.id === mod.id).score.passed, true);

    const created = await json(await fetch(`${session.base}/api/programs/tactical-fps/complete`, { method: "POST" }));
    const second = await json(await fetch(`${session.base}/api/programs/tactical-fps/complete`, { method: "POST" }));
    assert.equal(second.project_id, created.project_id);
    const projects = await json(await fetch(`${session.base}/api/projects`));
    assert.equal(projects.mine.filter((item) => item.project_id === created.project_id).length, 1);
    const home = await json(await fetch(`${session.base}/api/study`));
    assert.equal(home.programs.find((item) => item.id === "tactical-fps").complete, true);

    const legacy = await json(await fetch(`${session.base}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Legacy Shield",
        system: {
          system_name: "Legacy Shield",
          summary: "Blocks.",
          blueprint_pseudocode: "Event Block",
          cpp_header: "class UShield {};",
          cpp_source: "void UShield::Block() {}",
          setup_guide: [{ step: 1, title: "Add" }],
          node_graph_nodes: [{ id: "n1", label: "Block" }],
        },
      }),
    }));
    const opened = await json(await fetch(`${session.base}/api/projects/${legacy.project_id}`));
    assert.equal(opened.system.system_name, "Legacy Shield");
    assert.equal(opened.system.learning, undefined);

    const library = JSON.parse(fs.readFileSync(path.join(session.dataDir, "library.json"), "utf8"));
    assert.equal(library.usage.length, 0);
    assert.equal(session.calls(), 0);
  } finally {
    await session.handle.close();
  }
});

test("a new pack file is picked up on the next start without a code change", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ue5-packs-"));
  fs.copyFileSync(path.join(__dirname, "..", "..", "content", "packs", "tactical-fps.json"), path.join(dir, "tactical-fps.json"));
  fs.writeFileSync(path.join(dir, "extra-pack.json"), JSON.stringify({
    format: "ue5-architect-pack",
    version: 1,
    programs: [{
      id: "extra-drill",
      title: "Extra drill",
      summary: "Added as a file.",
      modules: [{
        id: "only",
        title: "Only",
        steps: [{
          id: "s1",
          title: "One",
          reveal: { nodes: ["Start"], functions: [] },
          predict: { prompt: "Go?", choices: ["Yes", "No"], answer: 0, why: "Yes." },
          why: "Yes.",
          task: "Type yes.",
          accept: ["yes"],
        }],
      }],
      modify_tasks: [1, 2, 3, 4, 5].map((n) => ({
        id: `t${n}`,
        title: `Task ${n}`,
        prompt: "Set it.",
        fields: [{ key: "n", label: "N", kind: "number" }],
        pass: { all: [{ key: "n", eq: n }] },
      })),
      compares: [{ id: "c", title: "Two ways", feature: "Same feature", note: "Right.", left: { label: "A", body: "A" }, right: { label: "B", body: "B" } }],
      map: {
        nodes: ["input", "interaction", "health", "ui"].map((id) => ({ id, title: id, detail: id })),
        edges: [{ from: "input", to: "interaction" }],
      },
      starter: { system_name: "Extra", cpp_header: "class UExtra {};", cpp_source: "void UExtra::Run() {}" },
    }],
  }));
  const session = await boot(dir);
  try {
    const study = await json(await fetch(`${session.base}/api/study`));
    assert.ok(study.packs.includes("extra-pack.json"));
    assert.ok(study.programs.some((item) => item.id === "extra-drill"));
    assert.ok(study.programs.some((item) => item.id === "tactical-fps"));
  } finally {
    await session.handle.close();
  }
});

test("the tactical starter passes the C++ pattern check", async () => {
  const program = loadPacks().programs.find((item) => item.id === "tactical-fps");
  const raw = fs.readFileSync(path.join(__dirname, "..", "..", "frontend", "src", "lib", "compileCheck.js"), "utf8");
  const shim = `function baseName(system) {
  const gen = (system.cpp_header || "").match(/#include\\s+"([\\w]+)\\.generated\\.h"/);
  if (gen) return gen[1];
  return "System";
}
function headerClasses(header) {
  const code = (header || "").replace(/\\/\\*[\\s\\S]*?\\*\\//g, "").replace(/\\/\\/.*$/gm, "");
  return [...code.matchAll(/\\b(?:class|struct)\\s+(?:\\w+_API\\s+)?([UAFIE][A-Z]\\w*)\\s*(?:final\\s*)?[:{]/g)].map((m) => m[1]);
}`;
  const file = path.join(os.tmpdir(), `ue5-check-${process.pid}.mjs`);
  fs.writeFileSync(file, raw.replace('import { baseName, headerClasses } from "./zipExport";', shim));
  const { checkSystem } = await import(pathToFileURL(file).href);
  const issues = checkSystem(program.starter).filter((issue) => issue.severity === "error");
  assert.deepEqual(issues, []);
});
