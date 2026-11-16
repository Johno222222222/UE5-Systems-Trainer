import fs from "fs";

function q(id, prompt, choices, answer, why, review) {
  return { id, prompt, choices, answer, why, review_prompt: review };
}

function diff(id, prompt, review, why, bug, left, right) {
  return {
    id,
    prompt,
    review_prompt: review,
    why,
    bug,
    left: { label: left[0], code: left[1] },
    right: { label: right[0], code: right[1] },
  };
}

const beginner = {
  id: "general-beginner",
  title: "Systems, beginner",
  summary: "A short cross-genre course: a look on a timer, one interface, authority on shared numbers, and data rows instead of literals. The same rules show up in a rifle, a third-person use, a horror Sense, and a strategy fog.",
  level: "beginner",
  glossary_tags: ["Core", "Networking", "Data"],
  pass_mark: 70,
  modules: [
    {
      id: "look",
      title: "Look on a timer",
      takeaway: `A look is a question you ask on purpose. A first-person rifle asks it when the player fires or aims, and the trace starts at the camera. A third-person use asks it from IA_Interact, still from the camera, because a chest trace hits the cover the crosshair can see past. A horror hunter asks it inside Sense, on a 0.2 second timer, and a loud sound calls that same event instead of growing a second brain. A strategy team asks it inside Reveal, four times a second, and writes Visible. None of those graphs ask the question from Tick. Tick keeps asking while the player stands still, while a match is paused, and while a hunter should have forgiven a glimpse.

The cost is a physics query. Doing it every frame, for every pawn, is how a listen server falls over. A timer or an input action spends the query when something might have changed. The result is a bool or a hit, and the next system reads that result. The horror stalk reads Alert. The strategy camp does not write Visible just because it walked. The rifle does not trace inside the animation blueprint to rediscover a gait the movement graph already wrote.

If you move any of these looks onto Tick, the behavior looks almost right and the budget does not. The repair is to put the query back on the event that owned it, and to let later systems read the value instead of asking again.`,
      assignment: { prompt: "Name the horror timer function and the strategy timer function that replace a Tick look.", accept: ["Sense", "Reveal"] },
      quiz: [
        q("look-1", "A horror hunter traces every frame. What schedule does the Sense graph actually use?", ["A looping timer at 0.2 seconds", "Tick", "Begin Play once", "The player's interact"], 0, "Sense is a glimpse, not a frame.", "How often does Sense run?"),
        q("look-2", "Strategy fog updates on Tick and the server stalls. What period does Reveal use?", ["0.25 seconds", "Every frame", "Once", "Only when the player orders"], 0, "Reveal is a vision pass.", "What timer does fog use?"),
        q("look-3", "A third-person use trace starts at the chest and grabs cover. Where should it start?", ["The camera", "The feet", "The save slot", "The squadmate"], 0, "The crosshair is the aim.", "Where does a third-person use trace begin?"),
        q("look-4", "True or false: a dropped bottle should have its own perception brain, separate from Sense.", ["False", "True"], 1, "Audio calls Sense.", "Does a bottle need a second AI?"),
        q("look-5", "The anim blueprint traces to decide walk versus sprint. What should it read?", ["Speed, already written by IA_Move", "A new hit result", "Visible", "Alert"], 0, "The gait is a number.", "What number is the gait?"),
      ],
      diff: diff("look-diff", "Which look is the broken one?", "Which schedule keeps querying while nothing changed?", "The right-hand version is Tick.", "right", ["Timer", "SetTimer(Sense, 0.2f, true);"], ["Tick", "void Tick() { LineTrace(); }"]),
    },
    {
      id: "interface",
      title: "One interface",
      takeaway: `A cast list is a dependency that grows every time someone adds a prop. A first-person door, a rifle on the ground, and a switch can all answer Interact. A horror fuse, a hide lever, and a creaking door answer the same name. A strategy tank and a rifle squad answer ReceiveOrder. A pickup of fuel and a pickup of a key answer AddToSlot. The graph looks the function up once. ProcessEvent, or an Execute_ call when the project has a real interface class, is that lookup.

The cast version names ADoor, then APickup, then AFuse. The next prop does not compile until someone edits the graph. The interface version does not know the class. It knows the contract. That is also why the third-person companion must not run the player's IA_Interact: the companion would become another caller of a contract that belongs to the player, and it would steal doors.

Overlap is a different contract from the use trace. The trace highlights. AddToSlot counts. Mixing them fills a bag because the player looked at it. The repair is to keep each call on the event that means that call, and to stop adding casts when a new actor should answer the old question.`,
      assignment: { prompt: "Name the function a strategy unit and a vehicle should share for a click, and the function a key and a fuel can should share.", accept: ["ReceiveOrder", "AddToSlot"] },
      quiz: [
        q("if-1", "A fuse, a door, and a hide lever each have a cast. What should they implement?", ["Interact", "Sense", "AwardMedal", "Tick"], 0, "One name covers the props.", "What do those props share?"),
        q("if-2", "A tank and a squad each have a cast in the order graph. What replaces the casts?", ["ReceiveOrder", "Spend", "Reveal", "Throttle"], 0, "The click is one function.", "What does a click call?"),
        q("if-3", "Looking at a key increments StackCount. Which call should count, and which event should only highlight?", ["AddToSlot on overlap. The trace highlights.", "The trace counts. Overlap highlights.", "Sense counts.", "Tick counts."], 0, "Overlap owns the stack.", "Who increments a stack?"),
        q("if-4", "True or false: the third-person companion should call the player's Interact.", ["False", "True"], 1, "It would steal doors.", "Should the companion use the player's interact?"),
        q("if-5", "What grows when every new prop gets a cast?", ["The cast list in the graph", "The interface", "Nothing", "The timer interval"], 0, "The contract stays one call.", "What grows with casts?"),
      ],
      diff: diff("if-diff", "Which call is the broken one?", "Which version names classes instead of a contract?", "The right-hand version is the cast chain.", "right", ["Interface", "Execute_Interact(Target);"], ["Casts", "Cast<ADoor>(Target);\nCast<APickup>(Target);"]),
    },
    {
      id: "authority",
      title: "Who writes the number",
      takeaway: `Shared numbers have one writer. Health in a replicated kit, a limb floored at 10% of its max, Supplies, Score, Shells, EquippedId, and Relevant are all that kind of number. The sample graphs often emit HasAuthority as an empty block and then assign the float on the next line. Read that shape as a bug: the assignment has to sit inside the check, or every client writes a private copy and the copies snap back when the server value arrives.

OnRep is the notify. It plays a limp, refreshes a board, or rebuilds a third-person mesh. It does not subtract the damage again and it does not add the medal again. A horror lesson that is truly single player can clamp locally and skip OnRep, and the course should say so. The moment a second machine exists, the gate comes back.

Widgets are not the number. A coin icon, a health bar, and a selection decal read the float. Replicating the widget replicates fonts and layout. Clients may punch a prediction. They may not adopt their prediction as the float. A strategy client that sets Visible to see the enemy base is the same bug with a bool.`,
      assignment: { prompt: "Name the check that must wrap a replicated write, and the notify that must not write again.", accept: ["HasAuthority", "OnRep"] },
      quiz: [
        q("au-1", "Health = 90.f sits outside an empty HasAuthority block. What is the repair?", ["Nest the write inside the check", "Delete the check", "Subtract again in OnRep", "Write it from Tick"], 0, "The empty block does not guard the next line.", "Where does the health write belong?"),
        q("au-2", "OnRep_Health subtracts Amount a second time. What should it do?", ["Play the feedback and leave the float", "Subtract again", "Call Spend", "Set Visible"], 0, "The server already wrote it.", "What is OnRep for?"),
        q("au-3", "Each strategy client subtracts 25 from Supplies. Who may subtract?", ["The authority", "Every client", "The board widget", "Reveal"], 0, "One stock.", "Who owns Supplies?"),
        q("au-4", "A single-player horror clamp has no OnRep. Why is that acceptable there?", ["There is no other machine", "Clamp deletes replication", "Doors cannot replicate", "Alert replaces health"], 0, "Co-op puts the gate back.", "When can OnRep be absent?"),
        q("au-5", "True or false: a client may set Visible to preview fog.", ["False", "True"], 1, "That is the cheat.", "May a client write fog?"),
      ],
      diff: diff("au-diff", "Which write is the broken one?", "Which health assignment can run on every machine?", "The right-hand write is unguarded.", "right", ["Authority", "if (HasAuthority()) { Health = Clamped; }"], ["Client", "Health = Health - Amount;"]),
    },
    {
      id: "data",
      title: "Data rows, not literals",
      takeaway: `A literal in a graph is a designer number pretending to be code. The sample reload clamps against MagSize, which is the right shape, while the sample building spends 25 and the sample medal adds 10. Those two literals should be rows. A barracks and a turret do not cost the same. A kill and a capture do not score the same. A horror key stacks to one and a fuel can stacks higher, and that cap sits on the item asset beside the name.

The gunsmith makes the same point with ten slots. The graph writes EquippedId. The asset says which socket each slot uses and how much heat one shot of that barrel adds. Replicating ten meshes to carry those facts is the expensive reading of a row the client already has. GASP reads Speed. It does not store a pose in the save, because the pose is the database plus the number.

Formation offsets are data too. Saving every offset bloats the slot. Saving the formation id lets the members read the row again after load. The repair, whenever a graph contains a magic number a second actor would not share, is to name the row and keep the graph as the event that reads it.`,
      assignment: { prompt: "Name the two sample literals that should become data rows: the building cost and the medal value.", accept: ["25", "10"] },
      quiz: [
        q("data-1", "Every strategy building spends 25. Where should the cost live?", ["A data row per building", "The same literal", "Tick", "The fog timer"], 0, "A barracks and a turret differ.", "Where does a building cost belong?"),
        q("data-2", "Every medal adds 10. What should own the value?", ["A medal row", "The board widget", "Throttle", "Visible"], 0, "A kill and a capture differ.", "Where does a medal value belong?"),
        q("data-3", "A key and a fuel can share one stack cap in the graph. What is wrong?", ["The cap belongs on each item asset", "They should share it", "AddToSlot cannot read data", "Overlap forbids assets"], 0, "One and thirty are different items.", "Where is a stack cap?"),
        q("data-4", "Ten gunsmith meshes replicate. What should replicate instead?", ["EquippedId, and the asset holds the slots", "Each socket transform", "The pose", "The mapping context"], 0, "The row is already on the client.", "What does the gunsmith replicate?"),
        q("data-5", "True or false: a save should store every formation offset.", ["False", "True"], 1, "Store the formation id.", "Do offsets belong in the slot?"),
      ],
      diff: diff("data-diff", "Which cost is the broken one?", "Which spend hard-codes a number a second building would not share?", "The right-hand 25 is the literal.", "right", ["Data", "Supplies = Supplies - Row.Cost;"], ["Literal", "Supplies = Supplies - 25.f;"]),
    },
  ],
};

