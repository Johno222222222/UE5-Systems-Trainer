"use strict";

// Offline, deterministic notes for generated C++ lines and the nodes that emit them.
// No model call. The same line always gets the same sentence.

let authoredNodes = {};
let lineNotes = {};
try {
  authoredNodes = require("../../content/study/nodes.json");
} catch (err) {
  authoredNodes = {};
}
try {
  lineNotes = require("../../content/study/lines.json");
} catch (err) {
  lineNotes = {};
}

const CATALOG_EXPLAIN = {
  "begin-play": "Begin Play fires once when this actor is spawned or placed and the play session starts for it. It does not start servers or the match.",
  "end-play": "End Play runs when the actor is leaving. Use it to stop timers and drop what this actor owned.",
  tick: "Tick runs every frame. Anything on this line repeats for as long as the actor is alive.",
  "enhanced-input": "This is the key or button press. The rest of the function runs only when that action fires.",
  "custom-event": "This is a named event. It runs when something else calls that name.",
  "line-trace": "A line trace asks the physics scene what the aim hits, and stores that hit.",
  "sphere-trace": "A sphere trace is a thick sweep. It asks what a ball along the aim would bump.",
  "break-hit": "Break Hit pulls the actor, the point, and the bone out of the trace result.",
  "apply-damage": "Apply Damage tells the hit actor it was hurt, and names the damage type.",
  "destroy-actor": "Destroy removes that actor from the world.",
  "play-sound": "Play Sound starts a sound at a point in the world.",
  "spawn-niagara": "Spawn Niagara starts a particle system at a point in the world.",
  "set-blackboard": "Set Blackboard writes one value the AI can read later.",
  "move-to": "Move To asks the AI controller to walk toward a point.",
  "activate-ability-tag": "This tries to start the ability that carries that gameplay tag.",
  "activate-ability-class": "This tries to start one ability class on this actor.",
  "apply-effect-self": "This applies a gameplay effect to the same actor, such as a buff or a cost.",
  "has-gameplay-tag": "This asks whether the actor currently has that gameplay tag.",
  "get-player-character": "This gets the character the local player is controlling.",
  "get-player-controller": "This gets the player controller, the object that owns input for that player.",
  "switch-authority": "This splits the graph. The authority side is the server. The other side is everyone else.",
  "has-authority": "This asks if this machine is the authority. Shared numbers should change only when the answer is yes.",
  branch: "Branch is an if. One pin runs when the condition is true, the other when it is false.",
  sequence: "Sequence runs the following pins in order, one after another.",
  forloop: "For Loop counts from the first index to the last and runs the body each time.",
  foreach: "For Each walks a list and runs the body once per item.",
  while: "While keeps running the body until its condition becomes false.",
  "print-string": "Print String writes a message on the screen. It is a trace of what happened, not gameplay.",
  "set-variable": "Set stores a value on the component so a later step can read it.",
  "get-variable": "Get reads a value that an earlier Set stored.",
  literal: "This is a fixed number or name typed on the node. It does not change on its own.",
  add: "Add sums the two inputs.",
  subtract: "Subtract takes the second input off the first.",
  multiply: "Multiply scales one number by the other.",
  divide: "Divide splits the first number by the second.",
  clamp: "Clamp keeps a number inside a lowest and highest value.",
  lerp: "Lerp blends from the first value toward the second by the alpha.",
  equal: "Equal asks whether the two inputs are the same.",
  greater: "Greater asks whether the first number is larger.",
  less: "Less asks whether the first number is smaller.",
  and: "AND is true only when both inputs are true.",
  or: "OR is true when either input is true.",
  not: "NOT flips a yes into a no, or a no into a yes.",
  select: "Select picks the first value when the condition is true, and the second when it is false.",
  "do-once": "Do Once lets the body run a single time, then stays closed.",
  gate: "Gate holds the exec until something opens it.",
  flipflop: "FlipFlop alternates. Each call takes the other exit.",
  delay: "Delay waits, then continues. The actor can do other work during the wait.",
  timeline: "Timeline plays a curve over time and feeds the alpha out.",
  "cast-to": "Cast To checks whether the object is that class. The body runs only when the cast succeeds.",
  "dispatcher-bind": "Bind connects a dispatcher to a function, so that function runs when the dispatcher fires.",
  "dispatcher-call": "Call fires the dispatcher, which runs every function that bound to it.",
  "make-struct": "Make Struct fills in the fields of one struct value.",
  "break-struct": "Break Struct pulls the fields back out of a struct.",
  "call-function": "This calls another function and waits for it to return.",
  "interface-call": "This calls an interface. The actor that implements the interface does the work.",
  "set-timer": "Set Timer schedules a function to run later, instead of every frame.",
  "set-timer-event": "Set Timer by Event schedules an event to run later.",
  "set-timer-function": "Set Timer by Function Name schedules a function by its name.",
  "spawn-actor": "Spawn Actor creates a new actor in the world.",
  "any-damage": "Any Damage runs when this actor is hurt. The incoming number is how much.",
  "point-damage": "Point Damage runs for a hit at one spot, including where the shot landed.",
  "begin-overlap": "Begin Overlap runs when another actor starts touching this one.",
  "end-overlap": "End Overlap runs when the other actor stops touching this one.",
  hit: "Hit runs when a blocking collision happens.",
  "on-rep": "OnRep runs on the other machines after a replicated property arrives.",
  "call-user": "This calls a function you added on the component.",
  "call-macro": "This runs a macro, a reusable chain of nodes.",
  "rpc-server": "A Server RPC asks the authority to run this. Clients do not apply it themselves.",
  "rpc-client": "A Client RPC runs on the owning client.",
  "rpc-multicast": "A Multicast RPC runs on the server and on the clients.",
};

