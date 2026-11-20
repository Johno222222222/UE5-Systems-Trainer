"use strict";

const { assertLearningAnchors } = require("./learning");
const { ensurePractice } = require("./practice");

function note(id, anchor, one, trade, mistake, concept, title) {
  return {
    id,
    anchor,
    one_line: one,
    tradeoff: trade,
    common_mistake: mistake,
    concept_id: concept,
    concept_title: title,
  };
}

function chain(labels, notes = []) {
  const types = ["event", "function", "function", "function"];
  const nodes = labels.map((label, i) => ({
    id: `n${i + 1}`,
    label,
    node_type: types[i] || "function",
    note: notes[i] || "",
    x: 80 + i * 240,
    y: 140,
    inputs: i === 0 ? [] : ["exec"],
    outputs: ["exec"],
  }));
  const edges = nodes.slice(0, -1).map((node, i) => ({
    from_node: node.id,
    to_node: nodes[i + 1].id,
    kind: "exec",
  }));
  return { nodes, edges };
}

function build(def) {
  const graph = chain(def.labels, def.nodeNotes || []);
  const params = def.params.map((p) => ({
    key: p[0], label: p[1], value: p[2], min: 0, max: 100, step: 1, unit: p[3] || "",
  }));
  const system = {
    id: `template-${def.id}`,
    system_name: def.name,
    summary: def.summary,
    tunable_parameters: params,
    modules: def.modules.map(([name, description]) => ({ name, included: true, description })),
    blueprint_pseudocode: def.pseudo,
    cpp_header: def.header.join("\n"),
    cpp_source: def.source.join("\n"),
    setup_guide: [
      { step: 1, title: def.setup, detail: "Create the class and attach it where the summary says.", why: "Owning the behaviour in one class keeps the rest of the pawn thin." },
      { step: 2, title: "Assign the defaults", detail: "Set the parameters on the component before play.", why: "Defaults in the component are what the generated code reads." },
    ],
    node_graph_nodes: graph.nodes,
    node_graph_edges: graph.edges,
    network_notes: "Local only until you mark the fields replicated.",
    applied_changes: [],
    shared_attributes: [],
    learning: {
      challenges: def.challenges,
      why_notes: [
        note("n1", { kind: "node", node_id: "n1" }, def.why[0][0], def.why[0][1], def.why[0][2], def.why[0][3], def.why[0][4]),
        note("n2", { kind: "node", node_id: "n2" }, def.why[1][0], def.why[1][1], def.why[1][2], def.why[1][3], def.why[1][4]),
        note("n3", { kind: "node", node_id: "n3" }, def.why[2][0], def.why[2][1], def.why[2][2], def.why[2][3], def.why[2][4]),
        note("h", { kind: "cpp", file: ".h", line: def.headerLine }, def.headerWhy[0], def.headerWhy[1], def.headerWhy[2], def.headerWhy[3], def.headerWhy[4]),
        note("c", { kind: "cpp", file: ".cpp", line: def.sourceLine }, def.sourceWhy[0], def.sourceWhy[1], def.sourceWhy[2], def.sourceWhy[3], def.sourceWhy[4]),
      ],
      parameter_effects: def.params.map((p) => ({ key: p[0], effect: p[4] })),
      prerequisites: def.prerequisites,
      complexity: def.complexity,
      related_concepts: def.concepts,
      traps: def.traps,
      module_notes: def.modules.map(([name, description]) => ({ name, note: description })),
    },
  };
  system.learning = ensurePractice(system.learning, system);
  assertLearningAnchors(system);
  return system;
}

const SOURCE = (cls, body) => [
  `#include "${cls}.h"`,
  `void U${cls}::Run() {`,
  "  if (!GetOwner()) return;",
  `  ${body}`,
  "}",
];

