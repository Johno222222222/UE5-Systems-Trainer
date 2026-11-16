import { section, mc, examQuestion, YN } from "./lib.mjs";

const P = {
  input: `Enhanced Input is the front door of an FPS. An input action is a data asset, and a mapping context binds that asset to a key or a gamepad button. IA_Interact is the action this track starts with. When the player presses the bound control, the action emits Triggered on the pawn that owns the mapping context. The rest of the kit waits for that pin. Nothing in the look, the magazine, or the health path polls the keyboard.

Unreal Engine 5 adds the mapping context from the possessed pawn or the player controller. You can retarget the same action from a keyboard to a pad without editing the graph. Triggered is the exec pin for a tap. Value is the axis, which move and look use and a tap can ignore. The interact graph drawn beside this lesson is the real one: IA_Interact, a line trace, a branch, and an interface call.

Walk it left to right. The Enhanced Input node sits at the left with the action name IA_Interact. Triggered feeds the line trace. The trace returns a hit bool. That bool is the condition of Branch. The true pin calls the interface Execute_Interact. The false pin ends. There is no Tick node in this graph. A second trace on Tick would answer a question the player has not asked.

The generated C++ is a function on the component, not a tick override. The excerpt lists the real line numbers from that function. The header declares it. The source includes its own header first. A hand edit below the generated block stays where the player put it.

One trace per press is the efficient shape. Tracing on Tick spends a physics query every frame on every simulated pawn, and the stored hit goes stale before the press arrives. Later systems assume this rule. The weapon uses IA_Fire the same way. The inventory does not read the keyboard. Save does not either. Delete this action and the later graphs still compile. The player just cannot start them.`,

  movement: `Movement turns a stick axis into a speed the character movement component can consume. IA_Move is the input action. The graph compares the axis with zero, then writes either a sprint speed or a walk speed into the Speed variable. The character movement component reads Speed. The graph does not move the actor by adding a world offset on Tick, and it does not run a second trace to decide which way is forward.

In UE5 the axis arrives on the Enhanced Input node as a float. Greater Than compares that float with a literal zero. Branch takes the result. The true path writes the literal 600 into Speed. The false path writes 200. Those two literals are the sample speeds. A data asset can replace them later. The point of the graph is the write, not the number.

The figure is the real movement graph. IA_Move is on the left. Its Value pin feeds Greater. A literal zero feeds the other pin. The bool result is the branch condition. Then and Else each reach a Set Speed node, fed by their own literal. Tick is not in the graph. Putting the write on Tick would stomp a speed that an ability or a stance had just set.

The generated function is the C++ form of that write. You read the line numbers on the excerpt. The component owns Speed as a float. The header declares the function that the input calls. The source does not include a tick that assigns Speed every frame.

The efficient version writes Speed when the axis changes. The inefficient version writes it on Tick and also sweeps movement in the same function, so a replicated correction and a local prediction fight. Interaction, the weapon, and the camera all read the pawn that this speed drives. They do not write Speed themselves. Health does not change Speed in this track. If you zero the axis, the walk value is the one that must win.`,

  interaction: `Interaction is the look that starts from IA_Interact and ends at an interface call. The player points at a door, a weapon, or a switch. The trace answers whether anything is there. The interface asks that actor to respond. The door graph and the pickup graph both implement the same interface, so this one call serves every usable actor in the kit.

UE5 line traces need a start, an end, and a channel. The start is the camera, not the feet. The end is a point along the aim. The channel is visibility so a wall blocks the look and a trigger volume does not. The hit bool is the only value Branch needs. The hit result stays available for the actor reference the interface call uses.

The real interact graph is the figure. IA_Interact triggers the trace. The trace exec goes to Branch. The hit bool is the condition. The true pin is the interface call named Execute_Interact. There is no cast before the call. The interface is the contract. A cast would bind this graph to one class and every other usable actor would need its own copy.

Generated C++ shows the same order: the input function, the trace, the branch, the interface. Line numbers in the excerpt match the source the graph compiler wrote. The header does not declare a Tick that traces. The source includes the component header before any other project header.

One query per press is enough. Tracing every frame so a prompt can hover is a different, slower system, and it does not belong in this graph. The prompt can read the last hit, but the hit itself is taken on the press. Inventory listens for overlap, not for this trace. Health listens for damage. Save listens for a slot write. They meet only when the interface implementation decides to call them.`,

  weapon: `The weapon system in this track is the magazine. IA_Reload starts the work. Magazine is the rounds in the gun. Reserve is the rounds on the body. MagSize is the cap. The graph asks whether the magazine is below the cap and whether the reserve still has rounds, and only then moves what is needed.

UE5 stores those three floats on the component. Less Than compares Magazine with MagSize. Greater Than compares Reserve with zero. And combines the two bools. Branch refuses the reload when either check fails. Clamp keeps the magazine inside zero and MagSize after the add. The sample numbers live on the variables. A data table can replace them without a new graph.

The figure is the real tactical-ammo graph, not a sketch. IA_Reload is the first node. The comparisons sit under it. The And feeds Branch. The true path does the arithmetic and the Clamp, then writes Magazine and Reserve. There is no Tick. A tick that reloaded by itself would fire while the player was swapping weapons.

The C++ excerpt is the generated function for that graph. Read the line numbers. The subtract and the clamp are in that function. The header declares Magazine, Reserve, and MagSize. The source does not subtract on Tick.

Reloading on the action is the cheap path. Reloading on Tick, or replicating every bullet as its own actor, is the expensive one. Health does not own the magazine. Inventory can hold a stack of the same ammo type and hand a number to Reserve. The gunsmith, later, picks which magazine size the data asset named. Save writes the two counts. If the And is skipped, a reload at a full magazine still pulls from the reserve. Read the figure again before the quiz: the action, the two comparisons, the And, the branch, and the clamp are one path.`,

  health: `Health is a replicated float. Damage arrives as an event. Only the authority subtracts. Clients learn the new value from OnRep. The figure uses the real replicated-health graph: Any Damage, Has Authority, Set Health, and the OnRep notify.

In UE5 a replicated variable is a UPROPERTY with a replicate flag. The server is the authority. Has Authority is the gate. Set Health writes the float. OnRep runs on the machines that receive the update, which is where a hit flash or a death widget belongs. The widget is not itself replicated. The float is.

Walk the real graph. Any Damage starts. Has Authority is the next exec. Set Health follows it. The OnRep is the client side of the same variable. A client that subtracts locally will disagree with the server and snap back. That snap is the bug the gate exists to prevent.

The generated C++ shows the authority check before the write. The line numbers are the compiler's. The header holds the replicated float. The source includes that header first. There is no Tick that drains health.

The efficient shape replicates one float. The inefficient shape replicates the damage widget, the blood actor, and a copy of the health on every limb from this same event. Those belong to later systems. The weapon applies damage by calling this event. It does not write Health itself. Inventory does not. Save stores the float after the authority has written it. A client press cannot be the thing that subtracts. The bar, the number, and the death check all read the same replicated float after OnRep. Death is a branch on zero after the write, still on the authority. A client that plays the death montage from OnRep is reading the result, not deciding it. The montage is local. The float is the only replicated piece.`,

  inventory: `Inventory is a slot that accepts a pickup through an interface. Overlap is the event. StackCount is the number already in the slot. The graph checks that the stack has room, then calls AddToSlot on the interface. The pickup does not write the slot variable itself.

UE5 overlap fires when a primitive component intersects the pawn. The other actor is the pickup. Greater Than asks whether StackCount is still under the cap. The interface call is the write. Because it is an interface, a rifle and a medkit can share the call. A cast to one pickup class would exclude the other.

The figure is the real inventory-slot graph. Overlap is on the left. StackCount is read. Greater Than feeds Branch. The true pin is the interface call. There is no Tick and no line trace. A trace belongs to interaction. An overlap belongs here.

Generated C++ is the overlap function plus the comparison and the call. The excerpt shows those lines with their numbers. The header declares StackCount. The source does not poll nearby actors on Tick.

One overlap event is enough. Scanning every actor on Tick to find pickups is the slow version, and it still needs the same interface at the end. Health does not live in the slot. The weapon reads ammo from the reserve, which a stack can fill. Save writes StackCount. Interaction can start a pickup that then overlaps, but the slot graph is the one that counts. A stack of one and a stack of thirty use the same interface and the same cap check. The cap itself belongs in the data asset next to the item name, so a grenade and a rifle round do not share a magic number in the graph. The interface stays the same when the cap changes.`,

  gunsmith: `The gunsmith is a data record with ten slots. A slot holds an attachment id. The graph does not build the mesh. IA_Equip picks a slot. Has Authority writes EquippedId. The client builds the visible weapon from the data asset that id names.

UE5 data assets are the right home for the ten slots. The replicated value is the id, a float in this sample graph, standing in for the name the asset uses. The mapping context can send IA_Equip from a number key. A radial menu can send the same action. The graph does not know which. It only sees the action.

The figure is the real gunsmith graph. IA_Equip triggers Has Authority. Has Authority writes EquippedId from the action value. There is no Tick, no trace, and no per-attachment actor. Spawning ten components on every equip is the expensive version.

The C++ excerpt is that function. Line numbers match the generated source. The header declares EquippedId. The source includes the header first and writes the id inside the authority gate.

Replicating one id is the efficient shape. Replicating every mesh and every socket transform is not. The weapon system reads the magazine size from the asset this id selects. Inventory stores the weapon item that points at the same asset. Save stores the id, not the meshes. Health does not care which slot is equipped. If a client writes EquippedId locally, the server overwrites it and the mesh pops. The ten slots stay in the data asset either way. Only the equipped id crosses the network. A cosmetic slot and a magazine slot are the same kind of id. The asset says which socket each one uses. The graph never stores a transform. Equip is one write. The mesh build is a local reaction to that write.`,

  save: `Save writes a slot the player can load later. Begin Play starts the load path. A Make struct packs the values. Set SlotValue stores them. A custom LoadSlot event reads them back and a Break struct pulls the fields out. The sample graph uses a struct so the slot is one value, not a pile of loose floats.

UE5 save games are objects the slot index addresses. This graph is the in-memory form of that write. Begin Play is the right place to load, because the pawn exists and the other systems have their variables. The write happens when a save event runs, not on Tick. A tick that saved would hitch and would also write a half-finished magazine.

The figure is the real save-load graph. Begin Play leads to the load. Make struct and Set SlotValue are the write. LoadSlot and Break struct are the read. The field pins are the values the other systems own: a position, a count, a health. The graph does not recompute them.

Generated C++ shows the make, the set, and the break. The line numbers are real. The header declares the slot value. The source does not save from Tick.

Saving on an event is cheap. Saving every frame, or saving the whole actor including its meshes, is not. Health, the magazine, the inventory stack, and the equipped id are the values worth packing. Input is not saved. The camera pose can be saved as a vector if the mode needs it. Load must run after Begin Play has created the components those values live on, or the write lands on nothing. Pack Health, Magazine, Reserve, StackCount, and EquippedId. Leave the input assets out. A second slot index is how an autosave and a manual save coexist. Both indexes use the same struct.`,
};

