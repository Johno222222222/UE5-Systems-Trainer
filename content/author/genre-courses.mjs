import fs from "fs";

const YN = ["True", "False"];

function words(text) {
  return String(text).split(/\s+/).filter(Boolean).length;
}

function quiz(rows) {
  return rows.map((row) => ({
    id: row[0],
    prompt: row[1],
    choices: row[2],
    answer: row[3],
    why: row[4],
    review_prompt: row[5],
  }));
}

const short = [];
function mod(id, title, takeaway, assignment, rows, diffSpec) {
  const count = words(takeaway);
  if (count < 120 || count > 260) short.push(`${id} ${count}`);
  return {
    id,
    title,
    takeaway,
    assignment: { prompt: assignment[0], accept: assignment[1] },
    quiz: quiz(rows),
    diff: {
      id: `${id}-diff`,
      prompt: diffSpec[0],
      review_prompt: diffSpec[1],
      why: diffSpec[2],
      bug: diffSpec[3],
      left: { label: diffSpec[4][0], code: diffSpec[4][1] },
      right: { label: diffSpec[5][0], code: diffSpec[5][1] },
    },
  };
}

function course(id, title, summary, level, genre, modules) {
  const min = level === "intermediate" ? 5 : 4;
  for (const item of modules) {
    if (item.quiz.length < min) throw new Error(`${id} ${item.id} quiz is short`);
  }
  return {
    id,
    title,
    summary,
    level,
    genre,
    glossary_tags: ["Core", "Networking", "Data"],
    pass_mark: 70,
    modules,
  };
}

const fpsBeginner = course("fps-beginner", "FPS, beginner", "A short first-person course: the press that starts a look, a magazine that clamps, a pickup that counts, and health that only the authority writes.", "beginner", "fps", [
  mod("press", "The press, not the frame",
    `A first-person look starts when the player asks. IA_Interact fires Triggered, the trace leaves the camera along the aim, and a hit calls Interact through the interface. IA_Fire is the same shape for a shot. The mapping context binds the key or the pad. The graph never reads the key code, so moving the binding does not edit the trace.

Tick is the wrong schedule. It spends a physics query while the player stands still, and the stored hit is already stale when the press arrives. The weapon, the inventory, and the save all wait for their own events. They do not poll the keyboard, and they do not start a second trace to rediscover a door the interact graph already named.

One query per press is the budget. A prompt that wants to hover can read the last hit. It does not get its own Tick. The false pin of the branch is a miss. A miss logs and stops. It does not open a door and it does not subtract health.`,
    ["Name the action that starts the look, and the call a hit makes.", ["IA_Interact", "Interact"]],
    [
      ["press-1", "What starts the first-person look?", ["IA_Interact", "Tick", "Begin Play", "OnRep"], 0, "The action is the press.", "Which action traces?"],
      ["press-2", "Where does the trace start?", ["The camera", "The feet", "The save slot", "The magazine"], 0, "The crosshair is the aim.", "Where is the trace origin?"],
      ["press-3", "A miss should do what?", ["Stop", "Open the door", "Subtract health", "Save the slot"], 0, "The false pin ends.", "What does a miss do?"],
      ["press-4", "True or false: the interact graph should trace on Tick so the prompt stays fresh.", YN, 1, "The press owns the query.", "Does the look trace on Tick?"],
    ],
    ["Which look is broken?", "Which schedule queries while nothing changed?", "The right-hand version is Tick.", "right", ["Press", "void Graph_IA_Interact() { LineTrace(); }"], ["Tick", "void Tick() { LineTrace(); }"]]),
  mod("magazine", "Rounds in the gun",
    `IA_Reload is the only start of a magazine move. Magazine is the rounds in the gun. Reserve is the rounds on the body. MagSize is the cap. Less Than asks whether the magazine is below the cap. Greater Than asks whether the reserve still has a round. And refuses the reload when either check fails. Clamp writes the magazine back inside zero and MagSize.

Those three numbers can move to a data row later. The graph's job is the event and the clamp, not the literal. A Tick that reloads by itself fires while the player is swapping weapons. Spawning one actor per bullet replicates a mesh the count already describes.

Health does not own the magazine. Inventory can hand a stack into Reserve. The gunsmith, in the longer track, picks which asset named the cap. Save writes the two counts after the reload finishes, not halfway through the add.`,
    ["Name the action and the call that keeps the magazine inside its cap.", ["IA_Reload", "Clamp"]],
    [
      ["mag-1", "What starts a reload?", ["IA_Reload", "Tick", "Overlap", "OnRep_Health"], 0, "Reload is an action.", "Which action reloads?"],
      ["mag-2", "What refuses a full magazine?", ["And of the two comparisons", "Tick", "The camera", "Alert"], 0, "Both checks have to pass.", "What gates the add?"],
      ["mag-3", "Where should MagSize live once designers tune it?", ["A data row", "A Tick literal", "The mapping context", "The widget"], 0, "The cap is data.", "Where is the cap?"],
      ["mag-4", "True or false: each round should replicate as its own actor.", YN, 1, "The counts are the state.", "Do bullets replicate as actors?"],
    ],
    ["Which reload is broken?", "Which version reloads without a press?", "The right-hand version is Tick.", "right", ["Action", "void Graph_IA_Reload() { Magazine = Clamp(...); }"], ["Tick", "void Tick() { Magazine += 1.f; }"]]),
  mod("pickup", "A stack, not a scan",
    `Overlap is the pickup. StackCount is the number already in the slot. Greater Than asks whether the stack still has room. The true pin calls AddToSlot on the interface, so a rifle and a medkit share the call. A cast to one pickup class excludes the other.

The trace that highlights a door is the interact graph. It does not increment StackCount, or looking at a key fills the bag. The cap belongs on the item asset. A grenade and a rifle round do not share a magic number in the graph.

Scanning every actor on Tick to find pickups still ends at the same interface, and it does the search while the player is standing still. Health is not a stack. The weapon reads ammo from Reserve, which a stack can fill. Save writes StackCount. It does not write the pickup mesh.`,
    ["Name the event that counts, and the call it makes.", ["Overlap", "AddToSlot"]],
    [
      ["pick-1", "What increments a stack?", ["Overlap, then AddToSlot", "The interact trace", "Tick", "OnRep"], 0, "Overlap owns the count.", "Which event counts?"],
      ["pick-2", "Why an interface instead of a cast?", ["A rifle and a medkit share the call", "Casts are faster", "Tick requires an interface", "Save forbids casts"], 0, "The contract is one function.", "Why not a cast?"],
      ["pick-3", "Where does the stack cap belong?", ["On the item asset", "In the trace", "On Tick", "In the camera"], 0, "Items differ.", "Where is the cap?"],
      ["pick-4", "True or false: the interact trace should increment StackCount.", YN, 1, "The trace highlights. Overlap counts.", "Does the look count items?"],
    ],
    ["Which pickup is broken?", "Which version counts because the player looked?", "The right-hand version counts from the trace.", "right", ["Overlap", "void OnOverlap() { AddToSlot(); }"], ["Trace", "void Graph_IA_Interact() { StackCount += 1.f; }"]]),
  mod("authority", "One writer for health",
    `Damage is an event. Has Authority is the gate. The server writes Health. Clients learn the new float from OnRep and play the hit there. They do not subtract again. A widget reads the float. Replicating the widget replicates fonts and layout.

The generated replicated-health function nests the assignment inside if (GetOwner() && GetOwner()->HasAuthority()). A sample that leaves Health = 90.f after an empty check is the broken shape: every client would keep a private copy, and the copies snap when the server value arrives. 90 is a stand-in. A real hit clamps against max.

The weapon calls Any Damage. It does not assign Health itself. Inventory does not. Save stores the float after the authority has written it. A client press is a request, not the write.`,
    ["Name the check that wraps the write, and the notify that must not subtract again.", ["HasAuthority", "OnRep"]],
    [
      ["auth-1", "Where does the generated health assignment sit?", ["Inside if (GetOwner() && GetOwner()->HasAuthority())", "After an empty check", "Inside Tick", "Inside the widget"], 0, "The server writes.", "What wraps the write?"],
      ["auth-2", "What should OnRep do?", ["Play the feedback", "Subtract again", "Call AddToSlot", "Trace"], 0, "The float is already new.", "What is OnRep for?"],
      ["auth-3", "What replicates?", ["The float", "The health widget", "The blood actor", "The mapping context"], 0, "One number.", "What crosses the network?"],
      ["auth-4", "True or false: the owning client may subtract Health so the bar moves early.", YN, 1, "The server float snaps the prediction.", "May the client write health?"],
    ],
    ["Which write is broken?", "Which assignment can run on every machine?", "The right-hand write is unguarded.", "right", ["Authority", "if (GetOwner() && GetOwner()->HasAuthority()) { Health = Clamped; }"], ["Client", "Health = Health - Amount;"]]),
]);