const PACKS = [
  {
    id: "combat",
    name: "Advanced Combat System",
    summary: "Combo chains, directional attacks, and hitstop on an ActorComponent.",
    labels: ["Event Attack", "Advance Combo", "Apply Hitstop", "Resolve Damage"],
    nodeNotes: [
      "The attack starts from a notify, not from Tick. For example, the montage hits the notify and the combo advances once.",
      "The combo index lives on the component so two attacks share one counter. For example, the second swing reads the same index the first swing stored.",
      "Hitstop pauses both sides so the impact reads. For example, the sword and the target freeze together for a few frames.",
      "Resolve Damage applies the hit after hitstop, on the authority, not on Tick. For example, the sword subtracts health once the freeze ends.",
    ],
    params: [
      ["combo_window", "Combo Window", 35, "ms", "Widens the time the next hit still counts as the same combo."],
      ["hitstop_frames", "Hitstop", 4, "frames", "Holds both characters so the hit reads. Too many frames and the game feels frozen."],
    ],
    modules: [
      ["Hitstop", "Freezes attacker and target together for a few frames instead of shaking only the camera."],
      ["DamageTypes", "Routes each hit through a damage type instead of one shared float."],
    ],
    challenges: [
      { title: "Who owns the combo", detail: "The component should own the combo index. The Anim Blueprint only sends notifies." },
      { title: "Hitstop without Tick", detail: "A short timer is enough. A Tick that counts frames will run even when nobody is swinging." },
    ],
    why: [
      ["The attack starts from a notify, not from Tick.", "A notify only runs when the montage says so.", "Checking attack input every frame misses the animation.", "animation-notifies", "Animation notifies"],
      ["The combo index lives on the component so two attacks share one counter.", "The Anim Blueprint cannot be the owner or AI attacks desync.", "Storing the index in the montage makes the second swing start at 1.", "combo-state", "Combo state"],
      ["Hitstop pauses both sides so the impact reads.", "Long hitstop makes the game feel stuck.", "Stopping only the attacker lets the target slide out of the hit.", "hitstop", "Hitstop"],
    ],
    headerLine: 10,
    headerWhy: ["ComboWindow is a designer default, not a value hidden in the montage.", "Putting it on the component lets you tune per weapon.", "A magic number in the Anim Blueprint cannot be shared with AI.", "designer-defaults", "Designer defaults"],
    sourceLine: 4,
    sourceWhy: ["The window resets the combo when the gap is too long.", "A tighter window is harder and more readable.", "Forgetting the reset lets a late poke continue a finished combo.", "combo-state", "Combo state"],
    traps: [{ title: "Tick overuse", detail: "Combo timing does not need Tick. Drive it from the hit notify and a timer." }],
    prerequisites: ["ActorComponent", "Animation notifies"],
    complexity: "intermediate",
    concepts: [{ id: "hitstop", title: "Hitstop" }],
    cls: "CombatComponent",
    body: "ComboIndex++;",
    members: [
      "  UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category=\"Combat\")",
      "  int32 ComboIndex = 0;",
    ],
  },
  {
    id: "inventory",
    name: "Grid Inventory",
    summary: "A slot grid with stacking and a DataAsset for item definitions.",
    labels: ["Open Inventory", "Find Slot", "Stack Or Place", "Refresh Widget"],
    nodeNotes: [
      "Open Inventory starts from the inventory key, not from Tick. For example, pressing the bag button opens the grid once.",
      "Find Slot looks for a free cell or a stack of the same item. For example, a second medkit lands on the first medkit's cell.",
      "Stack Or Place writes the count on the slot. The widget does not own the number. For example, a full stack refuses the extra round.",
      "Refresh Widget redraws the grid after the slot changes. For example, the bag updates when a medkit stacks, and it does not scan the world.",
    ],
    params: [
      ["slot_count", "Slot Count", 20, "slots", "Sets how many cells the grid builds. More cells cost more widget work."],
    ],
    modules: [
      ["Stacking", "Fills an existing stack before it occupies a new cell."],
      ["ItemData", "Item stats live on a DataAsset so the component stays small."],
    ],
    challenges: [
      { title: "Data vs widget", detail: "The component owns the slots. The widget only draws them." },
      { title: "Stack rules", detail: "Decide the max stack on the item asset, not in the widget click." },
    ],
    why: [
      ["Opening the inventory does not rebuild the data.", "Rebuilding on open drops unsaved drag operations.", "Creating the array in the widget constructs a second inventory.", "ui-data", "UI and data"],
      ["Find Slot searches the array, not the widgets.", "Widgets are a view. Searching them breaks when the grid is closed.", "Get All Actors of the widget class will miss a closed inventory.", "queries", "Actor queries"],
      ["Stack Or Place keeps one code path for drop and pickup.", "Two paths drift and one forgets the max stack.", "Handling drop only in the widget leaves AI pickups wrong.", "inventory-rules", "Inventory rules"],
    ],
    headerLine: 10,
    headerWhy: ["SlotCount is the size of the data array.", "The widget should read it, not own a second copy.", "A hardcoded 20 in the UI cannot grow with a backpack upgrade.", "ui-data", "UI and data"],
    sourceLine: 4,
    sourceWhy: ["The owner check refuses to run before the component is attached.", "A component with no owner has nowhere to show the grid.", "Skipping the check crashes when the asset is opened in the editor.", "components", "Actor components"],
    traps: [{ title: "Get All Actors every frame", detail: "Do not search the world for the inventory widget. Keep a pointer on the player." }],
    prerequisites: ["ActorComponent", "DataAsset"],
    complexity: "intermediate",
    concepts: [{ id: "ui-data", title: "UI and data" }],
    cls: "InventoryComponent",
    body: "Slots.SetNum(SlotCount);",
    members: [
      "  UPROPERTY(VisibleInstanceOnly, BlueprintReadOnly, Category=\"Inventory\")",
      "  TArray<int32> Slots;",
      "  UPROPERTY(EditAnywhere, BlueprintReadOnly, Category=\"Inventory\")",
      "  int32 SlotCount = 20;",
    ],
  },
  {
    id: "dialogue",
    name: "Branching Dialogue",
    summary: "Speaker lines, player choices, and quest flags from a DataTable.",
    labels: ["Start Conversation", "Read Row", "Offer Choices", "Set Quest Flag"],
    nodeNotes: [
      "Start Conversation begins when the player talks to the NPC, not on Tick. For example, the use key on a merchant opens the first line.",
      "Read Row pulls the next line from the data table. The text is not hardcoded on the node. For example, the escort offer comes from a row the writer can edit.",
      "Offer Choices shows the replies on that row. Picking one is the next step. For example, Yes and Not now are two pins from the same line.",
      "Set Quest Flag writes the result of the chosen line. It does not replay the conversation. For example, agreeing to the escort sets the flag the quest reads later.",
    ],
    params: [
      ["text_speed", "Text Speed", 40, "cps", "How fast the line reveals. It does not change which row plays."],
    ],
    modules: [
      ["Conditions", "A choice can require a quest flag before it is shown."],
      ["QuestFlags", "The conversation writes flags. It does not own the whole quest."],
    ],
    challenges: [
      { title: "Where flags live", detail: "Flags belong to the quest component. Dialogue only sets the ones this line names." },
      { title: "Table vs hardcoding", detail: "Lines live in a DataTable so writers can change them without compiling." },
    ],
    why: [
      ["Start Conversation looks up a row id. It does not embed the script.", "Embedding lines in the graph makes every edit a code change.", "A graph full of literal strings cannot be localised.", "data-tables", "Data Tables"],
      ["Read Row is pure data. The branch happens after it.", "Mixing the read and the branch hides which flag blocked a choice.", "Branching inside the table lookup duplicates the condition.", "data-tables", "Data Tables"],
      ["Set Quest Flag is a call into the quest owner, not a local bool.", "A local bool resets when the conversation actor is destroyed.", "Storing quest progress on the NPC loses it when they despawn.", "quest-state", "Quest state"],
    ],
    headerLine: 10,
    headerWhy: ["TextSpeed is presentation. It is not quest state.", "Designers can slow text without touching flags.", "Using the same float for speed and a flag id collides.", "data-tables", "Data Tables"],
    sourceLine: 3,
    sourceWhy: ["No owner means there is nobody to receive the flag.", "The check is cheap and avoids a null quest component.", "Writing the flag on a destroyed NPC looks like the quest advanced.", "quest-state", "Quest state"],
    traps: [{ title: "Cast instead of Interface", detail: "Call a quest interface. Casting to your one quest Blueprint breaks the next NPC." }],
    prerequisites: ["DataTable", "Interfaces"],
    complexity: "intermediate",
    concepts: [{ id: "data-tables", title: "Data Tables" }],
    cls: "DialogueComponent",
    body: "Row = Table->FindRow<FDialogueRow>(RowId, TEXT(\"Dialogue\"));",
    members: [
      "  UPROPERTY()",
      "  UObject* Table = nullptr;",
      "  UPROPERTY()",
      "  FName RowId;",
      "  UPROPERTY()",
      "  UObject* Row = nullptr;",
    ],
  },
  {
    id: "ai_guard",
    name: "Behavior Tree AI Guard",
    summary: "Patrol, sight, chase, and return on a pawn with a blackboard.",
    labels: ["Perceive Target", "Set Blackboard", "Chase Or Search", "Return To Post"],
    nodeNotes: [
      "Perceive Target reports a sighting or a noise on the perception timer. It does not run every frame. For example, the guard notices the player stepping into the light.",
      "Set Blackboard writes the target the behavior tree can read. For example, the chase reads the player location stored here.",
      "Chase Or Search leaves the post when the blackboard has a target, and searches when it does not. For example, losing sight starts the search instead of a Tick wander.",
      "Return To Post walks the guard home when the search ends. For example, after the player hides, the guard goes back to the door.",
    ],
    params: [
      ["sight_radius", "Sight Radius", 80, "m", "How far the pawn notices a target. Larger radii cost more perception checks."],
    ],
    modules: [
      ["Perception", "Sight and hearing write the blackboard. The tree only reads it."],
      ["Patrol", "A spline or point list. The pawn does not search the world for markers each frame."],
    ],
    challenges: [
      { title: "Tree vs component", detail: "The tree decides. The component only exposes senses and movement." },
      { title: "Search without Tick spam", detail: "Perception callbacks beat a Tick that asks where everyone is." },
    ],
    why: [
      ["Perception is an event. The pawn does not poll the player.", "Polling every frame scales with the number of guards.", "Get All Actors of Character every Tick will hitch.", "perception", "AI Perception"],
      ["The blackboard is the only memory the tree should read.", "Writing the target on the pawn and the blackboard will disagree.", "A raw pointer on the controller dies when the target is destroyed.", "blackboards", "Blackboards"],
      ["Chase and search are one branch so the last known location is shared.", "Two tasks that each store a location drift apart.", "Chasing the actor after line of sight breaks feels like the AI cheats.", "ai-states", "AI states"],
    ],
    headerLine: 10,
    headerWhy: ["SightRadius is data for the perception config, not a Tick distance check.", "Designers tune it per guard archetype.", "A hardcoded radius in the task cannot vary by pawn.", "perception", "AI Perception"],
    sourceLine: 4,
    sourceWhy: ["The sense writes the blackboard key and returns.", "Keeping the function short stops it becoming a second behaviour tree.", "Chasing inside the sense callback fights the tree.", "blackboards", "Blackboards"],
    traps: [{ title: "Get All Actors every frame", detail: "Perception already reports who was seen. Do not scan the world on Tick." }],
    prerequisites: ["Behavior Tree", "Blackboard"],
    complexity: "advanced",
    concepts: [{ id: "perception", title: "AI Perception" }],
    cls: "GuardSense",
    body: "Blackboard->SetValueAsObject(TargetKey, Sensed);",
    members: [
      "  UPROPERTY()",
      "  UObject* Blackboard = nullptr;",
      "  UPROPERTY()",
      "  FName TargetKey;",
      "  UPROPERTY()",
      "  UObject* Sensed = nullptr;",
    ],
  },
  {
    id: "save",
    name: "Save Load Game State",
    summary: "Slots, an autosave timer, and an async save of a versioned USaveGame.",
    labels: ["Request Save", "Fill SaveGame", "Write Slot Async", "Broadcast Done"],
    nodeNotes: [
      "Request Save starts from the menu or a checkpoint, not from Tick. For example, the pause menu asks for one save.",
      "Fill SaveGame copies the numbers that already finished, such as health and the quest flag. For example, it stores the kit, not a mid-swing pose.",
      "Write Slot Async writes that struct to the slot and returns later. The game does not freeze on the write. For example, the disk finishes while the menu stays up.",
      "Broadcast Done tells the menu the slot finished writing. It does not save again. For example, the Saving spinner hides when this fires.",
    ],
    params: [
      ["autosave_seconds", "Autosave", 60, "s", "How often a quiet save runs. Zero turns autosave off."],
    ],
    modules: [
      ["Slots", "Each slot is a name plus a version, not a separate class."],
      ["AsyncIO", "The write does not stall the game thread."],
    ],
    challenges: [
      { title: "What is saved", detail: "Save the game state, not the whole actor tree." },
      { title: "Version the struct", detail: "Add a version int so an old slot can be upgraded instead of crashing." },
    ],
    why: [
      ["Request Save only fills a request. The write happens next.", "Saving inside the button click hitches on a large world.", "A synchronous save in UI code freezes the frame.", "async-save", "Async save"],
      ["Fill SaveGame copies the fields you named. It does not walk every actor.", "Walking every actor saves editor-only junk and pointers.", "Saving raw UObject pointers does not load back.", "save-games", "SaveGame"],
      ["Write Slot Async uses the engine's async save.", "You give up an immediate success bool.", "Blocking SaveGameToSlot on the game thread stalls gameplay.", "async-save", "Async save"],
    ],
    headerLine: 10,
    headerWhy: ["Autosave seconds is a timer period, not a Tick interval.", "A timer fires once per period. Tick fires every frame.", "Checking the clock on Tick keeps the subsystem awake.", "timers", "Timers"],
    sourceLine: 4,
    sourceWhy: ["The slot write is queued, then the function returns.", "The UI must listen for the done callback.", "Assuming the file exists on the next line races the disk.", "async-save", "Async save"],
    traps: [{ title: "Tick overuse", detail: "Autosave is a timer. Do not poll the clock on Tick." }],
    prerequisites: ["USaveGame", "GameInstanceSubsystem"],
    complexity: "intermediate",
    concepts: [{ id: "save-games", title: "SaveGame" }],
    cls: "SaveSubsystem",
    body: "UGameplayStatics::AsyncSaveGameToSlot(Pending, Slot, 0);",
    members: [
      "  UPROPERTY()",
      "  UObject* Pending = nullptr;",
      "  UPROPERTY()",
      "  int32 Slot = 0;",
    ],
  },
  {
    id: "vehicle",
    name: "Vehicle Physics Controller",
    summary: "Throttle, brake, drift, and gears on a Chaos wheeled pawn.",
    labels: ["Read Input", "Apply Throttle", "Update Gear", "Drift Brake"],
    nodeNotes: [
      "Read Input takes the vehicle axis from the mapping context. It is not the on-foot sprint. For example, the trigger is throttle for the car.",
      "Apply Throttle writes that axis on the authority for the chaos vehicle to read. For example, the host sets the speed the wheels follow.",
      "Update Gear shifts from the speed, not from Tick guessing. For example, the car changes gear as the throttle holds.",
      "Drift Brake cuts the throttle and yaws the car for a handbrake turn. For example, the handbrake slides the car without writing walk speed.",
    ],
    params: [
      ["steer_speed", "Steer Speed", 50, "deg/s", "How fast the wheels turn toward the input. Higher feels twitchy."],
    ],
    modules: [
      ["Gears", "Automatic shift reads speed. It does not set throttle."],
      ["Drift", "Handbrake cuts rear grip for a moment. It is not a second throttle."],
    ],
    challenges: [
      { title: "Pawn vs component", detail: "Chaos already ticks the vehicle. Add a controller, do not Tick the torque yourself." },
      { title: "One input path", detail: "Keyboard and gamepad should write the same throttle float." },
    ],
    why: [
      ["Input is sampled in the vehicle tick Chaos already runs.", "A second Tick fights the physics step.", "Applying forces from a component Tick stutters the wheels.", "chaos-vehicles", "Chaos vehicles"],
      ["Throttle is one float into the movement component.", "Splitting throttle per wheel in Blueprint is hard to balance.", "Setting wheel torque from the Anim Blueprint skips the physics.", "chaos-vehicles", "Chaos vehicles"],
      ["Gears read speed. They do not also steer.", "Combining them makes a gear change yank the wheel.", "Shifting and steering in one function hides which one popped.", "gears", "Gears"],
    ],
    headerLine: 10,
    headerWhy: ["SteerSpeed is a rate, so the wheels catch up instead of snapping.", "Snapping feels digital and upsets the tyre model.", "Writing the steer angle directly every frame ignores the vehicle mass.", "chaos-vehicles", "Chaos vehicles"],
    sourceLine: 4,
    sourceWhy: ["Throttle is forwarded and the function ends.", "Extra work here runs inside the physics tick.", "Tracing for ground every call duplicates what the wheel does.", "chaos-vehicles", "Chaos vehicles"],
    traps: [{ title: "Tick overuse", detail: "Use the vehicle movement tick. A second actor Tick will fight it." }],
    prerequisites: ["Chaos Vehicles", "WheeledVehiclePawn"],
    complexity: "advanced",
    concepts: [{ id: "chaos-vehicles", title: "Chaos vehicles" }],
    cls: "VehicleAssist",
    body: "Movement->SetThrottleInput(Throttle);",
    members: [
      "  UPROPERTY()",
      "  UObject* Movement = nullptr;",
      "  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category=\"Vehicle\")",
      "  float Throttle = 0.f;",
    ],
  },
  {
    id: "gas",
    name: "Gameplay Ability System",
    summary: "An attribute set and three abilities granted through the ability system.",
    labels: ["Grant Abilities", "Check Cost", "Activate Ability", "Apply Effect"],
    nodeNotes: [
      "Grant Abilities gives this actor the abilities it may use. It runs at start, not every frame. For example, the pawn receives the dash ability when it spawns.",
      "Check Cost asks whether the attribute can pay before the ability starts. For example, a dash refuses when stamina is already empty.",
      "Activate Ability starts the ability by its tag. The graph does not name the class at the call. For example, the dash tag finds the dash ability.",
      "Apply Effect pays the cost and starts the cooldown on this actor. The ability does not also subtract. For example, a dash spends stamina from the effect, then waits.",
    ],
    params: [
      ["mana_cost", "Mana Cost", 20, "mp", "The cost effect of the fireball. Higher cost means fewer casts per pool."],
    ],
    modules: [
      ["AttributeSet", "Health, mana, and stamina live in one set so effects can modify them."],
      ["Cooldowns", "A cooldown tag blocks the ability. A bool on the actor will not."],
    ],
    challenges: [
      { title: "Who owns the ASC", detail: "The player state or the pawn owns one ability system. Do not create a second one." },
      { title: "Effects vs direct sets", detail: "Change health with a gameplay effect so prediction and cues still run." },
    ],
    why: [
      ["Abilities are granted once, not on every input.", "Granting on press stacks duplicate abilities.", "Calling GiveAbility from the input event leaks abilities.", "gas", "Gameplay Ability System"],
      ["Cost is an effect the system checks before activate.", "A manual mana subtract skips the failure tag.", "Setting mana in the ability and in the effect spends it twice.", "gas", "Gameplay Ability System"],
      ["Activate goes through the ability system so prediction works.", "Calling the ability function directly skips cooldown.", "A Blueprint cast to the ability class breaks when the class changes.", "gas", "Gameplay Ability System"],
    ],
    headerLine: 10,
    headerWhy: ["ManaCost is the default on the cost effect, not a subtracted float in Tick.", "Designers tune the cost without opening the ability graph.", "A hardcoded subtract cannot be predicted on the client.", "gas", "Gameplay Ability System"],
    sourceLine: 4,
    sourceWhy: ["The ability system activates by tag.", "The call fails cleanly when the cost or cooldown blocks it.", "Casting to the fireball class and calling it skips that check.", "interfaces", "Interfaces"],
    traps: [{ title: "Cast instead of Interface", detail: "Activate by ability tag. Do not cast to a concrete ability Blueprint." }],
    prerequisites: ["Gameplay Ability System", "Attribute set"],
    complexity: "advanced",
    concepts: [{ id: "gas", title: "Gameplay Ability System" }],
    cls: "AbilityBinder",
    body: "ASC->TryActivateAbilitiesByTag(FireballTags);",
    members: [
      "  UPROPERTY()",
      "  UObject* ASC = nullptr;",
      "  UPROPERTY()",
      "  FName FireballTags;",
    ],
  },
  {
    id: "interaction",
    name: "Interaction System",
    summary: "A camera line trace, a prompt, and an interface on the focused actor.",
    labels: ["Trace From Camera", "Focus Actor", "Show Prompt", "Call Interact"],
    nodeNotes: [
      "Trace From Camera fires a short line trace from the camera when the player asks, not on Tick. For example, the use key looks at the door in front of the crosshair.",
      "Focus Actor stores the hit actor on this component. The character class does not own that pointer. For example, the door stays focused until the next look misses.",
      "Show Prompt updates the widget from the focus change. The widget does not poll. For example, Use appears when a crate is focused and hides when it is not.",
      "Call Interact runs the interface on the focused actor. A cast list is not required. For example, the same node opens a door and picks up a rifle.",
    ],
    params: [
      ["trace_distance", "Trace Distance", 30, "m", "How far the look trace reaches. Longer traces hit more of the world."],
    ],
    modules: [
      ["Prompt", "The widget follows the focused actor. It is not a permanent HUD piece."],
      ["Outline", "The outline is a highlight on the focused actor, cleared when focus changes."],
    ],
    challenges: [
      { title: "Interface not cast", detail: "The focused actor implements Interact. Do not cast to every pickup class." },
      { title: "Trace rate", detail: "A timer around 10 Hz is enough. A Tick trace is wasted work." },
    ],
    why: [
      ["The trace starts at the camera so the crosshair matches what you hit.", "Tracing from the feet picks the floor.", "Tracing from the actor origin interacts with things behind the player.", "line-traces", "Line traces"],
      ["Focus stores one actor. The previous outline is cleared first.", "Two focused actors both show prompts.", "Forgetting to clear the last actor leaves a stuck outline.", "focus", "Focus"],
      ["The prompt is a view of Focus. It does not decide what can be used.", "Logic in the widget cannot run when the widget is hidden.", "Putting Interact on the widget click skips the interface.", "ui-data", "UI and data"],
    ],
    headerLine: 10,
    headerWhy: ["TraceDistance is the look reach, in one place.", "Each pickup having its own distance makes the crosshair lie.", "A trace length buried in the widget is hard to tune.", "line-traces", "Line traces"],
    sourceLine: 4,
    sourceWhy: ["Interact is called through the interface on the hit actor.", "A cast list grows every time you add a pickup.", "Casting to BP_Door misses the next interactable.", "interfaces", "Interfaces"],
    traps: [{ title: "Cast instead of Interface", detail: "One Interact interface covers doors, pickups, and switches. A cast chain does not." }],
    prerequisites: ["Line trace", "Blueprint interface"],
    complexity: "beginner",
    concepts: [{ id: "interfaces", title: "Interfaces" }],
    cls: "InteractTrace",
    body: "IInteractable::Execute_Interact(HitActor, GetOwner());",
    members: [
      "  UPROPERTY()",
      "  AActor* HitActor = nullptr;",
    ],
  },
];

function attachStarters(templates) {
  const byId = new Map(PACKS.map((pack) => {
    const header = [
      "#pragma once",
      "#include \"CoreMinimal.h\"",
      "#include \"Components/ActorComponent.h\"",
      `#include "${pack.cls}.generated.h"`,
      "UCLASS(ClassGroup=(Game), meta=(BlueprintSpawnableComponent))",
      `class U${pack.cls} : public UActorComponent {`,
      "  GENERATED_BODY()",
      "public:",
      "  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category=\"Game\")",
      pack.id === "combat" ? "  float ComboWindow = 0.35f;" : "  float Tunable = 1.f;",
      ...(pack.members || []),
      "  void Run();",
      "};",
    ];
    const source = SOURCE(pack.cls, pack.body);
    const system = build({ ...pack, header, source });
    return [pack.id, system];
  }));
  return templates.map((template) => ({ ...template, starter: byId.get(template.id) || null }));
}

module.exports = { attachStarters, PACKS };
