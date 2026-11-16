// Extra Learn questions from the open system. Beginner stays on this graph.
// Intermediate adds the prediction questions. Prompts are not repeated.

import { challengesOf } from "./practice.mjs";

function nodesOf(system) {
  const named = [];
  for (const node of system?.node_graph_nodes || []) {
    if (node?.label) named.push(String(node.label));
  }
  return named;
}

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

function beginnerExtras(system) {
  const name = system?.system_name || "This system";
  const nodes = nodesOf(system);
  const first = nodes[0] || "Begin Play";
  const questions = [
    {
      id: "learn-setup",
      level: "beginner",
      prompt: `What happens if ${first} is removed from ${name}?`,
      choices: [
        "The chain that starts there does not run.",
        "Tick starts the same work.",
        "The widget starts the same work.",
      ],
      answer: 0,
      why_people_pick: `${first} is the start of this graph.`,
    },
    {
      id: "learn-depend",
      level: "beginner",
      prompt: `What happens if ${name} casts to every Blueprint it can use?`,
      choices: [
        "The cast list grows with every new actor.",
        "An interface stays one call.",
        "The constructor lists them once.",
      ],
      answer: 0,
      why_people_pick: "A cast chain is the dependency to avoid.",
    },
  ];
  if (/replicat|health|ammo|server/i.test(`${name} ${system?.network_notes || ""} ${system?.cpp_header || ""}`)) {
    questions.push({
      id: "learn-net",
      level: "beginner",
      prompt: `What happens if a client writes the replicated number in ${name}?`,
      choices: [
        "That copy can disagree with the server.",
        "The server adopts the client number.",
        "The widget rejects it.",
      ],
      answer: 0,
      why_people_pick: "Shared numbers are written with authority.",
    });
  }
  return questions;
}

function intermediateExtras(system) {
  const name = system?.system_name || "This system";
  return [
    {
      id: "learn-what-if",
      level: "intermediate",
      prompt: `What happens if the interval in ${name} changes from 0.1 to 0.5?`,
      choices: [
        "The check runs less often.",
        "The check runs every frame.",
        "The check runs in the constructor.",
      ],
      answer: 0,
      why_people_pick: "A longer timer sleeps longer.",
    },
    {
      id: "learn-cpp",
      level: "intermediate",
      prompt: `What happens if the C++ for ${name} subtracts a shared number with no authority check?`,
      choices: [
        "Every machine can write a different value.",
        "Only the server writes it.",
        "The header ignores the line.",
      ],
      answer: 0,
      why_people_pick: "The repair is the authority check.",
    },
    {
      id: "learn-expand",
      level: "intermediate",
      prompt: `What happens if you add a follow-on subsystem that Tick-polls ${name}?`,
      choices: [
        "The new piece works while nothing changed.",
        "The new piece can listen for the change.",
        "The constructor publishes it.",
      ],
      answer: 0,
      why_people_pick: "A listener is the expansion. Tick is the inefficiency.",
    },
  ];
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

export function pictureOf(system) {
  const source = String(system?.cpp_source || "");
  const lines = source.split("\n").slice(0, 18).map((text, index) => ({ line: index + 1, text }));
  const header = String(system?.cpp_header || "");
  const properties = [];
  for (const match of header.matchAll(/UPROPERTY\s*\([^)]*\)\s*[\w:<>]+\s+(\w+)/g)) {
    if (!properties.includes(match[1])) properties.push(match[1]);
  }
  const dependencies = [];
  for (const match of `${header}\n${source}`.matchAll(/#include\s+"([^"]+)"/g)) {
    if (!match[1].endsWith(".generated.h") && !dependencies.includes(match[1])) dependencies.push(match[1]);
  }
  const nodes = (system?.node_graph_nodes || []).map((node) => node.label).filter(Boolean);
  const name = system?.system_name || "This system";
  return {
    nodes: nodes.length ? nodes.slice(0, 6) : ["Begin Play", name],
    lines,
    properties: properties.slice(0, 8),
    dependencies: dependencies.slice(0, 8),
    expansions: [
      "A listener instead of Tick",
      "One interface instead of a cast list",
      "Authority on the shared number",
      "A data row for the designer number",
    ],
  };
}