const tpsBeginner = course("tps-beginner", "TPS, beginner", "A short third-person course: the shoulder aim, speed from the stick, a companion that does not loot, and a save that skips the camera.", "beginner", "tps", [
  mod("aim", "The shoulder button",
    `The third-person aim graph is the camera, not the interact preset. IA_Aim starts the trace. A hit sets Aiming. The spring arm reads that bool and eases the boom. It does not write Speed, and it does not call Interact. Those are other graphs with other actions.

The trace still starts at the camera. A chest trace grabs the cover the crosshair can see past. Tick that sets Aiming holds the aim after the button comes up. The button's release is what clears the bool.

The companion does not own IA_Aim. If it did, it would steal the player's shoulder. The companion keeps a patrol timer. Save may store Aiming if the stance should survive a load. It does not store the boom transform. The arm rebuilds the transform from the bool when the pawn is possessed.`,
    ["Name the action that starts the aim, and the bool the excerpt sets.", ["IA_Aim", "Aiming"]],
    [
      ["aim-1", "Which graph is the third-person aim?", ["The camera graph", "The interact preset", "The save graph", "The patrol"], 0, "Aim is the camera.", "Which graph aims?"],
      ["aim-2", "What does a hit assign?", ["Aiming = true", "Speed = 600", "StackCount", "Health"], 0, "The bool is the stance.", "What does the trace write?"],
      ["aim-3", "What should the spring arm avoid writing?", ["Speed", "Nothing", "Aiming", "The button"], 0, "IA_Move owns Speed.", "What does the arm not write?"],
      ["aim-4", "True or false: this lesson uses the interact preset.", YN, 1, "The graph id is camera.", "Is aim the interact graph?"],
    ],
    ["Which aim is broken?", "Which version aims without the button?", "The right-hand version is Tick.", "right", ["Button", "void Graph_IA_Aim() { Aiming = true; }"], ["Tick", "void Tick() { Aiming = true; }"]]),
  mod("gait", "Speed from the stick",
    `IA_Move writes Speed. Greater Than compares the axis with zero. The true path writes 600. The false path writes 200. Those literals can become a data row. The character movement component reads Speed. The graph does not add a world offset on Tick.

The spring arm does not choose walk versus sprint. It reads the pawn the movement graph already drove. GASP, when the project adds it, reads the same number. A trace inside the anim blueprint rediscovers a gait the axis already wrote.

The camera sets Aiming. It does not assign Speed, or aiming would also be a sprint. The companion does not write the player's Speed. A Tick that assigns 600 stomps a stance an ability had just set.`,
    ["Name the comparison and one of the two speed literals.", ["IA_Move", "600"]],
    [
      ["gait-1", "What writes Speed?", ["IA_Move", "The spring arm", "IA_Aim", "Tick"], 0, "The axis is the gait.", "Which action writes Speed?"],
      ["gait-2", "What are the sample speeds?", ["600 and 200", "0 and 1", "Aiming", "The boom length"], 0, "Sprint and walk.", "Which literals?"],
      ["gait-3", "What should motion matching read?", ["Speed", "A new line trace", "The mapping context", "Health"], 0, "The number is already there.", "What is the gait?"],
      ["gait-4", "True or false: the spring arm should choose walk versus sprint.", YN, 1, "The arm reads the pawn.", "Does the camera pick the gait?"],
    ],
    ["Which gait is broken?", "Which version writes Speed every frame?", "The right-hand version is Tick.", "right", ["Axis", "if (IA_Move > 0.f) Speed = 600.f; else Speed = 200.f;"], ["Tick", "void Tick() { Speed = 600.f; }"]]),
  mod("companion", "The companion does not loot",
    `The companion is a patrol. Begin Play starts one timer. AdvancePatrol steps the route. FlipFlop swaps direction. The B path has to exist, or the companion never walks back. The player's IA_Interact is not the companion's event. If the companion runs it, the companion steals doors.

Overlap that fills the player's stack is also the player's. A squadmate that runs that overlap loots the ground. The companion reads Alert or a simple target later. It does not write StackCount, Magazine, or Health.

Stacking a new timer inside AdvancePatrol speeds the route. Begin Play already started one. Tick that flips GoingRight steps the companion while the game is paused. Save can store the direction. It does not store the mesh transform. The route rebuilds the mesh from the direction.`,
    ["Name the timer function, and the player action the companion must not run.", ["AdvancePatrol", "IA_Interact"]],
    [
      ["comp-1", "What steps the companion?", ["AdvancePatrol on a timer", "The player's IA_Interact", "Overlap", "IA_Aim"], 0, "The route is a timer.", "What steps the route?"],
      ["comp-2", "What is wrong with an empty B path?", ["The companion never returns", "The aim breaks", "Health replicates", "Nothing"], 0, "FlipFlop needs both sides.", "What does the return owe?"],
      ["comp-3", "What must the companion not run?", ["The player's overlap", "Its own timer", "Begin Play", "The direction store"], 0, "It would loot.", "What loot path is forbidden?"],
      ["comp-4", "True or false: the companion should use the player's IA_Interact.", YN, 1, "It would steal doors.", "Should the companion press interact?"],
    ],
    ["Which companion is broken?", "Which version loots for the player?", "The right-hand version runs the player's overlap.", "right", ["Patrol", "SetTimer(AdvancePatrol, 1.f, true);"], ["Loot", "void OnOverlap() { AddToSlot(); }"]]),
  mod("slot", "Save the counts",
    `Begin Play loads, because the components exist. The struct holds Health, Magazine, Reserve, StackCount, and Aiming if the stance matters. It does not hold the boom transform, the companion mesh, or the mapping context. Those rebuild.

Tick stores a half-finished reload and a companion mid-corner. An event after the reload finishes is the pack. Load reads the struct. It does not call IA_Reload or IA_Aim again, or the gun clicks and the camera punches on every continue.

Two slot indexes, autosave and manual, share the struct. They do not share a Tick. The camera pose, if a mode needs it, is a vector. The spring arm is not the vector. The arm rebuilds that pose when the pawn is possessed, and a packed boom would fight the rebuild on the next frame.`,
    ["Name two values that stay out of the slot: the boom, and the companion mesh.", ["boom", "mesh"]],
    [
      ["slot-1", "When does a third-person load run?", ["Begin Play", "Tick", "IA_Aim", "Overlap"], 0, "The pawn exists.", "When is the struct read?"],
      ["slot-2", "What is worth packing?", ["Magazine and Health", "The boom transform", "The mapping context", "The mesh"], 0, "The numbers, not the derived pose.", "What goes in the slot?"],
      ["slot-3", "What must load avoid calling?", ["IA_Reload again", "The struct read", "Begin Play", "Nothing"], 0, "Do not replay the action.", "What would a replay do?"],
      ["slot-4", "True or false: Tick is a safe autosave because it never misses a round.", YN, 1, "It stores a half-finished reload.", "Is Tick a safe pack?"],
    ],
    ["Which save is broken?", "Which version writes the slot every frame?", "The right-hand version is Tick.", "right", ["Event", "void BeginPlay() { Load(Slot); }"], ["Tick", "void Tick() { SlotValue = Magazine; }"]]),
]);

