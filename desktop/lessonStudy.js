"use strict";

// Adds the 1.19.0 study layer onto authored lessons: more questions grounded in
// each lesson's own sentences and C++ lines, fill-in blanks, and line notes.
// It does not rewrite the reading.

const { loadGraph, nodeLabel, cppExcerpt, renderGraph, hubSvg } = require("./lessonRender");
const { explainLine, nodeWhy, headerNote, expansionExamples } = require("../frontend/src/lib/lineExplain");

function textOf(reading) {
  return (reading || []).map((block) => (typeof block === "string" ? block : `${block.heading || ""} ${block.body || ""}`)).join(" ");
}

function sentencesOf(reading) {
  return textOf(reading)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.split(/\s+/).length >= 12 && sentence.length <= 320);
}

function hash(value) {
  let h = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function pickStable(items, key, count) {
  const ranked = items.map((item, index) => ({ item, index, rank: hash(`${key}:${index}:${typeof item === "string" ? item : item.text || item.label || ""}`) }));
  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
  const chosen = ranked.slice(0, Math.min(count, ranked.length));
  chosen.sort((a, b) => a.index - b.index);
  return chosen.map((row) => row.item);
}

function codeLines(cpp) {
  return (cpp || []).filter((row) => {
    const text = String(row.text || "").trim();
    if (text.length < 8) return false;
    if (text.startsWith("#include") || text.startsWith("#pragma") || text.startsWith("//")) return false;
    if (text === "{" || text === "}") return false;
    return true;
  });
}

function graphNodes(graphId) {
  const doc = loadGraph(graphId);
  const nodes = doc?.graph?.nodes || doc?.nodes || [];
  return nodes.map((node) => ({
    key: node.key || node.id,
    label: nodeLabel(node),
    catalog: node.catalog || "",
  })).filter((node) => node.label);
}

function remember(used, prompt) {
  const key = String(prompt || "").trim().toLowerCase();
  if (!key || used.has(key)) return false;
  used.add(key);
  return true;
}

function pushQuestion(list, used, question) {
  if (!question?.prompt || !question.choices?.length) return false;
  if (!remember(used, question.prompt)) return false;
  list.push(question);
  return true;
}

function cppQuestion(section, track, line) {
  const text = String(line.text || "").trim();
  const note = explainLine(text);
  const wrong = [
    "This line runs on Tick even when nobody asked.",
    "This line writes the value from every client.",
    "This line is only a comment and the game skips it.",
  ].filter((item) => item !== note);
  return {
    id: `${section.id}-x119-line`,
    kind: "mc",
    prompt: `What does this line mean: ${text}?`,
    choices: [note, wrong[0], wrong[1], wrong[2]],
    answer: 0,
    why: `${track.title} / ${section.title}: ${note}`,
  };
}

function graphQuestion(section, node, fragment) {
  const layman = nodeWhy(node.catalog, node.label);
  return {
    id: `${section.id}-x119-node`,
    kind: "mc",
    prompt: `What does the ${node.label} node do, and where should it go, given that ${fragment}?`,
    choices: [
      layman,
      `Move ${node.label} onto Tick so it keeps asking while nothing changed.`,
      `Put ${node.label} in the constructor and never run it again.`,
      `Replace ${node.label} with a cast to every Blueprint that might show up.`,
    ],
    answer: 0,
    why: layman,
  };
}

function fromSentence(section, sentence, index) {
  const title = section.title;
  const shape = index % 4;
  if (shape === 0) {
    return {
      kind: "tf",
      prompt: `True or false: the opposite of this ${title} rule is the one to ship — ${sentence}`,
      choices: ["True", "False"],
      answer: 1,
      why: `False. The rule to keep is: ${sentence}`,
    };
  }
  if (shape === 1) {
    return {
      kind: "tf",
      prompt: `True or false: ${title} should ignore this and do the opposite — ${sentence}`,
      choices: ["True", "False"],
      answer: 1,
      why: `False. ${title} keeps that rule.`,
    };
  }
  if (shape === 2) {
    return {
      kind: "mc",
      prompt: `${sentence} Which mistake breaks that ${title} rule?`,
      choices: [
        "Moving the work onto Tick, or writing the shared value off the authority.",
        "Leaving the work on the event the sentence names.",
        "Reading the result the previous node already stored.",
        "Keeping the neighbor system on its own event.",
      ],
      answer: 0,
      why: sentence,
    };
  }
  return {
    kind: "mc",
    prompt: `${sentence} Putting that rule back is the repair for ${title}. Which choice is that repair?`,
    choices: [
      `Keep the rule as written: ${sentence}`,
      "A Tick that polls the same fact.",
      "A client write with no authority check.",
      "A copy of the neighbor graph's function.",
    ],
    answer: 0,
    why: `The sentence is the lesson. The other three are the breaks ${title} is warning you about.`,
  };
}

function fillQuiz(section, track, used, goal) {
  const lines = codeLines(section.cpp);
  const nodes = graphNodes(section.graph);
  const bits = sentencesOf(section.reading);
  if (lines[0]) {
    const question = cppQuestion(section, track, lines[0]);
    if (!pushQuestion(section.quiz, used, question)) {
      question.id = `${section.id}-x119-line-owned`;
      question.prompt = `What does this line mean in ${section.title}: ${String(lines[0].text).trim()}?`;
      pushQuestion(section.quiz, used, question);
    }
  }
  if (nodes[0]) {
    const fragment = (bits[0] || section.why || section.title).split(/\s+/).slice(0, 14).join(" ");
    const question = graphQuestion(section, nodes[0], fragment);
    if (!pushQuestion(section.quiz, used, question)) {
      question.id = `${section.id}-x119-node-owned`;
      question.prompt = `What does the ${nodes[0].label} node do in ${section.title}, and where should it go?`;
      pushQuestion(section.quiz, used, question);
    }
  }
  let cursor = 0;
  while (section.quiz.length < goal && cursor < bits.length) {
    const sentence = bits[cursor];
    const question = fromSentence(section, sentence, section.quiz.length + cursor);
    question.id = `${section.id}-x119-s${cursor}`;
    pushQuestion(section.quiz, used, question);
    cursor += 1;
  }
  let lineIndex = 0;
  let spin = 0;
  while (section.quiz.length < goal && lines.length && spin < lines.length * 3) {
    const line = lines[lineIndex % lines.length];
    const text = String(line.text || "").trim();
    const note = explainLine(text);
    const shape = spin % 3;
    const question = {
      id: `${section.id}-x119-more${spin}`,
      kind: shape === 1 ? "tf" : "mc",
      prompt: shape === 0
        ? `What does this line mean in ${section.title}: ${text}?`
        : shape === 1
          ? `True or false: ${section.title} runs \`${text}\` from Tick even when its event did not fire.`
          : `${section.title} owns \`${text}\`. Where does that line belong?`,
      choices: shape === 1
        ? ["True", "False"]
        : [
          note,
          "On Tick, whether or not anyone asked.",
          "On every client, as a local write.",
          "In the constructor, once, with no event.",
        ],
      answer: shape === 1 ? 1 : 0,
      why: note,
    };
    pushQuestion(section.quiz, used, question);
    lineIndex += 1;
    spin += 1;
  }
  let nodeSpin = 0;
  while (section.quiz.length < goal && nodes.length && nodeSpin < nodes.length * 2) {
    const node = nodes[nodeSpin % nodes.length];
    const question = {
      id: `${section.id}-x119-node${nodeSpin}`,
      kind: "mc",
      prompt: `What does the ${node.label} node do in ${section.title}, and where should it go?`,
      choices: [
        nodeWhy(node.catalog, node.label),
        `Move ${node.label} onto Tick.`,
        `Run ${node.label} from the constructor only.`,
        `Replace ${node.label} with a cast to every Blueprint.`,
      ],
      answer: 0,
      why: nodeWhy(node.catalog, node.label),
    };
    pushQuestion(section.quiz, used, question);
    nodeSpin += 1;
  }
}

function fillExam(track, used, goal) {
  const exam = track.exam.questions;
  let guard = 0;
  while (exam.length < goal && guard < 400) {
    guard += 1;
    const section = track.sections[(exam.length + guard) % track.sections.length];
    const bits = sentencesOf(section.reading);
    const sentence = bits[guard % Math.max(bits.length, 1)];
    if (!sentence) break;
    const question = fromSentence(section, sentence, guard + 3);
    question.id = `${track.id}-exam-x119-${exam.length}`;
    question.prompt = `${question.prompt} This is the ${track.title} exam item for ${section.title}.`;
    if (!pushQuestion(exam, used, question)) {
      question.prompt = `${section.title} in ${track.title} exam: ${sentence} Which repair keeps that sentence?`;
      question.kind = "mc";
      question.choices = [
        `Keep the sentence's event and its authority rule in ${section.title}.`,
        "Move it onto Tick.",
        "Let the client write it.",
        "Copy it into the neighbor section.",
      ];
      question.answer = 0;
      pushQuestion(exam, used, question);
    }
  }
}

function blanksFor(section) {
  const lines = codeLines(section.cpp);
  const picked = pickStable(lines, `${section.graph || section.id}:cpp`, 3);
  const nodes = graphNodes(section.graph);
  const nodeCount = 2 + (hash(`${section.id}:nodes`) % 2);
  const pickedNodes = pickStable(nodes, `${section.graph || section.id}:nodes`, nodeCount);
  return {
    cpp: picked.map((row) => ({ line: row.line, text: String(row.text || "").trim() })),
    nodes: pickedNodes.map((node) => ({ key: node.key, label: node.label })),
  };
}

function tasksFor(section) {
  const bits = sentencesOf(section.reading);
  const second = bits[1] || bits[0] || section.why;
  const third = bits[2] || section.why;
  const base = section.assignment || {};
  return [
    {
      id: `${section.id}-repair`,
      kind: "text",
      prompt: base.prompt,
      accept: base.accept || [],
      model: base.model || "",
    },
    {
      id: `${section.id}-rule`,
      kind: "text",
      prompt: `In a sentence of your own, what does ${section.title} tell you to keep? The lesson says: ${second}`,
      accept: (second.match(/[A-Z][A-Za-z0-9_]{3,}/g) || []).slice(0, 2),
      model: second,
    },
    {
      id: `${section.id}-neighbor`,
      kind: "text",
      prompt: `Name what must stay on its own event so this stays true: ${third}`,
      accept: (section.depends || []).slice(0, 2),
      model: `${(section.depends || []).join(", ")} stay on their own events. ${third}`,
    },
    {
      id: `${section.id}-cpp-blank`,
      kind: "cpp-blank",
      prompt: "Three lines of this lesson's C++ are blank. Copy the block, fill those lines, then reveal to compare.",
    },
    {
      id: `${section.id}-graph-blank`,
      kind: "graph-blank",
      prompt: "Two or three nodes in this lesson's graph are blank. Name what each one does, then reveal the labels.",
    },
  ];
}

function annotateSection(section, track) {
  const notes = (section.cpp || []).map((row) => ({
    line: row.line,
    text: row.text,
    note: explainLine(row.text),
  }));
  section.lineNotes = notes;
  section.blanks = blanksFor(section);
  section.tasks = tasksFor(section);
  section.whyLayman = `${section.title}: ${section.why} In plain words, the graph should do that and not a stand-in that asks every frame or writes shared state from a client.`;
  const nodes = graphNodes(section.graph);
  section.nodeNotes = nodes.map((node) => ({
    key: node.key,
    label: node.label,
    layman: nodeWhy(node.catalog, node.label),
  }));
  section.headerNotes = notes
    .filter((row) => /#include/.test(row.text))
    .map((row) => {
      const header = (String(row.text).match(/"([^"]+)"/) || [])[1];
      return header ? { header, note: headerNote(header) } : null;
    })
    .filter(Boolean);
  section.expansionExamples = expansionExamples(`${track?.title || ""} ${section.title} ${section.why} ${(section.depends || []).join(" ")}`);
  return section;
}

function quizGoal() {
  return 12;
}

function examGoal(track) {
  return track.sections.length >= 8 ? 50 : 48;
}

function enrichTrack(track, used) {
  for (const section of track.sections || []) {
    annotateSection(section, track);
    fillQuiz(section, track, used, quizGoal());
  }
  fillExam(track, used, examGoal(track));
  return track;
}

function enrichTracks(tracks) {
  const used = new Set();
  for (const track of tracks) {
    for (const section of track.sections || []) {
      for (const question of section.quiz || []) remember(used, question.prompt);
    }
    for (const question of track.exam?.questions || []) remember(used, question.prompt);
  }
  for (const track of tracks) enrichTrack(track, used);
  return tracks;
}

const COURSE_GRAPH = {
  asc: "gas-effect",
  attributes: "gas-effect",
  activate: "gas-effect",
  effects: "gas-effect",
  authority: "health",
  property: "health",
  onrep: "health",
  rpc: "health",
  table: "inventory-slot",
  row: "inventory-slot",
  asset: "pickup",
  reader: "tactical-ammo",
};

function graphForCourse(course, mod) {
  if (COURSE_GRAPH[mod?.id]) return COURSE_GRAPH[mod.id];
  const blob = `${course?.genre || ""} ${mod?.title || ""} ${mod?.id || ""} ${mod?.takeaway || ""}`.toLowerCase();
  if (/sense|perception|stalk|fear|alert/.test(blob)) return "perception";
  if (/fog|reveal|visible/.test(blob)) return "fog";
  if (/order|command/.test(blob)) return "orders";
  if (/econom|gold|build queue/.test(blob)) return "economy";
  if (/artillery|shell|ballistic/.test(blob)) return "artillery";
  if (/vehicle|throttle|drive/.test(blob)) return "vehicle-drive";
  if (/camera|shoulder/.test(blob)) return "camera";
  if (/door/.test(blob)) return "door";
  if (/patrol|blackboard|behavior/.test(blob)) return "ai-patrol";
  if (/save|slot|checkpoint/.test(blob)) return "save-load";
  if (/ability|effect|attribute|gas|tag/.test(blob)) return "gas-effect";
  if (/inventory|magazine|ammo|slot/.test(blob)) return "inventory-slot";
  if (/pickup|loot/.test(blob)) return "pickup";
  if (/health|damage|armor/.test(blob)) return "health";
  if (/timer|look|trace|interact|input/.test(blob)) return "interact";
  return "interact";
}

function enrichCourse(course) {
  if (!course || course.study119) return course;
  const copy = structuredClone(course);
  const used = new Set();
  for (const mod of copy.modules || []) {
    for (const question of mod.quiz || []) remember(used, question.prompt);
  }
  copy.sections = (copy.modules || []).map((mod, index) => {
    const graph = graphForCourse(copy, mod);
    const reading = String(mod.takeaway || "").split(/\n\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
    const section = {
      id: mod.id,
      title: mod.title,
      order: index + 1,
      graph,
      why: reading[0] ? reading[0].split(/(?<=[.!?])\s+/)[0] : mod.title,
      depends: [],
      reading,
      assignment: {
        prompt: mod.assignment?.prompt || "",
        accept: mod.assignment?.accept || [],
        model: mod.assignment?.prompt || "",
      },
      quiz: mod.quiz || [],
      cpp: cppExcerpt(graph),
    };
    const doc = loadGraph(graph);
    section.image = doc ? renderGraph(doc, { why: section.why }) : "";
    section.flow = hubSvg(section.title, reading.slice(0, 4).map((paragraph) => paragraph.slice(0, 42)));
    annotateSection(section, { title: copy.title, genre: copy.genre });
    fillQuiz(section, { title: copy.title }, used, 12);
    mod.quiz = section.quiz;
    mod.graph = graph;
    mod.reading = reading;
    mod.cpp = section.cpp;
    mod.lineNotes = section.lineNotes;
    mod.blanks = section.blanks;
    mod.tasks = section.tasks;
    mod.whyLayman = section.whyLayman;
    mod.nodeNotes = section.nodeNotes;
    mod.why = section.why;
    mod.expansionExamples = section.expansionExamples;
    mod.image = section.image;
    mod.flow = section.flow;
    return section;
  });
  copy.study119 = true;
  return copy;
}

module.exports = {
  enrichTracks,
  enrichTrack,
  enrichCourse,
  blanksFor,
  sentencesOf,
  pickStable,
  graphForCourse,
};
