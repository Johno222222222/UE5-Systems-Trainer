"use strict";

// Bundled Stage 4 library. Reading it never calls a model.
// Learn-more links are real Epic documentation pages.

const { TEMPLATES } = require("./logic");
const { attachStarters, systemFromPack, PACKS } = require("./templateLearning");

const DOCS = {
  tick: "https://dev.epicgames.com/documentation/en-us/unreal-engine/actor-ticking-in-unreal-engine",
  timers: "https://dev.epicgames.com/documentation/en-us/unreal-engine/gameplay-timers-in-unreal-engine",
  rpcs: "https://dev.epicgames.com/documentation/en-us/unreal-engine/remote-procedure-calls-in-unreal-engine",
  interfaces: "https://dev.epicgames.com/documentation/en-us/unreal-engine/interfaces-in-unreal-engine",
  blueprintInterfaces: "https://dev.epicgames.com/documentation/en-us/unreal-engine/blueprint-interface-in-unreal-engine",
  dataAssets: "https://dev.epicgames.com/documentation/en-us/unreal-engine/data-assets-in-unreal-engine",
  replication: "https://dev.epicgames.com/documentation/en-us/unreal-engine/property-replication-in-unreal-engine",
  delegates: "https://dev.epicgames.com/documentation/en-us/unreal-engine/delegates-in-unreal-engine",
  components: "https://dev.epicgames.com/documentation/en-us/unreal-engine/components-in-unreal-engine",
  tags: "https://dev.epicgames.com/documentation/en-us/unreal-engine/using-gameplay-tags-in-unreal-engine",
  notifies: "https://dev.epicgames.com/documentation/en-us/unreal-engine/animation-notifies-in-unreal-engine",
  saving: "https://dev.epicgames.com/documentation/en-us/unreal-engine/saving-and-loading-your-game-in-unreal-engine",
  behavior: "https://dev.epicgames.com/documentation/en-us/unreal-engine/behavior-trees-in-unreal-engine",
  actors: "https://dev.epicgames.com/documentation/en-us/unreal-engine/actors-in-unreal-engine",
  communication: "https://dev.epicgames.com/documentation/en-us/unreal-engine/actor-communication-in-unreal-engine",
};

const ABOUT = {
  is: "A UE5 architecture and learning tool. It helps you shape a system, see why it is built that way, and practice the decisions.",
  isnt: "Not a full game generator. The code needs review before you ship it.",
};

const TEMPLATE_DOCS = {
  combat: [{ title: "Animation notifies", url: DOCS.notifies }],
  inventory: [{ title: "Data Assets", url: DOCS.dataAssets }],
  dialogue: [{ title: "Data Assets", url: DOCS.dataAssets }],
  ai_guard: [{ title: "Behavior Trees", url: DOCS.behavior }],
  save: [{ title: "Saving and loading your game", url: DOCS.saving }],
  vehicle: [{ title: "Components", url: DOCS.components }],
  gas: [{ title: "Gameplay Tags", url: DOCS.tags }],
  interaction: [{ title: "Interfaces", url: DOCS.interfaces }],
};

// Older teaching notes use short ids. Each one lands on a real card.
const CONCEPT_ALIASES = {
  hitstop: "tick-vs-timers",
  "line-traces": "tick-vs-timers",
  perception: "tick-vs-timers",
  timers: "tick-vs-timers",
  interfaces: "interface-vs-cast",
  focus: "interface-vs-cast",
  "ui-data": "data-assets",
  "data-tables": "data-assets",
  "designer-defaults": "data-assets",
  queries: "data-assets",
  "inventory-rules": "data-assets",
  blackboards: "data-assets",
  "combo-state": "components-vs-inheritance",
  "chaos-vehicles": "components-vs-inheritance",
  components: "components-vs-inheritance",
  gears: "components-vs-inheritance",
  "ai-states": "components-vs-inheritance",
  gas: "gameplay-tags",
  "animation-notifies": "animation-notifies",
  "save-games": "save-games",
  "async-save": "save-games",
  "quest-state": "save-games",
};

function challenge(prompt, choices, answer, why) {
  return { prompt, choices, answer, why_people_pick: why };
}