function quizInput() {
  return [
    mc("Which node starts the interact graph?", ["IA_Interact", "Tick", "Begin Play", "OnRep_Health"], 0, "The action is the start. Tick is not in the graph."),
    mc("What does the line trace hand to Branch?", ["A hit bool", "The magazine count", "Speed", "EquippedId"], 0, "The hit bool is the branch condition."),
    mc("Where should a mapping context be added?", ["On the possessed pawn or the player controller", "Inside Tick", "On every pickup", "In the save slot"], 0, "The pawn or controller owns the context."),
    mc("True or false: the interact graph traces on Tick so the prompt stays fresh.", YN, 1, "The trace runs from the action. A Tick trace goes stale and costs a query per frame."),
    mc("Why does the true pin call an interface instead of a cast?", ["So every usable actor can answer", "Interfaces are faster than a branch", "A cast cannot return a bool", "The trace only hits interfaces"], 0, "One call serves the door, the weapon, and the switch."),
  ];
}

function quizMove() {
  return [
    mc("What does IA_Move write?", ["Speed", "Health", "Magazine", "SlotValue"], 0, "Speed is the variable the movement component reads."),
    mc("Which comparison decides sprint versus walk?", ["Greater Than against zero", "Has Authority", "OnRep", "Break struct"], 0, "A live axis is greater than zero."),
    mc("What does the false path write into Speed?", ["The walk literal", "Health", "EquippedId", "StackCount"], 0, "The released axis takes the walk value."),
    mc("True or false: Speed should be written on Tick so animation stays smooth.", YN, 1, "The write belongs on the input. Tick would stomp a stance or an ability."),
    mc("Which later system reads the pawn this speed drives, but does not write Speed?", ["Interaction", "The save struct's field names", "OnRep_Health", "The magazine clamp"], 0, "Interaction aims from the pawn. It does not own Speed."),
  ];
}

