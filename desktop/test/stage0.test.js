"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");
const { UNREAL_VERSIONS, DEFAULT_UNREAL_VERSION, LEGACY_UNREAL_VERSION, normalizeUnrealVersion } = require("../logic");

async function ui() {
  return import(pathToFileURL(path.join(__dirname, "..", "..", "frontend", "src", "lib", "stage0.mjs")).href);
}

test("the workspace and the server agree on Unreal versions", async () => {
  const stage = await ui();
  assert.deepEqual(stage.UNREAL_VERSIONS, UNREAL_VERSIONS);
  assert.equal(stage.DEFAULT_UNREAL_VERSION, DEFAULT_UNREAL_VERSION);
  assert.equal(stage.LEGACY_UNREAL_VERSION, LEGACY_UNREAL_VERSION);
  assert.equal(stage.normalizeUnrealVersion("5.8"), normalizeUnrealVersion("5.8"));
  assert.equal(stage.normalizeUnrealVersion("UE 5.4+"), normalizeUnrealVersion("UE 5.4+"));
  assert.equal(stage.normalizeUnrealVersion("6.0"), null);
});

test("new project is dirty only when the screen changed, and the next save creates", async () => {
  const stage = await ui();
  const blank = stage.blankSnapshot({ unreal_version: "5.8" });
  assert.equal(blank.project_id, null);
  assert.equal(blank.prompt, "");
  assert.equal(blank.unreal_version, "5.8");
  assert.equal(stage.isWorkspaceDirty(blank, blank), false);
  const edited = { ...blank, prompt: "A weapon component" };
  assert.equal(stage.isWorkspaceDirty(edited, blank), true);
  const kept = stage.blankSnapshot({ project_context: "tactical FPS", unreal_version: "5.7" });
  assert.equal(kept.project_context, "tactical FPS");
  assert.equal(kept.unreal_version, "5.7");
  assert.equal(stage.saveRequest(null, false), "create");
  assert.equal(stage.saveRequest("proj_1", false), "update");
  assert.equal(stage.saveRequest("proj_1", true), "create");
});

test("compile headline agrees with the AI review", async () => {
  const { compileHeadline } = await ui();
  const pattern = [{ severity: "warning", message: "tick" }];
  assert.equal(compileHeadline([], null).text, "No likely mistakes found");
  assert.equal(compileHeadline([], { status: "done", issues: [] }).text, "No likely mistakes found");
  assert.equal(compileHeadline(pattern, null).clean, false);
  assert.match(compileHeadline([], { status: "done", issues: [{ severity: "error", message: "missing include" }] }).text, /1 error/);
  assert.equal(compileHeadline([], { status: "done", issues: [{ severity: "error", message: "missing include" }] }).text.includes("No likely mistakes found"), false);
  assert.match(compileHeadline([], { status: "running" }).text, /AI review running/);
  assert.match(compileHeadline([], { status: "error" }).text, /AI review failed/);
  assert.equal(compileHeadline([], { status: "running" }).clean, false);
});

test("feedback link carries the version and category and does not send mail", async () => {
  const { feedbackUrl } = await ui();
  const url = new URL(feedbackUrl({ version: "1.2.3", category: "Bug" }));
  assert.equal(url.origin + url.pathname, "https://github.com/Johno222222222/blueprint-builder/issues/new");
  assert.match(url.searchParams.get("title"), /\[Bug\]/);
  assert.match(url.searchParams.get("body"), /App version: 1\.2\.3/);
  assert.match(url.searchParams.get("body"), /Category: Bug/);
  assert.equal(url.searchParams.get("body").toLowerCase().includes("mailto:"), false);
});

test("setup ticks round-trip as step numbers", async () => {
  const { setupDoneList, setupDoneMap } = await ui();
  assert.deepEqual(setupDoneList({ 1: true, 2: false, 4: true }), [1, 4]);
  assert.deepEqual(setupDoneMap([1, 4]), { 1: true, 4: true });
});