const tpsIntermediate = course("tps-intermediate", "TPS, intermediate", "A short third-person course for the project rules: a second mapping context, a limb floor, interest versus the camera, and a throttle that is not a sprint.", "intermediate", "tps", [
  mod("layer", "The modifier layer",
    `Enhanced Input resolves the device before the graph runs. The base context holds move, look, aim, and interact. Project JOHNO pushes a second context, the L2 modifier layer, while the left trigger is held. A face button that reloads on the base layer can open a radial slot on the modifier layer. The radial menu sends IA_Equip and a slot value. It does not line-trace to discover the stick. The stick is an axis. The sector is math on that axis.

The layer adds actions. It does not remove IA_Move, or the pawn stops walking while the player holds the trigger. GASP reads Speed. It does not care which context was active. The shoulder camera still belongs to IA_Aim on the base layer.

Possession is when the contexts are added. The trace does not add them. A Tick that polls the trigger and rebinds keys fights the mapping context the engine already pushed.`,
    ["Name the layer the left trigger pushes, and the action a radial menu sends.", ["modifier", "IA_Equip"]],
    [
      ["layer-1", "What is the L2 modifier layer?", ["A mapping context pushed while the trigger is held", "A Tick of the trigger", "A line trace", "The save slot"], 0, "Enhanced Input pushes it.", "What does the trigger push?"],
      ["layer-2", "What does the radial menu send?", ["IA_Equip from the stick axis", "A hit result", "OnRep", "Throttle"], 0, "The sector is math.", "What does the wheel send?"],
      ["layer-3", "What must the layer not remove?", ["IA_Move", "The trigger", "Nothing", "The camera"], 0, "The pawn has to keep walking.", "What stays on the base context?"],
      ["layer-4", "Why does the aim graph survive a rebind from a key to a pad?", ["The graph starts at the action", "Tick rebinds it", "OnRep retargets keys", "The trace reads the context"], 0, "The context resolves the device.", "Why does the graph stay valid?"],
      ["layer-5", "True or false: holding L2 should remove IA_Move.", YN, 1, "The layer adds actions. Move stays.", "Does L2 delete move?"],
    ],
    ["Which input poll is broken?", "Which version reads the trigger every frame?", "The right-hand version is Tick.", "right", ["Context", "AddMappingContext(L2Layer);"], ["Poll", "void Tick() { if (Trigger) Rebind(); }"]]),
  mod("limb", "The ten percent floor",
    `A limb is a replicated float with a floor. Any Damage starts the write. Has Authority gates it. The clamp refuses to drop a normal hit below 10 percent of that limb's max. A limb that maxes at 80 floors at 8. The sample literal 90 is a stand-in for the clamped result.

OnRep plays the limp. It does not subtract again. A medkit that writes the limb on the owning client snaps when the server float arrives. Prediction is allowed for the flinch. It is not allowed for the number.

The aim graph does not assign Health. The vehicle does not. Single-player can omit OnRep only while there is no other machine. A listen server is still another machine for the remote client. The gate stays.`,
    ["For a limb max of 80, what is the floor, and which notify must not subtract?", ["8", "OnRep"]],
    [
      ["limb-1", "A limb maxes at 80. What floor was skipped if a bruise empties it?", ["8", "0", "90", "10"], 0, "Ten percent of 80.", "What is 10% of 80?"],
      ["limb-2", "Where does the generated assignment sit?", ["Inside if (GetOwner() && GetOwner()->HasAuthority())", "After an empty check", "Inside IA_Aim", "Inside OnRep"], 0, "The server writes.", "What wraps the limb write?"],
      ["limb-3", "What may a client predict?", ["The flinch", "The limb number", "EquippedId", "Supplies"], 0, "The reaction is local.", "What can be early?"],
      ["limb-4", "What replaces the literal 90?", ["The clamped result", "Another literal", "Aiming", "Throttle"], 0, "90 is a stand-in.", "What replaces 90?"],
      ["limb-5", "True or false: the owning client should write the limb so the body reacts early.", YN, 1, "The server float snaps that write.", "May the client write the limb?"],
    ],
    ["Which notify is broken?", "Which OnRep writes the number again?", "The right-hand notify subtracts.", "right", ["Notify", "void OnRep_Health() { PlayLimp(); }"], ["Double", "void OnRep_Health() { Health -= Amount; }"]]),
  mod("interest", "The camera is not interest",
    `Relevant answers whether a client receives the actor. CheckAOI runs every 0.5 seconds and assigns Relevant from a trace, inside HasAuthority. Visible, on a strategy map, is a different bool. A third-person pawn can be relevant and still hide its shoulder camera, because the camera is local.

A client that sets Relevant pulls actors the server culled. Debris leaves interest. The pawn stays while it is near someone. The shoulder camera, the selection decal, and the wheel transforms do not replicate with the pawn.

Neither bool belongs in the save. After load, place the pawn and let the timer run. Saving Relevant so pop-in matches freezes a culling decision that the next trace would have changed. A truck can use a larger radius than a soldier because it can be heard farther, and that radius is a row, not a literal in the timer.`,
    ["Name the bool CheckAOI assigns, and the period.", ["Relevant", "0.5"]],
    [
      ["int-1", "What does CheckAOI assign, and how often?", ["Relevant every 0.5 seconds", "Aiming every frame", "Speed", "Throttle"], 0, "Interest is the 0.5s pass.", "What does the AOI timer write?"],
      ["int-2", "What stays local on a third-person pawn?", ["The shoulder camera", "The pawn, while relevant", "The limb float", "EquippedId"], 0, "The camera is the player's.", "What does not replicate?"],
      ["int-3", "Who may write Relevant?", ["The authority", "Every client", "The widget", "IA_Aim"], 0, "Culling is a server decision.", "Who writes interest?"],
      ["int-4", "Are these bools saved?", ["No. The timer recomputes them.", "Yes", "Only the camera", "Only on a truck"], 0, "Positions are enough.", "Do you save interest?"],
      ["int-5", "True or false: Relevant should be saved so pop-in matches.", YN, 1, "The timer recomputes it.", "Do you pack Relevant?"],
    ],
    ["Which relevance test is broken?", "Which version writes interest from Tick?", "The right-hand version is Tick.", "right", ["Timer", "SetTimer(CheckAOI, 0.5f, true);"], ["Tick", "void Tick() { Relevant = true; }"]]),
  mod("throttle", "A car is not a sprint",
    `IA_Throttle is a different action on a different component. Copying the on-foot Speed of 600 into Throttle launches the car at a sprint number. The shoulder camera disables while the player is seated. It does not keep feeding IA_Aim into the seat, and it does not write Throttle.

Wheels are a simulation. Their transforms rebuild from Throttle and fuel. Replicating each wheel transform is the expensive reading of a number the client can integrate. Fuel, if driving costs anything, is its own stock. It does not subtract Supplies unless the design said the car spends the team's stock.

Has Authority still wraps a replicated fuel write. OnRep updates the gauge. It does not spend again. Save packs fuel and the equipped seat id. It does not pack wheel transforms.`,
    ["Name the action that drives, and the on-foot number it must not copy.", ["IA_Throttle", "600"]],
    [
      ["thr-1", "What should the vehicle graph read?", ["IA_Throttle", "Speed 600", "IA_Aim", "IA_Move"], 0, "Throttle is its own axis.", "Which action drives?"],
      ["thr-2", "What happens to the shoulder camera when the player sits down?", ["It disables", "It writes Throttle", "It keeps aiming the car", "It replicates"], 0, "Driving has its own camera.", "What does the boom do when seated?"],
      ["thr-3", "What should not replicate?", ["Each wheel transform", "Fuel, if it is shared", "The pawn, while relevant", "The seat id"], 0, "Wheels are local.", "What stays simulated?"],
      ["thr-4", "What does OnRep of fuel do?", ["Move the gauge", "Spend again", "Set Aiming", "Trace"], 0, "The server already spent.", "What is the fuel notify?"],
      ["thr-5", "True or false: Throttle should copy Speed 600.", YN, 1, "A sprint number is not a throttle.", "Should the car reuse on-foot speed?"],
    ],
    ["Which drive is broken?", "Which version copies the sprint into the car?", "The right-hand version copies Speed.", "right", ["Throttle", "void Graph_IA_Throttle() { Throttle = Axis; }"], ["Sprint", "void Tick() { Throttle = Speed; }"]]),
]);

