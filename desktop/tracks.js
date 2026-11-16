"use strict";

// Genre tracks for Programs, and the shorter general courses.
// Images are SVG built from these same sections, not shipped screenshots.

const GENRES = ["fps", "tps", "horror", "strategy"];
const LEVELS = ["beginner", "intermediate"];

const SECTIONS = {
  fps: [
    ["interaction", "Look and interact", "interaction"],
    ["inventory", "Carry slots", "inventory"],
    ["weapon", "Weapon and ammo", "combat"],
    ["health", "Health on the server", "health"],
    ["input", "Enhanced Input", "input"],
    ["save", "Save the slot", "save"],
  ],
  tps: [
    ["camera", "Camera and aim", "interaction"],
    ["health", "Health on the server", "health"],
    ["weapon", "Third-person weapon", "combat"],
    ["inventory", "Carry slots", "inventory"],
    ["ai", "Squad guard", "ai"],
    ["save", "Save the slot", "save"],
  ],
  horror: [
    ["interaction", "Use the thing you face", "interaction"],
    ["ai", "The thing that hunts", "ai"],
    ["health", "Fear and health", "health"],
    ["inventory", "What you can hold", "inventory"],
    ["dialogue", "One voice, few lines", "dialogue"],
    ["save", "Save the slot", "save"],
  ],
  strategy: [
    ["save", "The match record", "save"],
    ["dialogue", "Orders and flags", "dialogue"],
    ["inventory", "Shared stores", "inventory"],
    ["ai", "Unit brains", "ai"],
    ["abilities", "Ability costs", "gas"],
    ["vehicles", "Weight and towing", "vehicle"],
  ],
};

const JOHNO = {
  fps: {
    intermediate: {
      interaction: "Area of interest decides who hears the interact. Do not replicate the prompt widget.",
      inventory: "A 10-slot gunsmith reads the weapon from a data asset. Replicate the equipped state, not every slot mesh.",
      weapon: "Wear and heat live on the weapon component. A tactical wipe is an input, not Tick.",
      health: "Limb health is server state. A 10% attribute clamp is C++ and is not a gameplay effect.",
      input: "Enhanced Input can use an L2 modifier layer and a radial menu. The action still asks the server.",
      save: "Save the slot index and the equipped id. Do not save the motion-matching pose.",
    },
  },
};