const CONCEPTS = [
  {
    id: "tick-vs-timers",
    title: "Tick vs timers",
    explanation: "Tick runs once a frame for as long as the actor is alive. A timer runs when you ask, then stops. Use Tick for something that truly changes every frame, like movement. Use a timer for a look trace, a combo window, or anything that can sleep.",
    challenge: challenge(
      "A look trace only needs a fresh hit about ten times a second. What should run it?",
      ["A repeating timer at 0.1 seconds", "Tick on the character"],
      0,
      "Tick is already on the actor, so it looks like the easy switch. It also runs when nobody is looking at anything.",
    ),
    examples: [
      { kind: "example", id: "start-here", title: "Character Interaction" },
      { kind: "template", id: "combat", title: "Advanced Combat System" },
    ],
    learn_more: [
      { title: "Actor ticking", url: DOCS.tick },
      { title: "Gameplay timers", url: DOCS.timers },
    ],
  },
  {
    id: "authority-rpcs",
    title: "Authority and server RPCs",
    explanation: "The server owns gameplay facts such as whether an interact succeeded. A Server RPC asks the server to do that work. The client can play the prompt locally, but it should not decide the result.",
    challenge: challenge(
      "The player presses Interact. Who should decide that the door actually opens?",
      ["The server, after a Server RPC", "The owning client, because it saw the prompt"],
      0,
      "The prompt is on the client, so it feels like the client already knows. Other players would see a door that never moved.",
    ),
    examples: [{ kind: "example", id: "start-here", title: "Character Interaction" }],
    learn_more: [{ title: "Remote procedure calls", url: DOCS.rpcs }],
  },
  {
    id: "interface-vs-cast",
    title: "Interface vs Cast",
    explanation: "A cast says the actor is one exact class. An interface says it can do one job, such as Interact, whatever class it is. Doors, pickups, and switches can share that job without a growing cast chain.",
    challenge: challenge(
      "Focus landed on a door, a pickup, and a switch. How should Interact reach them?",
      ["One Interact interface", "A cast for each Blueprint class"],
      0,
      "A cast is specific, so it feels safer. The next interactable then needs another cast, and one of them gets missed.",
    ),
    examples: [
      { kind: "example", id: "start-here", title: "Character Interaction" },
      { kind: "template", id: "interaction", title: "Interaction System" },
    ],
    learn_more: [
      { title: "Interfaces", url: DOCS.interfaces },
      { title: "Blueprint interfaces", url: DOCS.blueprintInterfaces },
    ],
  },
  {
    id: "data-assets",
    title: "Data Assets",
    explanation: "A Data Asset holds designer data, such as a prompt string or an item definition, outside the component that uses it. The component points at the asset. Tuning the words does not mean editing the trace code.",
    challenge: challenge(
      "The interact prompt text differs for every object. Where should that text live?",
      ["A Data Asset the object points at", "A string literal inside the trace component"],
      0,
      "A literal next to the trace is easy to find once. It is the wrong place as soon as a second object needs different words.",
    ),
    examples: [
      { kind: "example", id: "start-here", title: "Character Interaction" },
      { kind: "template", id: "inventory", title: "Grid Inventory" },
    ],
    learn_more: [{ title: "Data Assets", url: DOCS.dataAssets }],
  },
  {
    id: "replication-repnotify",
    title: "Replication and RepNotify",
    explanation: "A replicated property copies the server's value to clients. RepNotify also runs a function when that value arrives, which is the right place to refresh an outline or a prompt. Do not replicate the trace itself.",
    challenge: challenge(
      "Focus changed on the server. How do other clients update the outline?",
      ["Replicate the focused actor with RepNotify", "Run the line trace again on every client"],
      0,
      "Tracing on each client looks consistent until two clients disagree about what is in front of the player.",
    ),
    examples: [{ kind: "example", id: "start-here", title: "Character Interaction" }],
    learn_more: [{ title: "Property replication", url: DOCS.replication }],
  },
  {
    id: "delegates-events",
    title: "Delegates and events",
    explanation: "A delegate is a list of listeners. The interaction component broadcasts when focus changes. The prompt and the outline subscribe. They do not need to know how the trace works.",
    challenge: challenge(
      "The prompt and the outline both care that focus changed. How should they hear about it?",
      ["A delegate the component broadcasts", "The prompt calls into the outline, and the outline calls back"],
      0,
      "A direct call is obvious for two widgets. A third listener then has to be threaded through both of them.",
    ),
    examples: [
      { kind: "example", id: "start-here", title: "Character Interaction" },
      { kind: "template", id: "combat", title: "Advanced Combat System" },
    ],
    learn_more: [{ title: "Delegates", url: DOCS.delegates }],
  },
  {
    id: "components-vs-inheritance",
    title: "Components vs inheritance",
    explanation: "A component adds one behaviour to whatever actor needs it. A subclass bakes that behaviour into one character family. Interaction, combat, and inventory stay components so a pawn can carry the ones it uses.",
    challenge: challenge(
      "Two characters need the same look-trace. Where should it live?",
      ["An ActorComponent both of them add", "A shared Character subclass they both inherit"],
      0,
      "A parent class feels tidy until a vehicle or a static door needs the same trace and cannot inherit that character.",
    ),
    examples: [
      { kind: "example", id: "start-here", title: "Character Interaction" },
      { kind: "template", id: "combat", title: "Advanced Combat System" },
    ],
    learn_more: [
      { title: "Components", url: DOCS.components },
      { title: "Actors", url: DOCS.actors },
    ],
  },
  {
    id: "gameplay-tags",
    title: "Gameplay Tags",
    explanation: "A Gameplay Tag is a hierarchical name, such as Interact.Door. Code and Blueprints check the tag instead of a string or a class. The interaction component can ignore actors that do not have Interact.",
    challenge: challenge(
      "How should the trace skip actors that cannot be used?",
      ["Require an Interact Gameplay Tag", "Compare the actor's class name to a list of strings"],
      0,
      "A class-name list is readable in one Blueprint. Renaming a class, or adding a child, quietly drops it from the list.",
    ),
    examples: [
      { kind: "example", id: "start-here", title: "Character Interaction" },
      { kind: "template", id: "gas", title: "Gameplay Ability System" },
    ],
    learn_more: [{ title: "Using Gameplay Tags", url: DOCS.tags }],
  },
  {
    id: "animation-notifies",
    title: "Animation notifies",
    explanation: "A notify fires from a montage at the frame you mark. Combat uses that moment to advance a combo. It does not poll the animation from Tick, so a swing that never plays never checks.",
    challenge: challenge(
      "When should the combo index advance?",
      ["From an Anim Notify on the swing", "From Tick while the attack button is held"],
      0,
      "Tick plus the button is easy to wire. It also advances the combo when the montage was interrupted.",
    ),
    examples: [{ kind: "template", id: "combat", title: "Advanced Combat System" }],
    learn_more: [{ title: "Animation notifies", url: DOCS.notifies }],
  },
  {
    id: "save-games",
    title: "Save games",
    explanation: "A SaveGame object is the snapshot you write to disk. The gameplay component copies the values it owns into that object and reads them back. It does not save the whole actor.",
    challenge: challenge(
      "A slot system needs to remember inventory. What should it write?",
      ["The values, into a SaveGame object", "The live actor, with its components still attached"],
      0,
      "Saving the actor feels complete. Those objects point at the running world and do not come back the same way.",
    ),
    examples: [{ kind: "template", id: "save", title: "Save / Load Game State" }],
    learn_more: [{ title: "Saving and loading your game", url: DOCS.saving }],
  },
];