const horrorBeginner = course("horror-beginner", "Horror, beginner", "A short horror course: Sense on a timer, a use trace that is not the hunter, a door curve, and sight that is not a hit.", "beginner", "horror", [
  mod("sense", "A glimpse, not a frame",
    `Begin Play starts one timer. Sense runs every 0.2 seconds. The trace uses the visibility channel, so a closed door blocks it. A hit assigns Alert = 1 in the sample. A miss owes a decay, or the hunter stays sure forever. A dropped bottle calls the same Sense event. It does not grow a second brain.

Tick that traces sees flicks the design wanted to forgive, and it spends a query on every hunter every frame. The player's IA_Interact is a different trace, from the camera, and it must not write Alert. Looking at a fuse is a use, not an announcement.

Audio is instant because the sound calls Sense, not because the timer got faster. Health does not sense. Save stores Alert so a load does not forget that the hunter was already sure.`,
    ["Name the timer interval and the value a hit assigns.", ["0.2", "Alert"]],
    [
      ["sense-1", "How often does Sense run?", ["Every 0.2 seconds", "Every frame", "Once", "On IA_Interact"], 0, "The timer is the glimpse.", "What is the Sense period?"],
      ["sense-2", "What blocks the trace?", ["A wall on the visibility channel", "Any audio volume", "The save slot", "The player's bag"], 0, "Line of sight stops at a door.", "What blocks sight?"],
      ["sense-3", "What does a loud sound call?", ["Sense", "A second AI", "IA_Interact", "Tick"], 0, "Audio and sight share the event.", "What does a bottle call?"],
      ["sense-4", "True or false: a dropped bottle should have its own brain, separate from Sense.", YN, 1, "Audio calls Sense.", "Does a bottle need a second AI?"],
    ],
    ["Which sense is broken?", "Which schedule traces every frame?", "The right-hand version is Tick.", "right", ["Timer", "SetTimer(Sense, 0.2f, true);"], ["Tick", "void Tick() { LineTrace(); Alert = 1.f; }"]]),
  mod("use", "Use is not the hunter",
    `IA_Interact traces from the camera. A hit calls Interact through ProcessEvent. A fuse, a hide lever, and a door handle share that name. The hunter does not run this graph. If it does, the hunter turns valves and the player's look writes Alert.

The miss logs and stops. It does not raise Alert and it does not yaw a door. The door graph plays the curve after Interact tells it to. This graph does not own a timeline, or every usable actor would need a hinge.

A cast list grows with every new prop. The interface does not. One trace per press is enough. A hover prompt can read the last hit. It still must not write Alert. The door timeline starts after the interface returns. This graph's job ended at the call.`,
    ["Name the function the use excerpt looks up, and the hunter value it must not write.", ["Interact", "Alert"]],
    [
      ["use-1", "What do a fuse, a lever, and a door share?", ["Interact", "Sense", "Alert", "Tick"], 0, "One contract.", "What is the shared call?"],
      ["use-2", "Where does the player's trace start?", ["The camera", "The actor location", "The hunter", "The save slot"], 0, "The crosshair is the aim.", "Where is the origin?"],
      ["use-3", "What must this graph not assign?", ["Alert", "The interface call", "The miss log", "Nothing"], 0, "Alert belongs to Sense.", "What value stays out?"],
      ["use-4", "True or false: the hunter should run IA_Interact to open doors.", YN, 1, "The hunter uses Sense. The player uses Interact.", "Should the hunter press interact?"],
    ],
    ["Which use is broken?", "Which version writes the hunter's certainty?", "The right-hand version assigns Alert.", "right", ["Use", "ProcessEvent(Target, Interact);"], ["Sense", "void Graph_IA_Interact() { Alert = 1.f; }"]]),
  mod("door", "A curve has an end",
    `A door builds a timeline, keys a curve from 0 to 1, and calls PlayFromStart. FlipFlop writes IsOpen. The first use opens. The next closes. Tick that yaws the hinge never fires Finished, so the creak has no end and the hunter never gets a clean audio cue.

The creak calls Sense. It does not subtract Health. A trap on the threshold calls Any Damage on the health graph. The door graph moves the mesh. It does not own the float.

IsOpen is the state. The hinge transform is local. In co-op later, the bool replicates and the curve plays on each machine. Load sets the curve to the end. It does not call PlayFromStart, or the creak wakes the hunter in a saved house.`,
    ["Name the call that starts a swing, and the bool it writes.", ["PlayFromStart", "IsOpen"]],
    [
      ["door-1", "What plays the swing?", ["PlayFromStart on a timeline", "Tick", "Sense", "Any Damage"], 0, "The curve has a finished event.", "What swings a door?"],
      ["door-2", "What does the creak call?", ["Sense", "Any Damage", "AddToSlot", "Tick"], 0, "The hinge is an audio cue.", "What does a creak alert?"],
      ["door-3", "How does a load restore an open door?", ["Set the curve to the end", "PlayFromStart", "Tick the hinge", "Set Alert to 1"], 0, "Do not replay the creak.", "How is IsOpen applied?"],
      ["door-4", "True or false: the mesh transform should replicate every frame.", YN, 1, "IsOpen is the state. The curve is local.", "Does the hinge replicate?"],
    ],
    ["Which door motion is broken?", "Which version never finishes?", "The right-hand version is Tick.", "right", ["Timeline", "Timeline->PlayFromStart();"], ["Tick", "void Tick() { Yaw += 1.f; }"]]),
  mod("sight", "Sight is not a bite",
    `A confirmed sight sets Alert. It does not subtract Health. An attack calls Any Damage, and that graph clamps. Sense that subtracts on every glimpse kills the player for being seen, and it skips the clamp that makes zero reachable.

This beginner lesson is single player, so OnRep can be absent. The moment a second machine exists, the health write grows a gate. The door, the patrol, and the save do not subtract.

A missed trace owes a decay. Leaving Alert at 1 forever means one glimpse is a permanent chase. The decay is a subtract on the miss inside Sense, not a Tick that drains health. Save stores Alert and IsOpen. It does not store the hinge. Death is a branch on zero after the clamp, still on the machine that owns the float.`,
    ["Name the event that subtracts Health, and the value Sense writes instead.", ["Any Damage", "Alert"]],
    [
      ["sight-1", "When does damage run?", ["When an attack calls Any Damage", "On every confirmed sight", "On the creak", "On load"], 0, "Sight is not a hit.", "What subtracts health?"],
      ["sight-2", "Why can this lesson omit OnRep?", ["There is no other machine", "Clamp deleted it", "Doors cannot replicate", "Alert replaced health"], 0, "Co-op puts the gate back.", "When is OnRep optional?"],
      ["sight-3", "What does a miss owe?", ["A decay of Alert", "A health subtract", "A new timer at 0.01", "A cast"], 0, "Otherwise a sight lasts forever.", "What does the miss path owe?"],
      ["sight-4", "True or false: Sense should subtract Health when the hunter sees the player.", YN, 1, "An attack calls Any Damage.", "Does sight deal damage?"],
    ],
    ["Which sight is broken?", "Which version bites because the hunter looked?", "The right-hand version subtracts on sight.", "right", ["Alert", "if (bHit) Alert = 1.f;"], ["Bite", "if (bHit) Health -= Damage;"]]),
]);