function quizInteract() {
  return [
    mc("Where does the interact trace start?", ["The camera", "The feet", "The save slot", "The magazine"], 0, "The look starts at the camera."),
    mc("What blocks the trace?", ["A wall on the visibility channel", "Any trigger volume", "The mapping context", "OnRep"], 0, "Visibility hits the wall and ignores the trigger."),
    mc("What does the true pin call?", ["Execute_Interact", "Set Health", "Set Speed", "LoadSlot"], 0, "The interface is the contract."),
    mc("True or false: a cast to one door class is the right way to support every usable actor.", YN, 1, "A cast binds the graph to one class."),
    mc("Which system counts a stack, rather than tracing?", ["Inventory", "The aim camera", "The reload clamp", "Begin Play"], 0, "Inventory uses overlap. Interaction uses the trace."),
  ];
}

function quizWeapon() {
  return [
    mc("Which action starts a reload?", ["IA_Reload", "Tick", "Begin Play", "OnRep"], 0, "Reload is an action."),
    mc("What does And combine?", ["Magazine below MagSize, and Reserve above zero", "Health and Speed", "Two traces", "EquippedId and SlotValue"], 0, "Both checks must pass."),
    mc("What keeps Magazine inside its cap?", ["Clamp", "Tick", "OnRep", "Break struct"], 0, "Clamp writes a legal count."),
    mc("True or false: a full magazine should still pull rounds from the reserve.", YN, 1, "The less-than check refuses that reload."),
    mc("Which system later picks the magazine size from a data asset?", ["Gunsmith", "The camera trace", "Fog of war", "Perception"], 0, "The equipped asset names the size."),
  ];
}