function startHereSystem() {
  return systemFromPack({
    id: "start-here",
    name: "Character Interaction",
    summary: "A look trace on a timer, a prompt, and Interact through an interface. No API key required.",
    labels: ["Start Timer", "Trace From Camera", "Broadcast Focus", "Server Interact"],
    params: [
      ["trace_distance", "Trace Distance", 40, "m", "How far the look trace reaches. Longer traces consider more of the world."],
      ["trace_interval", "Trace Interval", 10, "hz", "How often the timer repeats. Ten times a second is enough for a prompt."],
    ],
    modules: [
      ["Prompt", "The widget only displays the focused actor. It does not decide what can be used."],
      ["Outline", "The outline follows focus and clears the previous actor first."],
    ],
    challenges: [
      {
        title: "Interface not cast",
        detail: "The focused actor implements Interact.",
        prompt: "Focus hit a door. How should the character use it?",
        choices: ["Call Interact on the interface", "Cast to the door Blueprint"],
        answer: 0,
        why_people_pick: "A cast is specific, so it feels precise. The next usable object then needs its own cast.",
        related: { kind: "parameter", key: "trace_distance", label: "Trace Distance" },
      },
      {
        title: "Timer not Tick",
        detail: "The look trace repeats on a timer.",
        prompt: "What should repeat the look trace?",
        choices: ["A timer using Trace Interval", "Tick, every frame"],
        answer: 0,
        why_people_pick: "Tick is already there. It also runs when the player is not looking at anything.",
        related: { kind: "parameter", key: "trace_interval", label: "Trace Interval" },
      },
    ],
    why: [
      ["BeginPlay starts a timer. Tick stays off.", "A timer can be slower than a frame without missing the prompt.", "Enabling Tick traces every frame, even in a menu.", "tick-vs-timers", "Tick vs timers"],
      ["The trace starts at the camera so it matches the crosshair.", "Tracing from the feet hits the floor.", "Tracing from the actor origin can select something behind the player.", "tick-vs-timers", "Tick vs timers"],
      ["Focus broadcasts one actor. The prompt and the outline listen.", "Two listeners should not call each other.", "Skipping the clear leaves the previous outline on.", "delegates-events", "Delegates and events"],
    ],
    headerLine: 10,
    headerWhy: ["TraceDistance lives on the component, so every character that adds it shares one reach.", "A subclass would force that reach onto one character family.", "A distance hidden in the widget is hard to tune per object.", "components-vs-inheritance", "Components vs inheritance"],
    sourceLine: 5,
    sourceWhy: ["Interact is a Server RPC on the interface. The client does not open the door itself.", "The server is the authority for the result.", "Doing the open on the client desyncs everyone else.", "authority-rpcs", "Authority and server RPCs"],
    traps: [
      { title: "Cast chain", detail: "One Interact interface covers doors, pickups, and switches. A cast per class does not." },
      { title: "Tick trace", detail: "A 0.1 second timer is enough. Tick spends a trace on every frame." },
    ],
    prerequisites: ["ActorComponent", "Line trace", "Blueprint interface"],
    complexity: "beginner",
    concepts: [
      { id: "interface-vs-cast", title: "Interface vs Cast" },
      { id: "tick-vs-timers", title: "Tick vs timers" },
    ],
    header: [
      "#pragma once",
      "#include \"CoreMinimal.h\"",
      "#include \"Components/ActorComponent.h\"",
      "#include \"CharacterInteract.generated.h\"",
      "UCLASS(ClassGroup=(Game), meta=(BlueprintSpawnableComponent))",
      "class UCharacterInteract : public UActorComponent {",
      "  GENERATED_BODY()",
      "public:",
      "  UPROPERTY(EditAnywhere, Category=\"Interact\")",
      "  float TraceDistance = 400.f;",
      "  UPROPERTY(EditAnywhere, Category=\"Interact\")",
      "  float TraceInterval = 0.1f;",
      "  void Trace();",
      "};",
    ],
    source: [
      "#include \"CharacterInteract.h\"",
      "void UCharacterInteract::Trace() {",
      "  if (!GetOwner()) return;",
      "  const float Reach = TraceDistance;",
      "  ServerInteract(Reach, TraceInterval);",
      "}",
    ],
    pseudo: [
      "Event BeginPlay",
      "  WHY: start a timer and leave Tick off",
      "Timer Trace  (Trace Interval)",
      "  Line trace from the camera by Trace Distance",
      "  WHY: the camera matches the crosshair",
      "Broadcast Focus Changed",
      "  WHY: the prompt and the outline listen, they do not call each other",
      "Server Interact",
      "  WHY: the server decides the result",
    ].join("\n"),
  });
}