const horrorIntermediate = course("horror-intermediate", "Horror, intermediate", "A short co-op horror course: one authority Sense, hide as Interact, fear on its own timer, and a save that does not replay the creak.", "intermediate", "horror", [
  mod("one-sense", "One pair of eyes",
    `Co-op still has one Sense. The authority traces. Alert replicates. Each client that runs its own trace makes the hunters disagree about a wall. A loud sound still calls that same event on the authority, not a second component on every machine.

The player's use trace stays local to the press and still must not write Alert. The period stays 0.2 seconds. Speeding it up because a client felt late is how the listen server falls over.

OnRep of Alert can play a sting. It does not trace again and it does not subtract Health. A missed trace still owes a decay, on the authority, so a forgiven glimpse falls on every machine together. A listen server is not an excuse to trace on every pawn. The remote client is another machine, and the host already looked.`,
    ["Who traces in co-op, and what replicates instead of the trace?", ["authority", "Alert"]],
    [
      ["one-1", "Who should run Sense in co-op?", ["The authority, once", "Every client", "The door", "The fear widget"], 0, "One trace. Alert can replicate.", "Who traces?"],
      ["one-2", "What does a hit assign?", ["Alert = 1", "Health = 90", "IsOpen", "GoingRight"], 0, "Certainty is the float.", "What does a hit write?"],
      ["one-3", "What should OnRep of Alert avoid?", ["Tracing again", "A local sting", "Reading the float", "Nothing"], 0, "The server already looked.", "What must the notify skip?"],
      ["one-4", "What does a miss still owe?", ["A decay", "Another client's trace", "A health subtract", "A creak"], 0, "A glimpse has to fall.", "What does the else path owe?"],
      ["one-5", "True or false: each co-op client should run its own Sense trace.", YN, 1, "The hunters would disagree.", "Does every client trace?"],
    ],
    ["Which sense is broken?", "Which version traces from Tick?", "The right-hand version is Tick.", "right", ["Timer", "SetTimer(Sense, 0.2f, true);"], ["Tick", "void Tick() { Alert = 1.f; }"]]),
  mod("hide", "Hide is a prop",
    `A hide lever implements Interact. It does not get its own event graph, and it does not get a Tick. The player's trace starts at the camera. A trace from the actor location grabs the frame beside the lever. ProcessEvent looks up Interact. The lever answers.

The hunter does not run this call. The hunter's overlap is not the player's pickup overlap. A hunter that loots the fuel is the companion bug in a darker room.

Fear does not live on the lever. The lever asks the spot to accept the player. Sense still owns Alert. A cast to the lever class excludes the fuse box that should have answered the same name. The miss still logs and stops. A hover prompt may read the last hit, and it still must not write Alert.`,
    ["Name the function a hide lever implements, and the trace origin.", ["Interact", "camera"]],
    [
      ["hide-1", "What should the lever implement?", ["Interact", "Sense", "ApplyEffect", "Any Damage"], 0, "Hide is a prop.", "What contract does hide use?"],
      ["hide-2", "Where does the use trace start?", ["The camera", "The actor location", "The hunter", "The save slot"], 0, "The crosshair can see past the frame.", "Where is the origin?"],
      ["hide-3", "What does the hunter not run?", ["The player's overlap", "Sense", "Its patrol timer", "Begin Play"], 0, "It would loot.", "What overlap stays with the player?"],
      ["hide-4", "Why not a cast to the lever?", ["The fuse would need its own copy", "Casts replicate", "Sense requires a cast", "Nothing"], 0, "The contract stays one call.", "What grows with casts?"],
      ["hide-5", "True or false: hide needs its own event graph.", YN, 1, "Hide implements Interact.", "Does hide get a new graph?"],
    ],
    ["Which hide is broken?", "Which version gives the lever a Tick?", "The right-hand version is Tick.", "right", ["Interface", "Execute_Interact(Lever);"], ["Tick", "void Tick() { Hide(); }"]]),
  mod("fear", "Fear is slower than sight",
    `Fear binds OnEffect and broadcasts it from ApplyEffect on a one second timer. Begin Play starts that timer once. Sense only writes Alert. Broadcasting inside Sense shakes the camera on every 0.2 second glimpse the design wanted to forgive. A door creak calls Sense. It does not broadcast OnEffect, or every cupboard terrifies the player.

A medkit clears fear by stopping the ApplyEffect timer. It does not Broadcast from an overlap. Stacking a new timer inside ApplyEffect speeds the pulse. AdvancePatrol has the same rule: Begin Play started one timer, and the event must not start another.

The B path of a patrol flip still has to exist in a horror stalk. An empty return means the hunter never walks back to the route after the fear falls.`,
    ["Name the dispatcher fear broadcasts, and the call that starts a door.", ["OnEffect", "PlayFromStart"]],
    [
      ["fear-1", "Where does OnEffect broadcast?", ["ApplyEffect, on its one second timer", "Inside Sense", "On the creak", "On overlap"], 0, "Fear is slower than sight.", "Where is the broadcast?"],
      ["fear-2", "What should a creak call?", ["Sense", "OnEffect", "Any Damage", "AddToSlot"], 0, "The hinge is audio.", "What does a creak call?"],
      ["fear-3", "How does a medkit clear fear?", ["Stop the ApplyEffect timer", "Broadcast from overlap", "Set Alert to 1", "Tick"], 0, "Stop the pulse.", "What does a medkit stop?"],
      ["fear-4", "What goes wrong if AdvancePatrol starts a timer every call?", ["The route speeds up", "The route stops", "Alert clears", "Nothing"], 0, "Begin Play already started one.", "What happens if you stack timers?"],
      ["fear-5", "True or false: the door creak should broadcast OnEffect.", YN, 1, "The creak calls Sense. Fear reads Alert.", "Does the hinge broadcast fear?"],
    ],
    ["Which fear is broken?", "Which version shakes on every frame?", "The right-hand version is Tick.", "right", ["Timer", "SetTimer(ApplyEffect, 1.f, true);"], ["Tick", "void Tick() { OnEffect.Broadcast(); }"]]),
  mod("quiet-save", "Do not replay the house",
    `A horror save packs Alert, IsOpen, GoingRight, and Health. It does not pack the hinge transform, the fear delegate bindings, or the Sense timer handle. Begin Play binds the delegates again and starts the timers after the bools are applied.

PlayFromStart on load replays the creak into Sense, and the hunter wakes in an empty room. Set the curve to the end. Apply doors and Alert before Sense starts, or the hunter learns a lie about a door that the slot says is closed.

Tick packs a door mid-curve and an Alert that is still decaying. An event when the timeline finishes, or when the player uses a save point, is the pack. Two clients in co-op load the server struct. A client file that spent health locally is a desync written down.`,
    ["Name the door call load must not make, and one value that stays out of the slot.", ["PlayFromStart", "binding"]],
    [
      ["quiet-1", "How does load restore an open door?", ["Set the curve to the end", "PlayFromStart", "Tick the hinge", "Broadcast OnEffect"], 0, "Do not replay the creak.", "How is IsOpen applied?"],
      ["quiet-2", "What stays out of the slot?", ["Delegate bindings", "Alert", "IsOpen", "Health"], 0, "Begin Play binds them again.", "What is not packed?"],
      ["quiet-3", "When do Sense timers start?", ["After the loaded doors and Alert are applied", "Before the struct is read", "On Tick", "On the creak"], 0, "Otherwise the hunter learns a lie.", "When does Sense resume?"],
      ["quiet-4", "Whose struct do two clients load?", ["The server's", "Each client's local damage", "The widget's", "The hinge's"], 0, "A local spend is a filed desync.", "Which struct loads?"],
      ["quiet-5", "True or false: a load should call PlayFromStart to restore an open door.", YN, 1, "That replays the creak.", "Does load replay the swing?"],
    ],
    ["Which save is broken?", "Which version writes Alert every frame?", "The right-hand version is Tick.", "right", ["Event", "void BeginPlay() { Load(Slot); }"], ["Tick", "void Tick() { SlotValue = Alert; }"]]),
]);