const intermediate = {
  id: "general-intermediate",
  title: "Systems, intermediate",
  summary: "A short cross-genre course for the Project JOHNO rules: replication and OnRep, area of interest versus fog, an L2 mapping layer, effects versus Tick, and save structs that do not replay derived work.",
  level: "intermediate",
  glossary_tags: ["Core", "Networking", "Data"],
  pass_mark: 70,
  modules: [
    {
      id: "onrep",
      title: "Replication and OnRep",
      takeaway: `Replication ships the number. OnRep is the local reaction. A limb write nested inside HasAuthority becomes Health, or LeftArm, on the server, clamped so a normal hit cannot pass 10% of max. OnRep plays the limp on every proxy that has the pawn. A second subtract in the notify bites twice. A medal's OnRep refreshes the board and does not add 10 again. EquippedId's OnRep rebuilds a third-person mesh from the asset and does not invent a new id.

Prediction is allowed for the reaction and not for the number. An early flinch, a widget punch, a local muzzle flash from IA_Fire: those are fine. An early Health, an early Score, an early EquippedId: those snap. The sample excerpts that assign Health = 90.f or EquippedId = IA_Equip after an empty authority block are showing you the defect. The repair is the nesting, plus a computed value instead of a literal where the design has a formula.

Single-player horror can stay on the local clamp. Co-op horror cannot. A listen server is not an excuse to skip the gate, because the remote client is still another writer unless you check.`,
      assignment: { prompt: "For a limb max of 80, what is the 10% floor, and which function must not subtract again?", accept: ["8", "OnRep"] },
      quiz: [
        q("or-1", "A limb maxes at 80. A bruise empties it. What floor was skipped?", ["8", "0", "90", "10"], 0, "Ten percent of 80.", "What is 10% of 80?"),
        q("or-2", "OnRep_Score adds 10. What should the notify do?", ["Refresh the board", "Add 10", "Call Spend", "Set Relevant"], 0, "The server already scored.", "What does a score notify do?"),
        q("or-3", "EquippedId is assigned outside an empty HasAuthority block and proxies pop. What is the repair?", ["Nest the assignment inside the check", "Replicate ten meshes", "Write the id in the anim blueprint", "Save the pose"], 0, "The server id is what proxies build.", "Where does EquippedId belong?"),
        q("or-4", "Which of these may be predicted?", ["The flinch", "The limb number", "Score", "Supplies"], 0, "The reaction is local. The float is not.", "What can a client predict?"),
        q("or-5", "True or false: a listen server can skip HasAuthority.", ["False", "True"], 1, "The remote client is still another machine.", "Does a listen server skip the gate?"),
        q("or-6", "The sample assigns Health = 90.f. What should replace 90 for a limb?", ["The clamped result", "Another literal", "Alert", "Throttle"], 0, "90 is a stand-in.", "What replaces the literal 90?"),
        q("or-7", "A medkit writes the limb on the owning client. What snaps?", ["The server float", "The mapping context", "The pose database", "The door curve"], 0, "Healing is a server write.", "What snaps after a client heal?"),
        q("or-8", "Why does single-player horror omit OnRep?", ["There is no other machine", "Clamp forbids notifies", "Sense replaces health", "Doors cannot replicate"], 0, "Co-op puts it back.", "When is OnRep optional?"),
      ],
      diff: diff("or-diff", "Which notify is the broken one?", "Which OnRep writes the number again?", "The right-hand notify subtracts.", "right", ["Notify", "void OnRep_Health() { PlayLimp(); }"], ["Double", "void OnRep_Health() { Health -= Amount; }"]),
    },
    {
      id: "interest",
      title: "Interest versus vision",
      takeaway: `Relevant and Visible answer different questions. Relevant is whether a client receives the actor at all. The sample CheckAOI timer runs every 0.5 seconds and assigns Relevant from a trace, standing in for the replication graph. Visible is whether a strategy team may see the cell. Reveal runs every 0.25 seconds. A unit can be simulated on the server, relevant to the host, and invisible to the enemy. Using one bool for both means culling the actor deletes it from a spotter's future vision.

Clients do not write either bool. A client that forces Relevant pulls cosmetics the server culled. A client that forces Visible sees the enemy base. Widgets, shoulder cameras, selection decals, and wheel transforms are not the replicated object. The actor is, while it is relevant. A truck can use a larger radius than a soldier because it can be heard farther. That radius is data.

Debris leaves interest quickly. Hidden strategy camps keep patrolling on the server so they do not pop at the point where fog last hid them. Neither bool belongs in the save. After load you place units, then let the timers run.`,
      assignment: { prompt: "Name the two bools and the two timer periods: interest, then vision.", accept: ["Relevant", "Visible"] },
      quiz: [
        q("in-1", "What does CheckAOI assign, and how often?", ["Relevant = bHit every 0.5 seconds", "Visible = true every frame", "Score + 10", "Throttle"], 0, "Interest is the 0.5s pass.", "What does the AOI timer write?"),
        q("in-2", "What does Reveal assign, and how often?", ["Visible = true every 0.25 seconds", "Relevant every frame", "Shells - 1", "Alert = 1 on Tick"], 0, "Vision is the 0.25s pass.", "What does fog write?"),
        q("in-3", "Why must the bools stay separate?", ["Culling must not delete a unit a spotter might reveal", "They are aliases", "Visible is a float", "Relevant is the medal"], 0, "Simulation and team sight differ.", "Why two bools?"),
        q("in-4", "A client sets Relevant and actors pop in. What was empty?", ["The HasAuthority block", "The timer", "The asset", "The save"], 0, "Nest the write.", "What failed to guard relevance?"),
        q("in-5", "True or false: a hidden camp should freeze.", ["False", "True"], 1, "The server keeps the route.", "Do hidden camps freeze?"),
        q("in-6", "What should not replicate on a third-person pawn?", ["The shoulder camera", "The pawn, while relevant", "EquippedId", "The limb float"], 0, "The camera is local.", "What stays local on a pawn?"),
        q("in-7", "Debris at the map edge keeps replicating. Which bool drops it?", ["Relevant", "Visible", "Selected", "Score"], 0, "Interest, not team vision.", "Which bool culls debris?"),
        q("in-8", "Are these bools saved?", ["No. The timers recompute them from positions.", "Yes", "Only Visible", "Only on a truck"], 0, "Positions are enough.", "Do you save fog and interest?"),
      ],
      diff: diff("in-diff", "Which relevance test is the broken one?", "Which version writes interest from Tick?", "The right-hand version is Tick.", "right", ["Timer", "SetTimer(CheckAOI, 0.5f, true);"], ["Tick", "void Tick() { Relevant = true; }"]),
    },
    {
      id: "input-layer",
      title: "A second mapping context",
      takeaway: `Enhanced Input resolves a device to an action before the graph runs. The base context holds move, look, fire, and interact. Project JOHNO pushes a second context, the L2 modifier layer, while the left trigger is held. A face button that reloads on the base layer can open a radial slot on the modifier layer. The radial menu sends IA_Equip and a slot value. It does not line-trace to discover the stick. The stick is an axis, and the sector is math on that axis.

The graph stays valid when the binding moves from a key to a pad, because the graph starts at the action. IA_Interact still traces. IA_Aim still sets Aiming. IA_Move still chooses Speed = 600.f or Speed = 200.f. The modifier layer adds actions. It does not remove move, or the pawn stops walking while the player holds the trigger. GASP reads Speed. It does not trace to rediscover the gait, and it does not care which context was active.

A vehicle throttle is a different action on a different component. Copying the on-foot Speed into Throttle launches the car at a sprint number. The shoulder camera disables while seated instead of feeding IA_Aim into the seat.`,
      assignment: { prompt: "Name the layer the left trigger pushes, and the action a radial menu should send.", accept: ["modifier", "IA_Equip"] },
      quiz: [
        q("il-1", "What is the L2 modifier layer?", ["A mapping context pushed while the left trigger is held", "A Tick of the trigger", "A line trace", "The save slot"], 0, "Enhanced Input pushes it.", "What does the left trigger push?"),
        q("il-2", "The radial menu traces every frame. What should it send?", ["IA_Equip from the stick axis", "A hit result", "OnRep", "Reveal"], 0, "The sector is math.", "What does the radial menu send?"),
        q("il-3", "Holding L2 removes IA_Move. What breaks?", ["The pawn stops walking", "The trace gets faster", "EquippedId clears", "Nothing"], 0, "The layer adds actions.", "What must L2 not remove?"),
        q("il-4", "The binding moves from a key to a pad and the interact graph is unchanged. Why?", ["The graph starts at the action", "Tick rebinds keys", "OnRep retargets devices", "The trace reads the context"], 0, "The context resolves the device.", "Why does the graph survive a rebind?"),
        q("il-5", "GASP traces to see if the player is sprinting. What should it read?", ["Speed", "A new hit", "The L2 context", "Throttle"], 0, "The axis already wrote the gait.", "What does motion matching read?"),
        q("il-6", "True or false: Throttle should copy Speed 600.", ["False", "True"], 1, "A sprint number is not a throttle.", "Should the car reuse on-foot speed?"),
        q("il-7", "What happens to the shoulder camera when the player sits in a vehicle?", ["It disables", "It keeps IA_Aim", "It writes Throttle", "It replicates"], 0, "Driving has its own camera.", "What does the shoulder camera do when seated?"),
        q("il-8", "Where is the mapping context added?", ["When the pawn is possessed", "Inside the line trace", "On overlap", "In the save struct"], 0, "Possession owns the bindings.", "When is the context added?"),
      ],
      diff: diff("il-diff", "Which input poll is the broken one?", "Which version reads the trigger every frame?", "The right-hand version is Tick.", "right", ["Context", "AddMappingContext(L2Layer);"], ["Poll", "void Tick() { if (Trigger) Rebind(); }"]),
    },
    {
      id: "effects",
      title: "Effects, doors, and fear",
      takeaway: `A timeline, a dispatcher, and a timer are how work finishes. A horror door builds a UTimelineComponent, keys a curve at 0 and 1, and calls PlayFromStart. FlipFlop writes IsOpen. Tick yaw never fires Finished, so the creak has no end. The creak calls Sense. It does not broadcast the fear dispatcher, or every cupboard terrifies the player. IsOpen replicates. The hinge transform does not. A load sets the curve to the end instead of calling PlayFromStart, or the creak wakes the hunter in a saved house.

Fear binds OnEffect and broadcasts it from ApplyEffect on a one second timer. Sense only writes Alert. Broadcasting inside Sense shakes the camera on every 0.2 second glimpse the design wanted to forgive. A medkit clears fear by stopping the timer. It does not Broadcast from an overlap.

Patrols use the same idea. AdvancePatrol on a timer steps a camp or a stalk. Starting another timer inside the event stacks them. The B path of the sample flip is empty, so the return direction is still owed. None of this is Tick.`,
      assignment: { prompt: "Name the door call that starts a swing, and the dispatcher fear broadcasts.", accept: ["PlayFromStart", "OnEffect"] },
      quiz: [
        q("ef-1", "A door yaws on Tick and never finishes. What should play the swing?", ["PlayFromStart on a timeline", "Sense", "Tick", "Spend"], 0, "The curve has a finished event.", "What swings a door?"),
        q("ef-2", "Loading an open door calls PlayFromStart and the hunter wakes. What should load do?", ["Set the curve to the end", "Replay the swing", "Set Alert to 1", "Tick the hinge"], 0, "Do not replay the creak.", "How does a load restore IsOpen?"),
        q("ef-3", "Every creak broadcasts OnEffect. What should the creak call?", ["Sense", "OnEffect", "Any Damage", "AwardMedal"], 0, "Fear reads Alert. It does not hear the hinge.", "What does a creak call?"),
        q("ef-4", "Fear shakes on every 0.2s glimpse. Where was the broadcast?", ["Inside Sense, instead of ApplyEffect", "On the 1 second timer, correctly", "On the save", "On overlap"], 0, "Fear is slower than sight.", "Where should OnEffect broadcast?"),
        q("ef-5", "True or false: the hinge transform should replicate.", ["False", "True"], 1, "IsOpen replicates. The curve is local.", "Does the hinge replicate?"),
        q("ef-6", "AdvancePatrol starts a new timer every call. What goes wrong?", ["The route speeds up", "The route stops", "Alert clears", "Nothing"], 0, "Begin Play already started one.", "What happens if you stack patrol timers?"),
        q("ef-7", "The sample flip's B path is empty. What is missing?", ["The return direction", "A medal", "A shell", "A mapping context"], 0, "Both directions belong on the flip.", "What does the B path owe?"),
        q("ef-8", "A medkit clears fear by broadcasting from overlap. What should it stop?", ["The ApplyEffect timer", "Sense", "The door curve", "IA_Move"], 0, "Stop the pulse.", "How does a medkit clear fear?"),
      ],
      diff: diff("ef-diff", "Which door motion is the broken one?", "Which version never fires Finished?", "The right-hand version is Tick.", "right", ["Timeline", "Timeline->PlayFromStart();"], ["Tick", "void Tick() { Yaw += 1.f; }"]),
    },
    {
      id: "saves",
      title: "Structs that do not replay",
      takeaway: `A save packs the numbers the authority already wrote and the ids that select project data. Health or the limb floats, Heat, Magazine, Reserve, StackCount, EquippedId, Supplies, Score, Shells, fuel, Alert, IsOpen, GoingRight, and the current order id are that kind of field. The GASP pose, the boom transform, the wheel transforms, Visible, Relevant, formation offsets, gunsmith meshes, and delegate bindings are not. They are derived, or they are recomputed, or they already live in a data asset.

Begin Play loads, because the components exist. It must not call Spend, AwardMedal, or FireMission, and it must not call PlayFromStart to restore a door. Those events apply the session a second time or replay a creak into Sense. Tick stores a half-finished reload, a mid-curve door, a half-decayed Alert, and a truck mid-bump.

Order the apply. Doors and Alert before Sense starts, or the hunter learns a lie. Aiming before the boom extends. Fuel before the vehicle simulates. EquippedId before the mesh builds. Units placed before Reveal and CheckAOI. Two clients load the server struct. A client file that spent locally is the desync, written down.`,
      assignment: { prompt: "Name two values that must not be packed: team vision, and the animation pose.", accept: ["Visible", "pose"] },
      quiz: [
        q("sv-1", "Which of these is packed?", ["EquippedId", "The GASP pose", "Visible", "The boom transform"], 0, "The id selects the asset.", "What belongs in the slot?"),
        q("sv-2", "Begin Play calls AwardMedal on load and the board jumps. What should it do?", ["Read the stored Score", "Award it again", "Add 10", "Call Spend"], 0, "The total is already the result.", "What does load do with Score?"),
        q("sv-3", "A loaded horror house plays the creak. How was IsOpen applied?", ["Through PlayFromStart", "By setting the curve to the end", "By saving the mesh", "By Tick"], 0, "The replay calls Sense.", "Why did the creak replay?"),
        q("sv-4", "Sense starts before loaded doors apply. What does the hunter gain?", ["A false line of sight", "The saved Alert, correctly", "Nothing", "The key count"], 0, "Timers wait for the house.", "When do Sense timers start?"),
        q("sv-5", "True or false: Relevant should be saved so pop-in matches.", ["False", "True"], 1, "The timer recomputes it.", "Do you save Relevant?"),
        q("sv-6", "Fuel is applied after the truck simulates and it lurches. When should it apply?", ["Before simulation", "After the first bump", "Inside Reveal", "Inside OnRep"], 0, "The number exists first.", "When is fuel applied?"),
        q("sv-7", "Whose struct do two clients load?", ["The server's", "Each client's local spend", "The widget's", "The fog bit's"], 0, "A local spend is a filed desync.", "Which struct loads?"),
        q("sv-8", "Tick packed a magazine mid-reload. What should write the slot?", ["An event when the reload finishes, loaded at Begin Play", "Tick", "IA_Aim", "The pose database"], 0, "Store a finished state.", "When is a reload safe to pack?"),
      ],
      diff: diff("sv-diff", "Which save is the broken one?", "Which version writes the slot every frame?", "The right-hand version is Tick.", "right", ["Event", "BeginPlay() { Load(Slot); }"], ["Tick", "void Tick() { SlotValue = Health; }"]),
    },
  ],
};

const pack = { format: "ue5-architect-pack", version: 1, courses: [beginner, intermediate] };
fs.writeFileSync(new URL("../packs/general-courses.json", import.meta.url), JSON.stringify(pack, null, 2) + "\n");
console.log("wrote courses", beginner.modules.length, intermediate.modules.length);