function quizHealth() {
  return [
    mc("Which node gates the write to Health?", ["Has Authority", "IA_Move", "Break struct", "Overlap"], 0, "Only the authority subtracts."),
    mc("What does a client run when the float arrives?", ["OnRep", "A second subtract", "IA_Reload", "Set Speed"], 0, "OnRep is the notify. It does not subtract again."),
    mc("What is replicated?", ["The health float", "The hit flash widget", "The blood actor", "The input action"], 0, "The float is the state. The widget is local."),
    mc("True or false: a client may subtract Health so the hit feels instant.", YN, 1, "The client would snap back to the server value."),
    mc("Which system applies damage by calling this event, without writing Health itself?", ["The weapon", "The save slot", "IA_Move", "The mapping context"], 0, "The weapon calls the event. The health graph writes."),
  ];
}

function quizInventory() {
  return [
    mc("Which event starts the inventory graph?", ["Overlap", "Tick", "IA_Aim", "OnRep"], 0, "Overlap is the pickup event."),
    mc("What does Greater Than inspect?", ["StackCount against the cap", "The aim trace", "Health", "Throttle"], 0, "The stack has to have room."),
    mc("Why an interface call instead of writing the slot on the pickup?", ["The rifle and the medkit share one call", "Interfaces replicate faster", "Overlap cannot see the pawn", "The cap is always one"], 0, "The slot owns the count. The pickup asks."),
    mc("True or false: the inventory graph line-traces every frame to find pickups.", YN, 1, "The trace belongs to interaction. This graph uses overlap."),
    mc("Which value does save write from this system?", ["StackCount", "The mapping context", "The trace channel", "IA_Interact"], 0, "The count is the state worth saving."),
  ];
}