const strategyBeginner = course("strategy-beginner", "Strategy, beginner", "A short strategy course: a selected order, a cost that lives on a row, fog on a timer, and a medal that is not vision.", "beginner", "strategy", [
  mod("orders", "A click is not a search",
    `IA_Order is the right click. It does not move every unit. Selected is a bool on the unit, already true before the click. The graph branches on that bool and calls ReceiveOrder through one interface. A tank and a rifle squad answer the same name. A cast list grows every time a new chassis arrives.

The click does not reveal the destination. Fog is its own trace. An order behind fog still moves the unit on the server. The player may not see it yet. Tick that searches the level for a selected unit does the search the bool already finished.

Formation offsets are data on the formation id. The order graph does not write every offset. Save stores the order id and the formation id. It does not store each offset.`,
    ["Name the bool the order branches on, and the function a tank and a squad share.", ["Selected", "ReceiveOrder"]],
    [
      ["ord-1", "What does the order graph branch on?", ["Selected", "Visible", "Tick", "Score"], 0, "Selection already happened.", "What gates the click?"],
      ["ord-2", "What replaces a cast per chassis?", ["ReceiveOrder", "Reveal", "Spend", "AwardMedal"], 0, "One function.", "What does a click call?"],
      ["ord-3", "Does an order lift fog?", ["No. Reveal is a different trace.", "Yes", "Only for a tank", "Only on Tick"], 0, "Vision is not a click.", "Does the destination become visible?"],
      ["ord-4", "True or false: an order should reveal units behind fog.", YN, 1, "Fog is its own fact.", "Does an order grant sight?"],
    ],
    ["Which order is broken?", "Which version searches the level every frame?", "The right-hand version is Tick.", "right", ["Click", "if (Selected) ReceiveOrder();"], ["Tick", "void Tick() { FindSelected(); }"]]),
  mod("stock", "A row, not 25",
    `Spend is the build order. It is not Tick. Only the authority changes Supplies. The sample subtracts 25. A barracks and a turret do not cost the same, so 25 belongs on a data row named by the building. The graph reads the row and writes the stock.

Income is a slow timer that calls Spend with a negative cost, or a sibling event that adds. It does not drip on Tick. The board widget reads Supplies. Replicating the widget replicates the font.

Reveal does not spend. An order does not spend unless the order is a build. Save stores the stock after the authority writes it. A client that subtracts locally desyncs the match when the server value arrives. The icon on the board is a read. It is not a second stock.`,
    ["Name the check that wraps a stock write, and the sample literal that should become a row.", ["HasAuthority", "25"]],
    [
      ["stock-1", "Where should a building cost live?", ["A data row per building", "The literal 25", "Tick", "The fog timer"], 0, "A barracks and a turret differ.", "Where is the cost?"],
      ["stock-2", "Who may subtract Supplies?", ["The authority", "Every client", "The board widget", "Reveal"], 0, "One stock.", "Who writes supplies?"],
      ["stock-3", "How should income arrive?", ["A slow timer", "Tick", "Reveal", "A medal"], 0, "Income is an event.", "What schedules income?"],
      ["stock-4", "True or false: income should drip on Tick.", YN, 1, "A timer calls Spend.", "Does stock change every frame?"],
    ],
    ["Which spend is broken?", "Which version hard-codes a cost?", "The right-hand 25 is the literal.", "right", ["Data", "Supplies = Supplies - Row.Cost;"], ["Literal", "Supplies = Supplies - 25.f;"]]),
  mod("fog", "Four times a second",
    `Begin Play starts the vision timer. Reveal runs every 0.25 seconds. A clear trace sets Visible for that team. A wall blocks it. The bool is a team fact. It is not a spectator widget, and it is not Relevant. Interest decides whether the actor exists on a client. Vision decides whether the team may see the cell.

An order does not set Visible. A build does not. Clients do not write it. A client that sets Visible to preview the enemy base is the cheat.

Hidden units keep their orders on the server. Freezing them pops them at the last cell the fog remembered. The bool is not saved. After load, place the units and let Reveal run. A spectator camera does not get its own Visible. The team fact is enough.`,
    ["Name the bool Reveal writes, and the period.", ["Visible", "0.25"]],
    [
      ["fog-1", "How often does Reveal run?", ["Every 0.25 seconds", "Every frame", "Once", "On the click"], 0, "Four times a second.", "What is the vision period?"],
      ["fog-2", "What does a clear trace assign?", ["Visible", "Relevant", "Supplies", "Score"], 0, "Team sight is the bool.", "What does fog write?"],
      ["fog-3", "Who may write Visible?", ["The authority", "Every client", "The order click", "The widget"], 0, "Vision is a server pass.", "Who writes fog?"],
      ["fog-4", "True or false: an order should reveal the destination.", YN, 1, "Vision is the trace, not the click.", "Does a move lift fog?"],
    ],
    ["Which fog pass is broken?", "Which version writes Visible from Tick?", "The right-hand version is Tick.", "right", ["Timer", "SetTimer(Reveal, 0.25f, true);"], ["Tick", "void Tick() { Visible = true; }"]]),
  mod("medal", "A kill is not a cell",
    `AwardMedal is the server event for a kill or a capture. Score changes on the authority. The sample adds 10. A kill and a capture do not score the same, so 10 belongs on a medal row. The board reads Score. OnRep refreshes the board. It does not add 10 again.

Revealing a fog cell does not add points. Driving does not. A destruction calls AwardMedal from the destruction event, not from inside a movement assignment.

The patrol that guards a point uses a timer and a flip, the same shape as any route. Its B path has to store the return. An empty B path marches the camp off the map. Save stores Score. It does not store Visible, and it does not store every formation offset.`,
    ["Name the event that adds score, and the sample literal that should become a row.", ["AwardMedal", "10"]],
    [
      ["medal-1", "What adds score?", ["AwardMedal on the authority", "Reveal", "Tick", "The widget"], 0, "A medal is an event.", "What writes Score?"],
      ["medal-2", "What should OnRep do?", ["Refresh the board", "Add 10", "Set Visible", "Spend"], 0, "The server already scored.", "What does the notify do?"],
      ["medal-3", "Where does the value 10 belong?", ["A medal row", "The fog timer", "The order click", "The widget"], 0, "A kill and a capture differ.", "Where is the medal value?"],
      ["medal-4", "True or false: revealing a fog cell should add 10.", YN, 1, "Vision is not a medal.", "Does fog score?"],
    ],
    ["Which score is broken?", "Which version scores from Tick?", "The right-hand version is Tick.", "right", ["Event", "if (GetOwner() && GetOwner()->HasAuthority()) Score = Score + Row.Value;"], ["Tick", "void Tick() { Score += 10.f; }"]]),
]);