const HEADER_NOTES = {
  "CoreMinimal.h": "The smallest Unreal header. It brings in the basic types, memory helpers, and the macros every gameplay file starts from.",
  "Engine/Engine.h": "The engine header. It exposes the engine singleton and a few helpers older samples call.",
  "Engine/World.h": "The world header. GetWorld and the timer manager live here, so a line can ask the level what exists.",
  "Engine/HitResult.h": "The hit-result header. A trace writes one of these: the actor, the point, and whether it blocked.",
  "Engine/DamageEvents.h": "Damage event structs. Point damage and any damage describe a hit with these.",
  "GameFramework/Actor.h": "The actor header. Destroy, GetOwner, and HasAuthority are actor functions.",
  "GameFramework/Character.h": "The character header. A character is a pawn with movement. Get Player Character returns one.",
  "GameFramework/Pawn.h": "The pawn header. A pawn is an actor that a controller can possess.",
  "GameFramework/PlayerController.h": "The player-controller header. It owns a player's input and camera.",
  "GameFramework/DamageType.h": "The damage-type class. Apply Damage passes UDamageType so the engine knows what kind of hurt it was. A game build needs this header, not only the damage-event header.",
  "Kismet/GameplayStatics.h": "Gameplay Statics. Apply Damage, Play Sound, and Get Player Character are static helpers in here.",
  "CollisionShape.h": "Collision shapes. A sphere trace builds an FCollisionShape from this header.",
  "CollisionQueryParams.h": "Query params. A trace uses them to ignore the actor who fired the shot.",
  "Sound/SoundBase.h": "The sound base. Play Sound at Location takes one of these assets.",
  "NiagaraFunctionLibrary.h": "Niagara's function library. Spawn System at Location starts a particle system through it.",
  "NiagaraSystem.h": "A Niagara system asset. The spawn node needs the asset type, not only the library.",
  "AIController.h": "The AI controller. Move To and the blackboard are reached from this controller.",
  "BehaviorTree/BlackboardComponent.h": "The blackboard component. Set Blackboard writes a key on it.",
  "AbilitySystemInterface.h": "The ability-system interface. An actor that can use GAS implements this so other code can ask for the component.",
  "AbilitySystemComponent.h": "The ability system component. It activates abilities and applies effects.",
  "GameplayTagContainer.h": "Gameplay tags. A tag is a name like State.Stunned, and a container holds several.",
  "GameplayEffect.h": "A gameplay effect. Apply Effect to Self uses this asset to change attributes.",
  "GameplayEffectTypes.h": "Effect handles and contexts. The spec that Apply Effect builds is defined here.",
  "Abilities/GameplayAbility.h": "A gameplay ability class. Activate by Class needs the ability type so StaticClass is a real class.",
  "Components/ActorComponent.h": "The component header. UActorComponent is the base this generated component extends.",
  "TimerManager.h": "The timer manager. Set Timer talks to it so work can run later instead of on Tick.",
  "Net/UnrealNetwork.h": "The network header. DOREPLIFETIME, the macro that replicates a property, comes from here.",
};