const START_HERE = {
  id: "start-here",
  title: "Character Interaction",
  tagline: "Look trace, prompt, and Interact. No API key.",
  summary: "A fully annotated interaction component. Open it, read the notes, answer a question, and move a slider. None of that calls the model.",
  complexity: "beginner",
  prerequisites: ["ActorComponent", "Line trace", "Blueprint interface"],
  key_decisions: [
    "The character owns the trace. The prompt only displays focus.",
    "Interact goes through an interface, and the server is the authority for the result.",
    "The trace runs on a timer. Tick stays off.",
  ],
  learn_more: [
    { title: "Interfaces", url: DOCS.interfaces },
    { title: "Gameplay timers", url: DOCS.timers },
    { title: "Actor communication", url: DOCS.communication },
  ],
  system: null,
};

let cachedStart = null;
function startHere() {
  if (!cachedStart) {
    const system = startHereSystem();
    system.learning.what_ifs = [{
      title: "Timer vs Tick",
      variants: [
        { id: "timer", label: "Timer", code: "GetWorldTimerManager().SetTimer(Handle, this, &UCharacterInteract::Trace, TraceInterval, true);" },
        { id: "tick", label: "Tick", code: "void TickComponent(float DeltaTime) {\n  Trace(); // runs every frame\n}" },
      ],
    }];
    cachedStart = { ...START_HERE, system };
  }
  return cachedStart;
}

function concepts() {
  return CONCEPTS;
}

function resolveConcept(id) {
  if (!id) return null;
  const key = CONCEPT_ALIASES[id] || id;
  return CONCEPTS.find((card) => card.id === key) || null;
}

function examples() {
  return [startHere()];
}

function exampleById(id) {
  return examples().find((item) => item.id === id) || null;
}

function templateById(id) {
  const templates = attachStarters(TEMPLATES);
  return templates.find((item) => item.id === id) || null;
}

function forkSource(source, id) {
  if (source === "example") {
    const example = exampleById(id);
    if (!example) return null;
    return { title: example.title, system: example.system };
  }
  if (source === "template") {
    const template = templateById(id);
    if (!template?.starter) return null;
    return { title: template.title, system: template.starter };
  }
  return null;
}

function withTemplateMeta(templates) {
  return templates.map((template) => ({
    ...template,
    complexity: template.starter?.learning?.complexity || null,
    prerequisites: template.starter?.learning?.prerequisites || [],
    learn_more: TEMPLATE_DOCS[template.id] || [],
  }));
}

function officialUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname === "dev.epicgames.com";
  } catch {
    return false;
  }
}

module.exports = {
  ABOUT,
  DOCS,
  CONCEPT_ALIASES,
  concepts,
  resolveConcept,
  examples,
  exampleById,
  forkSource,
  withTemplateMeta,
  officialUrl,
  PACKS,
};