function quizGun() {
  return [
    mc("What does IA_Equip write?", ["EquippedId", "Health", "Speed", "Alert"], 0, "The id is the replicated value."),
    mc("Who is allowed to write it?", ["The authority", "Every client", "Tick", "The pickup"], 0, "Has Authority gates the write."),
    mc("How many attachment slots does this data record describe?", ["Ten", "Two", "One per Tick", "The magazine only"], 0, "The gunsmith record has ten slots."),
    mc("True or false: each attachment should replicate its own mesh and socket transform.", YN, 1, "The client builds the mesh from the asset the id names."),
    mc("Which system reads the magazine size from the asset this id selects?", ["The weapon", "Perception", "Fog of war", "The aim trace"], 0, "The weapon uses the size the asset names."),
  ];
}

function quizSave() {
  return [
    mc("Which event starts the load?", ["Begin Play", "Tick", "IA_Fire", "Overlap"], 0, "The pawn exists at Begin Play."),
    mc("What packs the values into one slot?", ["Make struct", "A Tick write", "OnRep", "Has Authority"], 0, "One struct is the slot."),
    mc("What reads a field back out?", ["Break struct", "IA_Move", "The line trace", "Clamp"], 0, "Break exposes the fields."),
    mc("True or false: the save graph should write the slot on Tick so a crash loses nothing.", YN, 1, "A tick save hitches and writes half-finished state."),
    mc("Which of these is not worth packing into the slot?", ["The input action asset", "Health", "Magazine", "EquippedId"], 0, "Input is a binding, not player state."),
  ];
}