function tidy(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function explainCatalog(catalog) {
  const key = String(catalog || "");
  return CATALOG_EXPLAIN[key] || "";
}

function explainLine(text, catalog) {
  const raw = String(text || "");
  const line = tidy(raw);
  if (!line) return "This row is blank. The generator left a gap between functions.";
  if (/^\s*hold_time\s*=\s*0(?:\.0*f)?\s*;?\s*$/i.test(line)) return "start the hold timer at zero";
  const fromCatalog = explainCatalog(catalog);
  if (fromCatalog && catalog) return fromCatalog;

  if (line.startsWith("#include")) {
    const header = (line.match(/"([^"]+)"/) || [])[1] || line;
    return headerNote(header);
  }
  if (line.startsWith("#pragma")) return "This pragma marks the generated header. Unreal's header tool needs it once, above the generated include.";
  if (line.startsWith("//")) {
    if (/node:/.test(line)) return "This comment names the graph node that emitted the next line, so a click can explain that node.";
    if (/graph:begin/.test(line)) return "This marks the start of a block the graph owns. A later edit inside the block can be regenerated.";
    if (/graph:end/.test(line)) return "This marks the end of the graph-owned block.";
    return "This comment is a note for a person. The game skips it.";
  }
  if (line === "{" || line === "}") return line === "{"
    ? "The opening brace starts the function body. The lines inside belong to that function."
    : "The closing brace ends the function body.";

  const zero = line.match(/\b([A-Za-z_]\w*)\s*=\s*0(?:\.0*f)?\s*;/);
  if (zero) {
    const name = zero[1].replace(/_/g, " ");
    if (/hold/i.test(zero[1])) return "start the hold timer at zero";
    return `start ${name} at zero`;
  }

  const signature = line.match(/^(?:void|bool|int32|float|F[\w:]+|A[\w:]+|U[\w:*]+)\s+[\w:]+\s*::\s*(\w+)\s*\(([^)]*)\)/);
  if (signature) {
    const node = (line.match(/node:(\S+)/) || [])[1];
    const args = signature[2].trim();
    const who = node ? `the node ${node}` : "the graph node that called it";
    const inputs = args ? ` It receives ${args}.` : " It takes no inputs.";
    return `This is the function ${signature[1]}. ${who} became this function.${inputs}`;
  }

  if (/HasAuthority\s*\(/.test(line)) return "This asks whether this machine is the authority. The block inside should be the only place that writes shared state.";
  if (/GetOwner\s*\(\)/.test(line) && /HasAuthority/.test(line)) return "A component asks its owner actor who has authority. The component itself is not the authority.";
  if (/SetTimer\s*\(/.test(line)) return "This starts a timer. The named function runs when the time is up, not on every frame.";
  if (/ApplyDamage\s*\(/.test(line)) return "This applies damage to the actor in the call. UDamageType names the kind of damage.";
  if (/LineTraceSingleByChannel|SweepSingleByChannel/.test(line)) return "This asks the world for a hit along the aim and stores it in a hit result.";
  if (/PlaySoundAtLocation\s*\(/.test(line)) return "This plays a sound asset at a location.";
  if (/SpawnSystemAtLocation\s*\(/.test(line)) return "This spawns a Niagara system at a location.";
  if (/TryActivateAbilitiesByTag|TryActivateAbilityByClass/.test(line)) return "This asks the ability system to start an ability, by tag or by class.";
  if (/ApplyGameplayEffectSpecToSelf\s*\(/.test(line)) return "This applies a gameplay effect to this actor.";
  if (/HasMatchingGameplayTag\s*\(/.test(line)) return "This asks the ability system whether the actor has that tag right now.";
  if (/GetPlayerCharacter\s*\(/.test(line)) return "This gets the player character at index 0.";
  if (/GetPlayerController\s*\(/.test(line)) return "This gets the player controller at index 0.";
  if (/MoveToLocation\s*\(/.test(line)) return "This tells the AI controller to walk to a point.";
  if (/SetValueAs/.test(line)) return "This writes one blackboard key.";
  if (/->Destroy\s*\(/.test(line)) return "This destroys the actor.";
  if (/Cast<\s*IAbilitySystemInterface\s*>/.test(line)) return "This checks whether the owner implements the ability system interface before using GAS.";
  if (/^if\s*\(/.test(line)) return "This if runs the next block only when the check is true.";
  if (/^for\s*\(/.test(line)) return "This for loop repeats the next block for each step of the count.";
  if (/^while\s*\(/.test(line)) return "This while loop repeats the next block until the check is false.";

  const assign = line.match(/\b([A-Za-z_]\w*)\s*=\s*([^;]+);/);
  if (assign) {
    const name = assign[1].replace(/_/g, " ");
    return `this stores a new value in ${name}`;
  }
  const call = line.match(/\b([A-Za-z_]\w*)\s*\(/);
  if (call) return `this calls ${call[1].replace(/_/g, " ")}`;
  return `this line is part of the generated function: ${line.slice(0, 80)}`;
}

function headerNote(header) {
  const key = String(header || "").replace(/^"|"$/g, "");
  if (HEADER_NOTES[key]) return HEADER_NOTES[key];
  const base = key.split("/").pop();
  if (HEADER_NOTES[base]) return HEADER_NOTES[base];
  if (/GameplayAbilit/i.test(key)) return `${key} is a Gameplay Abilities header. It declares the GAS type the line below uses.`;
  if (/Niagara/i.test(key)) return `${key} is a Niagara header. It declares the particle type the spawn line uses.`;
  if (/AI|BehaviorTree|Navigation/i.test(key)) return `${key} is an AI header. It declares the controller or blackboard type the move line uses.`;
  return `${key} declares the type the next line uses, so a game build can see that type without the editor's shared headers.`;
}

const LABEL_CATALOG = {
  "event beginplay": "begin-play",
  "event begin play": "begin-play",
  beginplay: "begin-play",
  "begin play": "begin-play",
  "event tick": "tick",
  tick: "tick",
  "set timer by function name": "set-timer-function",
  "set timer by function": "set-timer-function",
  "set timer": "set-timer",
  "line trace": "line-trace",
  branch: "branch",
  "print string": "print-string",
  "cast to": "cast-to",
  "has authority": "has-authority",
  "apply damage": "apply-damage",
  "interface call": "interface-call",
  "call function": "call-function",
  delay: "delay",
  flipflop: "flipflop",
  "break struct": "break-struct",
  "make struct": "make-struct",
  "on rep": "on-rep",
  onrep: "on-rep",
};

const NAMED_NOTES = {
  "trace for focus": "Trace For Focus fires a short line trace from the camera to find the usable thing you are looking at. It runs when the timer calls it, not on every frame. For example, a door under the crosshair becomes the focused actor about ten times a second.",
  "branch valid focus": "Branch Valid Focus continues only if the trace hit something that can be used. A miss stops here and clears the prompt. For example, looking at the sky does not offer a Use button.",
  "broadcast onfocuschanged": "Broadcast OnFocusChanged tells listeners such as the HUD that the focused object changed, so the prompt updates. It does not trace and it does not open the door. For example, the widget shows Use when focus lands on a crate and hides when focus leaves.",
  "broadcast on focus changed": "Broadcast OnFocusChanged tells listeners such as the HUD that the focused object changed, so the prompt updates. It does not trace and it does not open the door. For example, the widget shows Use when focus lands on a crate and hides when focus leaves.",
};

function catalogFromLabel(label) {
  const key = tidy(label).toLowerCase();
  if (LABEL_CATALOG[key]) return LABEL_CATALOG[key];
  if (NAMED_NOTES[key]) return "";
  return "";
}

function composeUnknown(node) {
  const label = tidy(node?.label) || tidy(node?.data?.function) || tidy(node?.data?.action) || "This node";
  const kind = String(node?.kind || node?.node_type || "step");
  const fn = String(node?.data?.function || node?.data?.action || node?.data?.name || "").trim();
  const pins = (node?.pins || []).map((pin) => pin.name).filter((name) => name && !/^exec$/i.test(name));
  const pinBit = pins.length ? ` The other pins carry ${pins.join(" and ")}.` : "";
  if (kind === "event" || /^event\b/i.test(label)) {
    return `${label} is an event on this actor. It fires when that event happens, and the nodes after it wait for it. For example, ${label} is the start of this chain rather than a check on every frame.`;
  }
  if (fn) {
    return `${label} calls ${fn} when its exec input fires.${pinBit} For example, ${fn} runs once for this call instead of on Tick.`;
  }
  if (pins.length) {
    return `${label} is a ${kind} node that uses ${pins.join(" and ")} when it runs. For example, ${label} reads ${pins[0]} for this system and does not poll it.`;
  }
  return `${label} is a ${kind} node in this system's graph. It runs when the exec wire into ${label} fires. For example, deleting ${label} stops only the work that node was doing.`;
}

function explainNode(node) {
  const source = node && typeof node === "object" ? node : { catalog: node, label: "" };
  const catalog = String(source.catalog || "");
  const id = String(source.id || "");
  const label = tidy(source.label) || "This node";
  const written = String(source.data?.note || source.note || "").trim();
  if (written && !/does the job printed on the node/i.test(written)) return written;
  const named = NAMED_NOTES[label.toLowerCase()];
  if (named) return named;
  if (authoredNodes[catalog]) return authoredNodes[catalog];
  if (authoredNodes[id]) return authoredNodes[id];
  if (lineNotes[id]) return lineNotes[id];
  const fromLabel = catalogFromLabel(label);
  if (fromLabel && authoredNodes[fromLabel]) return authoredNodes[fromLabel];
  const base = explainCatalog(catalog) || explainCatalog(fromLabel);
  if (base) return `${label}: ${base}`;
  return composeUnknown(source);
}

function nodeWhy(catalog, label) {
  return explainNode({ catalog, label });
}

const EXPANSION_SETS = {
  interaction: [
    { title: "Doors", detail: "A door implements Interact. The trace hits the door, the true pin calls the interface, and the door swings if it is unlocked." },
    { title: "Switches", detail: "A switch is the same interface as a door. The hit flips a replicated bool, and the mesh plays the on pose from OnRep." },
    { title: "Pickups", detail: "A pickup uses the same press. The true pin adds one item to the inventory and then destroys the pickup actor." },
  ],
  health: [
    { title: "Armor", detail: "Armor is a second number that Apply Damage spends before health. It still changes only on the authority." },
    { title: "Regen", detail: "Regen is a timer that adds health after a few quiet seconds. It is not a Tick, and a new hit restarts the wait." },
    { title: "Downed state", detail: "At zero health the authority sets a downed tag instead of destroying the actor, and a teammate interact clears it." },
  ],
  weapon: [
    { title: "Reload", detail: "Reload is its own input action. It fills the magazine from reserve and does not trace." },
    { title: "Spread", detail: "Spread adds a small random angle to the same trace the fire action already starts." },
    { title: "Recoil", detail: "Recoil kicks the control rotation for a moment after a shot, then a timeline returns it." },
  ],
  ai: [
    { title: "Patrol", detail: "Patrol is a timer that advances an index and calls Move To the next point." },
    { title: "Hearing", detail: "A loud sound writes a location on the blackboard. The AI moves there without a second brain." },
    { title: "Leash", detail: "If the target is too far, the controller clears the key and returns to the patrol index." },
  ],
  save: [
    { title: "Checkpoint", detail: "A checkpoint actor calls the same save function the menu uses, and writes the slot." },
    { title: "Continue", detail: "Continue reads that slot on Begin Play and sets health, ammo, and the equipped id." },
    { title: "Slot select", detail: "A second slot is another save game object, not a second copy of the component." },
  ],
  gas: [
    { title: "Sprint cost", detail: "Sprint is an ability activated by a tag. An effect drains stamina while the tag is on." },
    { title: "Reload ability", detail: "Reload can be an ability class instead of a raw input function, so a stun tag can block it." },
    { title: "Damage effect", detail: "A damage effect changes health through the attribute set, and the weapon only applies the effect." },
  ],
};

function expansionExamples(text) {
  const blob = String(text || "").toLowerCase();
  if (/interact|door|switch|pickup|listener/.test(blob)) return EXPANSION_SETS.interaction;
  if (/health|damage|armor|regen/.test(blob)) return EXPANSION_SETS.health;
  if (/weapon|magazine|fire|ammo|recoil|spread/.test(blob)) return EXPANSION_SETS.weapon;
  if (/ai|patrol|blackboard|move to|sense|alert/.test(blob)) return EXPANSION_SETS.ai;
  if (/save|slot|checkpoint/.test(blob)) return EXPANSION_SETS.save;
  if (/ability|gameplay effect|gas|tag/.test(blob)) return EXPANSION_SETS.gas;
  if (/tick|timer/.test(blob)) return [
    { title: "A cooldown", detail: "Replace the Tick with a one-shot timer that opens the gate when it finishes." },
    { title: "A pulse", detail: "A looping timer can ask the same question four times a second without asking every frame." },
  ];
  return [
    { title: "A listener", detail: "A follow-on system should bind to the event this graph already fires, instead of polling it." },
    { title: "A data row", detail: "A designer number in this graph belongs on a data asset so a new variant does not need a code edit." },
  ];
}

module.exports = {
  CATALOG_EXPLAIN,
  HEADER_NOTES,
  EXPANSION_SETS,
  explainLine,
  explainCatalog,
  headerNote,
  nodeWhy,
  explainNode,
  expansionExamples,
};