const strategyIntermediate = course("strategy-intermediate", "Strategy, intermediate", "A short strategy course: hidden units that still march, a barrage that does not lift fog, interest versus vision, and a save that skips the wheels.", "intermediate", "strategy", [
  mod("march", "Hidden is not frozen",
    `A unit can be invisible to the enemy and still relevant to the host. The server keeps its order. Skipping the order because Visible is false pops the unit at the last cell the fog remembered, then teleports it when a spotter arrives.

ReceiveOrder still branches on Selected. The formation id selects the offsets. The graph does not write every offset on Tick. A truck and a squad share the interface. The truck can have a larger interest radius because it can be heard farther. That radius is data.

Clients do not write the order. A client file that moved a hidden unit is discarded when the server struct loads. The widget that drew the last known cell is not the unit.`,
    ["Name the bool that must not cancel a server order, and the function the click calls.", ["Visible", "ReceiveOrder"]],
    [
      ["march-1", "Does a hidden unit skip its server order?", ["No. The server still marches it.", "Yes", "Only a truck", "Only when Relevant is false"], 0, "The client may not see it.", "Do hidden units freeze?"],
      ["march-2", "What does the order branch on?", ["Selected", "Visible", "Shells", "Score"], 0, "The click already chose a unit.", "What gates ReceiveOrder?"],
      ["march-3", "Where do formation offsets live?", ["On the formation id", "In the replicated widget", "On Tick", "In Visible"], 0, "The id selects the row.", "Where are the offsets?"],
      ["march-4", "Who writes the order?", ["The authority", "Each client", "The fog widget", "Throttle"], 0, "The server owns the route.", "Who marches the unit?"],
      ["march-5", "True or false: a hidden unit should skip its server order.", YN, 1, "The client may not see it. The server still marches it.", "Do hidden orders stop?"],
    ],
    ["Which march is broken?", "Which version writes offsets from Tick?", "The right-hand version is Tick.", "right", ["Click", "if (Selected) ReceiveOrder();"], ["Tick", "void Tick() { WriteOffsets(); }"]]),
  mod("barrage", "The gun is not the spotter",
    `FireMission spends a shell. It does not set Visible. A spotter's Reveal lifts fog. A blind barrage that marks the cell visible gives the shooter the spotter's eyes. Shells are their own stock. They do not subtract Supplies unless the design said ammo is the team's money.

The impact can call AwardMedal when it destroys a truck. That add does not live inside Throttle's assignment, and it does not live inside the shell subtract. OnRep of Score refreshes the board.

A move order does not subtract a shell. Confusing the two spends the battery on a right click. Authority wraps the shell write. A client that decrements Shells to feel the shot snaps back. Heat on a cannon, if the gun has it, is that weapon's float. It is not the rifle's Heat.`,
    ["Name the event that spends a shell, and the bool it must not write.", ["FireMission", "Visible"]],
    [
      ["bar-1", "What spends a shell?", ["FireMission", "Reveal", "IA_Order", "Throttle"], 0, "The mission is the spend.", "Which event spends?"],
      ["bar-2", "What lifts fog?", ["A spotter's Reveal", "The impact", "The shell subtract", "Throttle"], 0, "The gun is not the eyes.", "What sets Visible?"],
      ["bar-3", "Where does a destroyed truck add points?", ["AwardMedal on the destruction", "Inside Throttle", "Inside the shell subtract", "On Tick"], 0, "Scoring is its own event.", "What writes Score?"],
      ["bar-4", "Does a move order spend a shell?", ["No", "Yes", "Only the first move", "Only if Visible"], 0, "A move is not a shot.", "Does a right click spend ammo?"],
      ["bar-5", "True or false: a blind barrage should set Visible.", YN, 1, "A spotter's trace is Reveal.", "Does the gun lift fog?"],
    ],
    ["Which gun is broken?", "Which version spends shells from Tick and lifts fog?", "The right-hand version is Tick.", "right", ["Mission", "void FireMission() { Shells -= 1.f; }"], ["Tick", "void Tick() { Shells -= 1.f; Visible = true; }"]]),
  mod("cells", "Two bools",
    `Relevant and Visible answer different questions. CheckAOI assigns Relevant every 0.5 seconds from a trace, inside HasAuthority. Reveal assigns Visible every 0.25 seconds. Using one bool means culling the actor deletes it from a spotter's future vision.

A client that forces Relevant pulls cosmetics the server hid. A client that forces Visible sees the enemy base. Debris drops Relevant quickly. A hidden camp stays relevant to the host so its order still runs.

Neither bool is saved. After load, place the units and let both timers run. Wheel transforms and selection decals are not either bool. They are local. A selection decal is painted from Selected on the machine that is looking. It is not a third replicated bool, and it does not belong in either timer.`,
    ["Name the two bools in order: interest, then vision.", ["Relevant", "Visible"]],
    [
      ["cell-1", "What does CheckAOI assign?", ["Relevant on a 0.5 second timer", "Visible every frame", "Score", "Shells"], 0, "Interest is the slower pass.", "What does AOI write?"],
      ["cell-2", "Why must the bools stay separate?", ["Culling must not delete a unit a spotter might reveal", "They are aliases", "Visible is a float", "Relevant is the medal"], 0, "Simulation and team sight differ.", "Why two bools?"],
      ["cell-3", "What drops debris at the map edge?", ["Relevant", "Visible", "Selected", "Score"], 0, "Interest, not team vision.", "Which bool culls debris?"],
      ["cell-4", "Are the bools saved?", ["No. The timers recompute them.", "Yes", "Only Visible", "Only Relevant"], 0, "Positions are enough.", "Do you pack fog?"],
      ["cell-5", "True or false: Relevant and Visible should be the same bool.", YN, 1, "Culling would delete a unit a spotter might reveal.", "Are the bools aliases?"],
    ],
    ["Which interest test is broken?", "Which version copies vision into interest from Tick?", "The right-hand version is Tick.", "right", ["Timer", "SetTimer(CheckAOI, 0.5f, true);"], ["Tick", "void Tick() { Relevant = Visible; }"]]),
  mod("convoy", "Wheels stay local",
    `A strategy truck replicates fuel, or Supplies if that is the stock, and the order id. It does not replicate each wheel transform. The simulation rebuilds the wheels from Throttle and fuel. Driving does not drain Supplies unless the design said the convoy spends the team's stock. Fuel can be its own number.

Destroying the truck calls AwardMedal. That add is not inside the throttle assignment. The impact does not set Visible. A spotter does.

Save packs fuel, Shells, Supplies, Score, and the order id. It does not pack wheel transforms, Relevant, or Visible. Begin Play loads the server struct onto both clients. A client that spent fuel locally loads a desync. Tick packs a truck mid-bump. The gauge reads OnRep. It does not spend a second time when the number arrives.`,
    ["Name two values that stay out of the slot: wheel transforms, and team vision.", ["wheel", "Visible"]],
    [
      ["conv-1", "What should a truck replicate?", ["Fuel or the stock, and the order id", "Each wheel transform", "Visible as a widget", "The decal"], 0, "The numbers, not the pose.", "What crosses the network?"],
      ["conv-2", "Does driving subtract Supplies by default?", ["No. Fuel is its own stock if driving costs anything.", "Yes", "Only on Tick", "Only when Visible"], 0, "The stocks are different.", "Does the pedal spend the team's money?"],
      ["conv-3", "What does destruction call?", ["AwardMedal", "Throttle", "Reveal", "CheckAOI"], 0, "Scoring is its own event.", "What scores a wreck?"],
      ["conv-4", "Whose struct do both clients load?", ["The server's", "Each client's local spend", "The widget's", "The wheel pose"], 0, "A local spend is a desync.", "Which struct loads?"],
      ["conv-5", "True or false: each wheel transform should replicate.", YN, 1, "The simulation rebuilds them.", "Do wheels replicate?"],
    ],
    ["Which save is broken?", "Which version writes fuel every frame?", "The right-hand version is Tick.", "right", ["Event", "void BeginPlay() { Load(Slot); }"], ["Tick", "void Tick() { SlotValue = Fuel; }"]]),
]);

const pack = {
  format: "ue5-architect-pack",
  version: 1,
  courses: [fpsBeginner, tpsBeginner, tpsIntermediate, horrorBeginner, horrorIntermediate, strategyBeginner, strategyIntermediate],
};

for (const item of pack.courses) {
  if (item.modules.length < 3 || item.modules.length > 4) throw new Error(`${item.id} module count`);
}

if (short.length) {
  console.error(short.join("\n"));
  process.exit(1);
}
fs.writeFileSync(new URL("../packs/genre-courses.json", import.meta.url), `${JSON.stringify(pack, null, 2)}\n`);
console.log("wrote", pack.courses.map((item) => `${item.id}:${item.modules.length}`).join(" "));