const sections = [
  ["input", "Input", "interact", 1, ["Enhanced Input", "IA_Interact", "Line trace"], "The look starts at the action, not at Tick.", P.input, quizInput(), { kind: "graph", prompt: "The interact graph in the figure traces from Tick. Name the node that should start it, and the pin that should reach the trace.", accept: ["IA_Interact", "Triggered"], model: "IA_Interact starts the graph. Its Triggered pin feeds the line trace. Tick is removed." }],
  ["movement", "Movement", "movement", 2, ["IA_Move", "Speed", "Character movement"], "Speed is written when the axis changes.", P.movement, quizMove(), { kind: "cpp", prompt: "The generated function writes Speed from Tick. Which input action should own that write, and which variable does it set?", accept: ["IA_Move", "Speed"], model: "IA_Move owns the write. The function sets Speed to the sprint or walk literal. Tick does not assign Speed." }],
  ["interaction", "Interaction", "interact", 3, ["Line trace", "Branch", "Interface"], "One interface serves every usable actor.", P.interaction, quizInteract(), { kind: "vocabulary", prompt: "Name the interface function the true pin calls, and the channel the trace should use so a wall blocks it.", accept: ["Execute_Interact", "visibility"], model: "Execute_Interact is the call. The visibility channel blocks on a wall." }],
  ["weapon", "Weapon and ammo", "tactical-ammo", 4, ["IA_Reload", "Magazine", "Reserve", "Clamp"], "Both checks pass before a round moves.", P.weapon, quizWeapon(), { kind: "efficiency", prompt: "A reload runs on Tick and also spawns one actor per bullet. Name the action that should start the reload, and the node that caps the magazine.", accept: ["IA_Reload", "Clamp"], model: "IA_Reload starts the reload. Clamp caps Magazine at MagSize. Tick and per-bullet actors go away." }],
  ["health", "Health and damage", "replicated-health", 5, ["Any Damage", "Has Authority", "OnRep"], "Only the authority writes the float.", P.health, quizHealth(), { kind: "cpp", prompt: "A client function subtracts Health. Which node must gate the write, and which notify should the client run instead?", accept: ["Has Authority", "OnRep"], model: "Has Authority gates the write. The client runs OnRep and does not subtract." }],
  ["inventory", "Inventory", "inventory-slot", 6, ["Overlap", "StackCount", "AddToSlot"], "The slot counts. The pickup asks.", P.inventory, quizInventory(), { kind: "compatibility", prompt: "Interaction traces and inventory overlaps. Which event should add to a stack, and which value does save store from it?", accept: ["Overlap", "StackCount"], model: "Overlap adds through the interface. Save stores StackCount." }],
  ["gunsmith", "Gunsmith data", "gunsmith", 7, ["IA_Equip", "EquippedId", "Ten slots"], "Replicate the id, not the meshes.", P.gunsmith, quizGun(), { kind: "inefficiency", prompt: "Ten attachment meshes replicate on every equip. What should replicate instead, and which action selects the slot?", accept: ["EquippedId", "IA_Equip"], model: "EquippedId replicates. IA_Equip selects the slot. The client builds meshes from the asset." }],
  ["save", "Save", "save-load", 8, ["Begin Play", "Make struct", "LoadSlot"], "One struct, written on an event.", P.save, quizSave(), { kind: "graph", prompt: "The save graph writes the slot from Tick. Which event should load, and which node packs the fields?", accept: ["Begin Play", "Make"], model: "Begin Play loads. Make struct packs the fields. Tick does not write the slot." }],
].map(([id, title, graph, order, depends, why, essay, quiz, assignment]) => section({
  id, title, graph, order, depends, why, quiz, assignment,
  paragraphs: essay.split("\n\n"),
}));