function esc(value) {
  return String(value || "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[ch]));
}

function graphSvg(section) {
  const nodes = section.graph;
  const why = section.why;
  const boxes = nodes.map((label, index) => {
    const x = 24 + index * 150;
    return `<rect x="${x}" y="36" width="132" height="44" rx="6" fill="#121826" stroke="#0099ff"/>
      <text x="${x + 66}" y="62" fill="#e8eef8" font-size="11" text-anchor="middle" font-family="sans-serif">${esc(label)}</text>`;
  }).join("");
  const wires = nodes.slice(1).map((_, index) => {
    const x1 = 24 + index * 150 + 132;
    const x2 = 24 + (index + 1) * 150;
    return `<path d="M ${x1} 58 H ${x2}" stroke="#ff7a1a" stroke-width="2" fill="none"/>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 940 160">
  <rect width="940" height="160" fill="#0c1018"/>
  ${wires}${boxes}
  <rect x="24" y="100" width="892" height="40" rx="6" fill="#1a1208" stroke="#ff7a1a"/>
  <text x="40" y="124" fill="#ffb06a" font-size="12" font-family="sans-serif">WHY ${esc(why)}</text>
</svg>`;
}

function hubSvg(track) {
  const spokes = track.sections.slice(0, 6);
  const left = spokes.slice(0, 3);
  const right = spokes.slice(3);
  const box = (item, x, y) => `<rect x="${x}" y="${y}" width="250" height="54" rx="8" fill="#121826" stroke="#3d4d66"/>
    <text x="${x + 16}" y="${y + 32}" fill="#9ecbff" font-size="13" font-family="sans-serif">${esc(item.title)}</text>`;
  const side = (items, x) => items.map((item, index) => box(item, x, 28 + index * 70)).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 940 280">
  <rect width="940" height="280" fill="#0c1018"/>
  ${side(left, 24)}${side(right, 666)}
  <rect x="330" y="78" width="280" height="110" rx="10" fill="#101828" stroke="#0099ff"/>
  <text x="470" y="128" fill="#e8eef8" font-size="16" text-anchor="middle" font-family="sans-serif">${esc(track.title)}</text>
  <text x="470" y="152" fill="#ff7a1a" font-size="12" text-anchor="middle" font-family="sans-serif">${esc(track.genre)} · ${esc(track.level)}</text>
</svg>`;
}

function quizFor(section, level) {
  const name = section.title;
  const beginner = [
    {
      id: `${section.id}-when`,
      prompt: `What happens if ${name} runs on Tick?`,
      choices: ["It keeps working while nothing changed.", "A timer or an event is enough.", "The constructor should do it."],
      answer: 1,
      why: "Tick spends time when the player is standing still.",
    },
    {
      id: `${section.id}-dep`,
      prompt: `What does ${name} depend on first?`,
      choices: [section.depends, "The widget deciding the rule.", "A cast to every Blueprint."],
      answer: 0,
      why: `${section.depends} owns the rule. The widget only draws it.`,
    },
  ];
  if (level === "beginner") return beginner;
  return beginner.concat([
    {
      id: `${section.id}-hyp`,
      prompt: `What happens if the replicated number in ${name} is written on the client?`,
      choices: ["The server copy and the client copy disagree.", "Nothing. Clients own shared state.", "The widget becomes authoritative."],
      answer: 0,
      why: "Shared state is written where the authority is.",
    },
    {
      id: `${section.id}-cpp`,
      prompt: `Which C++ shape fits ${name}?`,
      choices: [section.cpp, "A Tick function that also draws the widget.", "A cast chain that grows with every new actor."],
      answer: 0,
      why: section.why,
    },
  ]);
}

function sectionFor(row, index, genre, level) {
  const [id, title, preset] = row;
  const note = JOHNO[genre]?.[level]?.[id];
  const depends = {
    interaction: "A timer and one interface",
    inventory: "Item data, not the widget",
    weapon: "Server ammo and a reload action",
    health: "Authority and OnRep",
    input: "One Enhanced Input action",
    save: "One slot struct",
    camera: "The pawn camera, not Tick",
    ai: "A state, not a Tick scan",
    dialogue: "A data table row",
    abilities: "A gameplay tag",
    vehicles: "A vehicle component",
  }[id] || "The component that owns the rule";
  const cpp = {
    interaction: "Set a timer, then call the interface.",
    inventory: "Read the stack size from the data asset.",
    weapon: "Reload on the server from reserve.",
    health: "Subtract health only with authority.",
    input: "Bind the action once in Begin Play.",
    save: "Write the slot index, not the mesh.",
    camera: "Read control rotation when the aim event fires.",
    ai: "Advance the patrol on a timer.",
    dialogue: "Read the next line from the table.",
    abilities: "Activate by gameplay tag.",
    vehicles: "Apply drive input on the server.",
  }[id] || "Keep the rule in the component.";
  const why = note || `${title} stays off Tick. ${depends} is the dependency.`;
  const section = {
    id,
    order: index + 1,
    title,
    preset,
    depends,
    cpp,
    why,
    reading: [
      `${title} is the step you build at position ${index + 1} in this ${genre} track.`,
      why,
      level === "intermediate"
        ? `An inefficient version puts this on Tick or casts to every Blueprint. The compatible version keeps ${depends.toLowerCase()}.`
        : `The assignment is to name the dependency in your own words.`,
    ],
    graph: ["Begin Play", title.split(" ")[0], "Branch"],
    assignment: {
      kind: level === "intermediate" ? "cpp" : "vocabulary",
      prompt: level === "intermediate"
        ? `In one line, say the C++ rule for ${title}.`
        : `Name what ${title} depends on.`,
      accept: [id, preset].concat(depends.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3)).slice(0, 4),
    },
  };
  section.quiz = quizFor(section, level);
  section.image = graphSvg(section);
  return section;
}

function examFor(track) {
  const first = track.sections[0];
  const last = track.sections[track.sections.length - 1];
  return {
    pass_mark: 70,
    questions: [
      {
        id: "mc-order",
        kind: "mc",
        prompt: `What do you build first in this ${track.genre} track?`,
        choices: [first.title, last.title, "The widget", "The material"],
        answer: 0,
        why: `${first.title} is the first section.`,
      },
      {
        id: "mc-last",
        kind: "mc",
        prompt: "What comes last?",
        choices: [last.title, first.title, "A cast to the player", "Tick"],
        answer: 0,
        why: `${last.title} is the last section.`,
      },
      {
        id: "tf-tick",
        kind: "tf",
        prompt: "True or false: Tick is the right place for a look trace.",
        choices: ["True", "False"],
        answer: 1,
        why: "A timer sleeps between looks.",
      },
      {
        id: "tf-widget",
        kind: "tf",
        prompt: "True or false: the widget should own the gameplay number.",
        choices: ["True", "False"],
        answer: 1,
        why: "The component owns the number. The widget draws it.",
      },
      {
        id: "graph-repair",
        kind: "graph-repair",
        prompt: "The event graph wires Tick straight into the look trace. Which repair is the one to keep?",
        choices: ["Leave Tick on the trace.", "Replace Tick with a timer, then the trace.", "Delete the trace."],
        answer: 1,
        broken: "Tick → Line Trace",
        why: "The timer is the repair. Tick is the bug.",
      },
      {
        id: "cpp-repair",
        kind: "cpp-repair",
        prompt: "This health line runs on every machine. Which repair belongs in the C++?",
        choices: ["Health -= Amount;", "if (HasAuthority()) Health -= Amount;"],
        answer: 1,
        broken: "Health -= Amount;",
        why: "Authority is the repair. A bare subtract is the bug.",
      },
    ],
  };
}

function buildTracks() {
  const tracks = [];
  for (const genre of GENRES) {
    for (const level of LEVELS) {
      const sections = SECTIONS[genre].map((row, index) => sectionFor(row, index, genre, level));
      const track = {
        id: `${genre}-${level}`,
        title: `${genre.toUpperCase()}, ${level}`,
        genre,
        level,
        summary: level === "beginner"
          ? `The first ${genre} systems, in the order you would build them.`
          : `The same ${genre} order, with C++ questions, inefficiencies, and a harder exam.`,
        sections,
      };
      track.exam = examFor(track);
      track.map = hubSvg(track);
      tracks.push(track);
    }
  }
  return tracks;
}

function scoreQuestions(questions, answers) {
  const list = Array.isArray(questions) ? questions : [];
  const given = answers && typeof answers === "object" ? answers : {};
  let correct = 0;
  for (const question of list) {
    if (Number(given[question.id]) === question.answer) correct += 1;
  }
  const total = list.length;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  return { correct, total, percent, passed: percent >= 70 };
}

function trackById(id) {
  return buildTracks().find((track) => track.id === id) || null;
}

function problemsForTracks(tracks = buildTracks()) {
  const problems = [];
  const seen = new Set();
  for (const genre of GENRES) {
    for (const level of LEVELS) {
      if (!tracks.some((track) => track.genre === genre && track.level === level)) {
        problems.push(`${genre} ${level} is missing`);
      }
    }
  }
  for (const track of tracks) {
    if (seen.has(track.id)) problems.push(`repeated track ${track.id}`);
    seen.add(track.id);
    let last = 0;
    for (const section of track.sections || []) {
      if (section.order < last) problems.push(`${track.id} section ${section.id} is out of order`);
      last = section.order;
      if (!section.reading?.length) problems.push(`${track.id} ${section.id} has no lesson`);
      if (!section.assignment?.prompt || !section.assignment.accept?.length) problems.push(`${track.id} ${section.id} has no assignment`);
      if (!section.quiz?.length) problems.push(`${track.id} ${section.id} has no quiz`);
      if (!section.image?.includes("<svg")) problems.push(`${track.id} ${section.id} has no image`);
    }
    const kinds = new Set((track.exam?.questions || []).map((item) => item.kind));
    for (const kind of ["mc", "tf", "graph-repair", "cpp-repair"]) {
      if (!kinds.has(kind)) problems.push(`${track.id} exam is missing ${kind}`);
    }
  }
  return problems;
}

module.exports = {
  GENRES,
  LEVELS,
  buildTracks,
  trackById,
  scoreQuestions,
  problemsForTracks,
  graphSvg,
  hubSvg,
};
