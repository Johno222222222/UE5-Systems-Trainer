// Learn questions and the Big Picture, taken from the open system's graph,
// C++ lines, and properties. Owned challenges stay. Nothing here is a title swap.

import { challengesOf } from "./practice.mjs";
import { readEventGraph } from "./graph.mjs";

function unique(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = String(item?.prompt || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function sourceRows(system) {
  return String(system?.cpp_source || "").split("\n");
}

function quotedLine(system) {
  const rows = sourceRows(system);
  const index = rows.findIndex((row) => row.trim() && !row.trim().startsWith("#include") && !row.trim().startsWith("//"));
  if (index < 0) return null;
  return { line: index + 1, text: rows[index].trim() };
}

function propertiesOf(header) {
  const properties = [];
  for (const match of String(header || "").matchAll(/UPROPERTY\s*\(([^)]*)\)\s*[\w:<>]+\s+(\w+)/g)) {
    properties.push({ name: match[2], meta: match[1], replicated: /Replicated|RepNotify/i.test(match[1]) });
  }
  return properties;
}

function nodeFacts(system) {
  const graph = readEventGraph(system || {});
  return (graph.nodes || []).map((node) => ({
    id: node.id,
    label: String(node.label || node.data?.action || node.data?.variable || node.data?.name || node.catalog || "Node"),
    catalog: String(node.catalog || ""),
    x: Number(node.x) || 0,
    y: Number(node.y) || 0,
  }));
}

function question(id, level, prompt, choices, answer, why) {
  return { id, level, prompt, choices, answer, why_people_pick: why };
}

function beginnerExtras(system) {
  const name = system?.system_name || "This system";
  const nodes = nodeFacts(system);
  const props = propertiesOf(system?.cpp_header);
  const line = quotedLine(system);
  const questions = [];
  const first = nodes[0];
  if (first) {
    questions.push(question(
      "learn-setup",
      "beginner",
      `${name}: the event graph starts at "${first.label}". What stops if that node is deleted?`,
      [
        `The chain that begins at ${first.label} never runs.`,
        "Tick starts the same chain on its own.",
        "The widget starts the same chain.",
      ],
      0,
      `${first.label} is the start of this graph.`,
    ));
  }
  const caster = nodes.find((node) => /cast/i.test(`${node.label} ${node.catalog}`));
  if (caster) {
    questions.push(question(
      "learn-depend",
      "beginner",
      `${name} contains "${caster.label}". What happens if every usable Blueprint gets its own cast next to it?`,
      [
        "The cast list grows with every new actor.",
        "One interface call stays stable.",
        "The constructor lists them once and is done.",
      ],
      0,
      `${caster.label} is the cast. An interface stays one call.`,
    ));
  }
  const replicated = props.find((item) => item.replicated);
  if (replicated) {
    questions.push(question(
      "learn-net",
      "beginner",
      `${name} replicates ${replicated.name}. What happens if a client writes ${replicated.name} itself?`,
      [
        `That copy of ${replicated.name} can disagree with the server.`,
        `The server adopts the client's ${replicated.name}.`,
        "The widget rejects the write.",
      ],
      0,
      `${replicated.name} is written with authority.`,
    ));
  }
  if (line) {
    questions.push(question(
      "learn-line",
      "beginner",
      `${name} line ${line.line} reads \`${line.text}\`. Which machine should be allowed to run that line when it changes shared state?`,
      [
        "The authority, then clients hear the result.",
        "Every client, so the bar moves early.",
        "The constructor, once.",
      ],
      0,
      "The quoted line is a write. Authority owns writes of shared state.",
    ));
  }
  return questions;
}

function intermediateExtras(system) {
  const name = system?.system_name || "This system";
  const nodes = nodeFacts(system);
  const props = propertiesOf(system?.cpp_header);
  const line = quotedLine(system);
  const questions = [];
  const timer = nodes.find((node) => /timer|tick/i.test(`${node.label} ${node.catalog}`));
  const interval = (system?.tunable_parameters || []).find((item) => /interval|rate|seconds|period/i.test(`${item.key} ${item.label}`));
  if (timer || interval) {
    const label = interval ? `${interval.label || interval.key}` : timer.label;
    questions.push(question(
      "learn-what-if",
      "intermediate",
      `${name}: ${label} is the schedule. What happens if that interval changes from 0.1 to 0.5?`,
      [
        "The check runs less often.",
        "The check runs every frame.",
        "The check moves into the constructor.",
      ],
      0,
      "A longer timer sleeps longer. Tick would not.",
    ));
  } else if (line) {
    questions.push(question(
      "learn-what-if",
      "intermediate",
      `${name} has no timer node. What happens if you move \`${line.text}\` onto Tick at 0.5 second intervals instead of the event that owns it?`,
      [
        "The line runs on a clock even when nothing asked.",
        "The line runs only when its event fires.",
        "The constructor publishes it.",
      ],
      0,
      "Tick does not wait for the event.",
    ));
  }
  const replicated = props.find((item) => item.replicated) || props[0];
  if (line && replicated) {
    questions.push(question(
      "learn-cpp",
      "intermediate",
      `${name} line ${line.line} is \`${line.text}\` and ${replicated.name} is the property. What happens if that line runs with no authority check?`,
      [
        `Every machine can write a different ${replicated.name}.`,
        `Only the server writes ${replicated.name}.`,
        "The header ignores the line.",
      ],
      0,
      `The repair is an authority check before ${replicated.name} changes.`,
    ));
  } else if (line) {
    questions.push(question(
      "learn-cpp",
      "intermediate",
      `What happens if ${name} runs \`${line.text}\` from Tick instead of from the event graph?`,
      [
        "The work repeats while nothing changed.",
        "The event still gates it.",
        "The header skips the line.",
      ],
      0,
      "Tick does not know whether the event happened.",
    ));
  }
  const follower = nodes[0]?.label || replicated?.name || name;
  questions.push(question(
    "learn-expand",
    "intermediate",
    `A follow-on subsystem Tick-polls ${name} to watch ${follower}. What is the expansion that keeps the same result?`,
    [
      `Listen for ${follower} to change, instead of polling.`,
      "Poll twice as often.",
      "Write the value in the constructor.",
    ],
    0,
    "A listener is the expansion. Tick is the inefficiency.",
  ));
  return questions;
}

export function learnQuestions(system, level = "beginner") {
  const owned = challengesOf(system).map((item, index) => ({
    ...item,
    id: item.id || `owned-${index}`,
    level: "beginner",
    prompt: item.prompt || item.title,
  }));
  const beginner = unique(owned.concat(beginnerExtras(system)));
  if (level !== "intermediate") return beginner;
  return unique(beginner.concat(intermediateExtras(system)));
}

function expansionsOf(system, nodes, props, line) {
  const name = system?.system_name || "This system";
  const out = [];
  const replicated = props.find((item) => item.replicated);
  if (replicated) out.push(`${replicated.name} stays server-authored. ${name} clients read OnRep and do not write it.`);
  const tick = nodes.find((node) => /tick/i.test(`${node.label} ${node.catalog}`));
  if (tick) out.push(`Replace ${tick.label} in ${name} with a timer. The graph currently schedules work from Tick.`);
  else if (nodes[0]) out.push(`${nodes[0].label} already starts ${name}. A new listener should bind there, not add a Tick.`);
  const param = (system?.tunable_parameters || [])[0];
  if (param) out.push(`Move ${param.label || param.key} into a data row. It is a designer number, not a literal in ${name}.`);
  else if (line) out.push(`Keep \`${line.text}\` on line ${line.line} behind the event that owns it.`);
  const includes = [];
  for (const match of `${system?.cpp_header || ""}\n${system?.cpp_source || ""}`.matchAll(/#include\s+"([^"]+)"/g)) {
    if (!match[1].endsWith(".generated.h")) includes.push(match[1]);
  }
  if (includes[0]) out.push(`${name} depends on ${includes[0]}. A new subsystem should include that header, not copy the function.`);
  if (!out.length) out.push(`${name} has no graph and no replicated property yet. Add the event before you add a Tick.`);
  return out.slice(0, 4);
}

export function pictureOf(system) {
  const source = String(system?.cpp_source || "");
  const lines = source.split("\n").slice(0, 18).map((text, index) => ({ line: index + 1, text }));
  const props = propertiesOf(system?.cpp_header);
  const dependencies = [];
  for (const match of `${system?.cpp_header || ""}\n${source}`.matchAll(/#include\s+"([^"]+)"/g)) {
    if (!match[1].endsWith(".generated.h") && !dependencies.includes(match[1])) dependencies.push(match[1]);
  }
  for (const prop of props) {
    const label = prop.replicated ? `replicates ${prop.name}` : prop.name;
    if (!dependencies.includes(label)) dependencies.push(label);
  }
  const nodes = nodeFacts(system);
  for (const node of nodes) {
    if (!dependencies.includes(node.label)) dependencies.push(node.label);
  }
  const graph = readEventGraph(system || {});
  const wires = (graph.wires || []).map((wire) => ({
    from: wire.from?.node || wire.from,
    to: wire.to?.node || wire.to,
  })).filter((wire) => wire.from && wire.to);
  return {
    nodes,
    wires,
    lines,
    properties: props.map((item) => item.name).slice(0, 8),
    dependencies: dependencies.slice(0, 8),
    expansions: expansionsOf(system, nodes, props, quotedLine(system)),
  };
}