const examItems = [
  { prompt: "An FPS pawn polls the keyboard inside Tick to decide when to interact. What should start the look?", choices: ["IA_Interact", "Begin Play", "OnRep", "Overlap"], answer: 0, why: "The action starts the look." },
  { prompt: "The interact trace starts at the feet and hits the floor. Where should it start?", choices: ["The camera", "The reserve ammo", "The save slot", "EquippedId"], answer: 0, why: "The camera is the aim origin." },
  { kind: "tf", prompt: "True or false: mapping contexts let one input action serve a keyboard and a gamepad.", choices: YN, answer: 0, why: "The context binds the action. The graph keeps the action name." },
  { prompt: "Speed is assigned every frame and a stance change is lost. Which action should own the write?", choices: ["IA_Move", "IA_Fire", "LoadSlot", "OnRep"], answer: 0, why: "IA_Move writes Speed when the axis changes." },
  { prompt: "The axis is released and the pawn keeps sprinting. Which literal should the false path write?", choices: ["The walk speed", "MagSize", "Health", "Alert"], answer: 0, why: "The false path is the walk literal." },
  { kind: "graph-repair", graph: "movement", sample: "Tick writes Speed", prompt: "The broken movement graph writes Speed from the red Tick node. What should feed Set Speed instead?", choices: ["IA_Move through the greater-than branch", "OnRep_Health", "LoadSlot", "Overlap"], answer: 0, why: "The axis comparison chooses the literal. Tick does not." },
  { prompt: "A door, a rifle, and a switch each have their own cast in the interact graph. What replaces the casts?", choices: ["Execute_Interact", "Set Health", "Clamp", "Break struct"], answer: 0, why: "One interface covers every usable actor." },
  { prompt: "The reload runs while the magazine is full and the reserve falls. Which two checks does And require?", choices: ["Magazine below MagSize, and Reserve above zero", "Health above zero, and Speed above zero", "Two line traces", "EquippedId and Alert"], answer: 0, why: "Both ammo checks must pass." },
  { kind: "cpp-repair", graph: "tactical-ammo", sample: "void Tick()\n{\n  Magazine = Magazine + Needed;\n}", prompt: "This reload adds Needed inside Tick. What is wrong with it?", choices: ["Reload belongs on IA_Reload, and Clamp must cap Magazine", "Tick is the only place a float can change", "Needed should be a widget", "Magazine should replicate per bullet"], answer: 0, why: "The action starts the reload. Clamp keeps the count legal." },
  { prompt: "A client subtracts Health on the hit so the bar moves early, then snaps back. Which node was skipped?", choices: ["Has Authority", "IA_Move", "Make struct", "Greater Than"], answer: 0, why: "The authority is the only writer." },
  { kind: "tf", prompt: "True or false: OnRep is the right place to subtract Health a second time.", choices: YN, answer: 1, why: "OnRep notifies. It does not apply the damage again." },
  { kind: "graph-repair", graph: "replicated-health", sample: "Tick subtracts Health", prompt: "The broken health graph subtracts from the red Tick node. Which event should start the write?", choices: ["Any Damage, gated by Has Authority", "IA_Move", "Begin Play", "Overlap"], answer: 0, why: "Damage is an event. Authority gates the float." },
  { prompt: "Pickups are found by scanning every actor on Tick. Which event should add to a stack?", choices: ["Overlap", "IA_Aim", "OnRep", "Break struct"], answer: 0, why: "Overlap is the pickup event." },
  { prompt: "EquippedId is ignored and ten meshes replicate. What should the authority write?", choices: ["EquippedId", "Each socket transform", "Speed", "Alert"], answer: 0, why: "The id selects the asset. The client builds the meshes." },
  { prompt: "The save slot writes on Tick and a crash restores a half-empty magazine. Which event should load, and which node should pack the fields?", choices: ["Begin Play loads, Make struct packs", "Tick loads, Branch packs", "Overlap loads, Clamp packs", "OnRep loads, Add packs"], answer: 0, why: "Begin Play loads a finished struct." },
  { kind: "cpp-repair", graph: "save-load", sample: "void Tick()\n{\n  SlotValue = Health;\n}", prompt: "Tick assigns SlotValue from Health every frame. What should happen instead?", choices: ["An event writes a Make struct, and Begin Play loads it", "Tick is required for save games", "Health should not be a float", "SlotValue should be an input action"], answer: 0, why: "The struct is written on an event and loaded at Begin Play." },
  { prompt: "Which value does the weapon graph refuse to change?", choices: ["Health", "Magazine", "Reserve", "MagSize"], answer: 0, why: "The weapon calls the damage event. Health owns the float." },
  { prompt: "Which system stores StackCount, the magazine, and EquippedId together?", choices: ["Save", "The mapping context", "The line trace", "Tick"], answer: 0, why: "Those are the player values the struct packs." },
  { kind: "graph-repair", graph: "interact", sample: "Tick traces", prompt: "The broken interact graph traces from Tick. Which pin of IA_Interact should reach the trace?", choices: ["Triggered", "OnRep", "Else", "Tick"], answer: 0, why: "Triggered is the press." },
  { kind: "cpp-repair", graph: "replicated-health", sample: "void OnRep_Health()\n{\n  Health = Health - Amount;\n}", prompt: "OnRep subtracts Amount again. What should OnRep do?", choices: ["Update the local feedback and leave the float alone", "Subtract Amount a second time for prediction", "Call IA_Reload", "Write Speed"], answer: 0, why: "The server already applied the damage." },
];

export const fpsBeginner = {
  id: "fps-beginner",
  genre: "fps",
  level: "beginner",
  title: "FPS — Beginner",
  summary: "Build a first person kit in the order the player needs it: input, movement, interaction, the magazine, replicated health, a slot, a gunsmith id, and a save.",
  sections,
  exam: { questions: examItems.map((item, index) => examQuestion("fps-beginner", item, index)) },
};
