"use strict";

// Stage 4 bundled library. Exploring it does not call a model.
// Doc URLs below were checked against live Epic documentation titles.
// Do not add a URL that is not in DOC.

const { TEMPLATES } = require("./logic");
const { attachStarters } = require("./templateLearning");
const { assertLearningAnchors } = require("./learning");
const { ensurePractice } = require("./practice");

const START_HERE_ID = "start-here";

const INTRO = {
  is: "This is a UE5 architecture and learning tool.",
  isnt: "It is not a full game generator. Review the code before you ship it.",
};

function doc(title, url) {
  return { title, url };
}

const DOC = {
  actorTicking: doc("Actor Ticking", "https://dev.epicgames.com/documentation/en-us/unreal-engine/actor-ticking-in-unreal-engine"),
  gameplayTimers: doc("Gameplay Timers", "https://dev.epicgames.com/documentation/en-us/unreal-engine/gameplay-timers-in-unreal-engine"),
  remoteProcedureCalls: doc("Remote Procedure Calls", "https://dev.epicgames.com/documentation/en-us/unreal-engine/remote-procedure-calls-in-unreal-engine"),
  networkingOverview: doc("Networking Overview", "https://dev.epicgames.com/documentation/en-us/unreal-engine/networking-overview-for-unreal-engine"),
  interfaces: doc("Interfaces", "https://dev.epicgames.com/documentation/en-us/unreal-engine/interfaces-in-unreal-engine"),
  actorCommunication: doc("Actor Communication", "https://dev.epicgames.com/documentation/en-us/unreal-engine/actor-communication-in-unreal-engine"),
  dataAssets: doc("Data Assets", "https://dev.epicgames.com/documentation/en-us/unreal-engine/data-assets-in-unreal-engine"),
  dataDriven: doc("Data Driven Gameplay Elements", "https://dev.epicgames.com/documentation/en-us/unreal-engine/data-driven-gameplay-elements-in-unreal-engine"),
  replicateProperties: doc("Replicate Actor Properties", "https://dev.epicgames.com/documentation/en-us/unreal-engine/replicate-actor-properties-in-unreal-engine"),
  multicastDelegates: doc("Multicast Delegates", "https://dev.epicgames.com/documentation/en-us/unreal-engine/multicast-delegates-in-unreal-engine"),
  eventDispatchers: doc("Event Dispatchers", "https://dev.epicgames.com/documentation/en-us/unreal-engine/event-dispatchers-in-unreal-engine"),
  components: doc("Components", "https://dev.epicgames.com/documentation/en-us/unreal-engine/components-in-unreal-engine"),
  actors: doc("Actors", "https://dev.epicgames.com/documentation/en-us/unreal-engine/actors-in-unreal-engine"),
  gameplayTags: doc("Using Gameplay Tags", "https://dev.epicgames.com/documentation/en-us/unreal-engine/using-gameplay-tags-in-unreal-engine"),
  traces: doc("Traces", "https://dev.epicgames.com/documentation/en-us/unreal-engine/traces-in-unreal-engine---overview"),
  behaviorTrees: doc("Behavior Trees", "https://dev.epicgames.com/documentation/en-us/unreal-engine/behavior-trees-in-unreal-engine"),
  aiPerception: doc("AI Perception", "https://dev.epicgames.com/documentation/en-us/unreal-engine/ai-perception-in-unreal-engine"),
  animationNotifies: doc("Animation Notifies", "https://dev.epicgames.com/documentation/en-us/unreal-engine/animation-notifies-in-unreal-engine"),
  vehicles: doc("Vehicles", "https://dev.epicgames.com/documentation/en-us/unreal-engine/vehicles-in-unreal-engine"),
  saving: doc("Saving and Loading Your Game", "https://dev.epicgames.com/documentation/en-us/unreal-engine/saving-and-loading-your-game-in-unreal-engine"),
  gameplayAbilities: doc("Gameplay Ability System", "https://dev.epicgames.com/documentation/en-us/unreal-engine/gameplay-ability-system-for-unreal-engine"),
  usingAbilities: doc("Using Gameplay Abilities", "https://dev.epicgames.com/documentation/en-us/unreal-engine/using-gameplay-abilities-in-unreal-engine"),
};

const TEMPLATE_DOCS = {
  combat: [DOC.animationNotifies, DOC.actorTicking],
  inventory: [DOC.dataAssets, DOC.dataDriven],
  dialogue: [DOC.dataDriven, DOC.interfaces],
  ai_guard: [DOC.behaviorTrees, DOC.aiPerception],
  save: [DOC.saving, DOC.gameplayTimers],
  vehicle: [DOC.vehicles],
  gas: [DOC.gameplayAbilities, DOC.gameplayTags],
  interaction: [DOC.traces, DOC.interfaces],
};

function challenge(prompt, choices, answer, why) {
  return { prompt, choices, answer, why };
}

const CONCEPTS = [
  {
    id: "tick-vs-timers",
    title: "Tick vs timers",
    summary: "A timer runs when you ask. Tick runs every frame.",
    explanation: "Tick is for work that must follow the frame, such as matching a camera to a pawn. A look trace, an autosave, or a combo window does not need that. A timer fires on a period you choose, then sleeps. Leaving Tick on just in case keeps the component awake while the character stands still.",
    challenge: challenge(
      "A door prompt checks what the player is looking at. What should run that check?",
      ["A timer, about ten times a second.", "Tick, so it never misses a frame.", "The constructor, once."],
      0,
      "A frame-perfect trace feels thorough. The prompt still reads correctly at ten checks a second, and Tick spends a check on every idle frame.",
    ),
    example_ids: ["start-here", "save", "interaction"],
    learn_more: [DOC.actorTicking, DOC.gameplayTimers],
    aliases: ["timers", "animation-notifies", "hitstop", "queries"],
  },
  {
    id: "authority-and-rpcs",
    title: "Authority and server RPCs",
    summary: "The server decides what is true. A client asks with an RPC.",
    explanation: "On a listen server your machine is one client among others. HasAuthority is true only on the copy that owns the actor. Opening a door, spending an item, or starting a conversation has to run there. The client calls a Server RPC. The server checks the request, then runs the interface. Doing the work only on the client looks right on your screen and wrong on everyone else's.",
    challenge: challenge(
      "The player presses Interact on a replicated door. Where should the door actually open?",
      ["On the authority, after a server RPC.", "On the client that pressed the key.", "On every client, inside Tick."],
      0,
      "The local door moves immediately, so the client feels like the right place. The server never hears about it, and the door snaps shut.",
    ),
    example_ids: ["start-here"],
    learn_more: [DOC.remoteProcedureCalls, DOC.networkingOverview],
    aliases: [],
  },
  {
    id: "interface-vs-cast",
    title: "Interface vs Cast",
    summary: "An interface is a shared message. A cast is a guess at one class.",
    explanation: "Cast succeeds only when the object is that class or a child of it. A door, a pickup, and an NPC are not one class, so a chain of casts grows every time you add something usable. An interface says this actor can be interacted with, and nothing about the rest of the class. Call that one message. Cast the owner to a Pawn when you already know the component sits on a character. Do not cast the actor under the crosshair to every Blueprint you own.",
    challenge: challenge(
      "You add a new usable actor, a mounted gun. What should Call Interact do?",
      ["Call the same Interact interface the door uses.", "Add another Cast node for the gun.", "Subclass the door so the gun inherits Open."],
      0,
      "The cast node is already in the graph, so one more looks cheaper than an interface. The next actor needs yet another cast.",
    ),
    example_ids: ["start-here", "interaction", "dialogue"],
    learn_more: [DOC.interfaces, DOC.actorCommunication],
    aliases: ["interfaces"],
  },
  {
    id: "data-assets",
    title: "Data Assets",
    summary: "Put designer data on an asset. Keep the component small.",
    explanation: "A Data Asset is a content file for values: item stats, a list of abilities, a tuning row. The component points at the asset and reads it. Designers can change the asset without a new class. Hardcoding the numbers in the widget, or in a Blueprint constructor, makes a second copy that drifts. A Data Table is the row-shaped version when you have many similar records, such as dialogue lines.",
    challenge: challenge(
      "Where should a backpack's item stats live?",
      ["On a Data Asset the component reads.", "In the widget's click event.", "In a new subclass of the inventory component for each item."],
      0,
      "The click event is where you notice the bug, so the number ends up there. The next item then needs its own click.",
    ),
    example_ids: ["inventory", "dialogue"],
    learn_more: [DOC.dataAssets, DOC.dataDriven],
    aliases: ["ui-data", "data-tables", "inventory-rules", "designer-defaults", "save-games", "blackboards"],
  },
  {
    id: "replication-and-repnotify",
    title: "Replication and RepNotify",
    summary: "Replicate the fact that changed. Let OnRep play the reaction.",
    explanation: "A replicated property is copied from the authority to the other machines when it changes. RepNotify, written ReplicatedUsing, runs a function on the receiving side after the new value arrives. Use that for a cue: a confirmed interact id, a door state, a health value. Do not replicate the actor one player is looking at. That focus belongs to that player. Replicating it aims every client at one crosshair.",
    challenge: challenge(
      "Other players should see that an interact succeeded. What do you replicate?",
      ["A small id, with OnRep playing the cue.", "The focused actor pointer.", "The whole character, every frame, from Tick."],
      0,
      "Replicating the actor under the crosshair sounds like sharing the moment. It forces every client to share one player's gaze.",
    ),
    example_ids: ["start-here"],
    learn_more: [DOC.replicateProperties, DOC.networkingOverview],
    aliases: [],
  },
  {
    id: "delegates-and-events",
    title: "Delegates and events",
    summary: "Broadcast when something changed. Let the listener decide what to do.",
    explanation: "A dynamic multicast delegate is a list of functions. The component broadcasts On Focus Changed and does not know which widget is listening. The prompt binds, updates, and unbinds when it is removed. Reading the component from the widget's Tick keeps the UI awake and hides the moment focus actually changed. Unbind when the widget goes away, or a destroyed widget stays in the list.",
    challenge: challenge(
      "The prompt needs to know when the focused actor changes. What should it do?",
      ["Bind to On Focus Changed.", "Read the focused actor on Tick.", "Cast the component to the widget."],
      0,
      "Tick is a loop you already know, so the widget starts reading the pointer every frame, including when nothing changed.",
    ),
    example_ids: ["start-here", "save"],
    learn_more: [DOC.multicastDelegates, DOC.eventDispatchers],
    aliases: ["async-save", "perception", "focus"],
  },
  {
    id: "components-vs-inheritance",
    title: "Components vs inheritance",
    summary: "Add a component for a behaviour. Do not subclass the character for it.",
    explanation: "A component is a piece you can add to a pawn, an NPC, or a vehicle. Interaction, inventory, and a combo counter are components. Subclassing the character for each of those forks the movement code, and you cannot mix the behaviours without a pile of child classes. Put the data the behaviour owns on the component. The Anim Blueprint and the widget read it. They do not own it.",
    challenge: challenge(
      "Where should the focused actor be stored?",
      ["On the interaction component.", "On a new subclass of the character.", "On the prompt widget."],
      0,
      "The character class is already open, so a new variable there feels shortest. The next pawn that should interact then needs that same subclass.",
    ),
    example_ids: ["start-here", "combat"],
    learn_more: [DOC.components, DOC.actors],
    aliases: ["combo-state", "chaos-vehicles", "gears", "components"],
  },
  {
    id: "gameplay-tags",
    title: "Gameplay Tags",
    summary: "A tag is a name you can check. It is not a string you type twice.",
    explanation: "A Gameplay Tag is a hierarchical label, such as Ability.Fireball or Quest.SpokeToGuard. The ability system uses tags for costs, cooldowns, and cancellation, so two Blueprints agree on the name. A bool on the actor, or a raw string typed in two places, drifts. A tag is also the right shape for a quest flag that dialogue sets and the rest of the game reads.",
    challenge: challenge(
      "A fireball cannot be cast again until its cooldown ends. What should block it?",
      ["A cooldown gameplay tag.", "A bool on the character that the ability sets.", "A string compared on Tick."],
      0,
      "A bool is visible on the character and looks simple. The next ability needs its own bool, and prediction cannot see it.",
    ),
    example_ids: ["gas", "dialogue"],
    learn_more: [DOC.gameplayTags, DOC.usingAbilities],
    aliases: ["gas", "quest-state", "ai-states"],
  },
  {
    id: "line-traces",
    title: "Line traces",
    summary: "A trace asks the world what is on a line. Start it where the player is looking.",
    explanation: "A line trace takes a start, an end, and a channel, and returns the first blocking hit. For interaction, start at the camera, the pawn view location, and end at that point plus the view direction times the trace distance. A trace from the feet, or from the actor origin, hits the floor or something behind the player. The prompt and the crosshair then disagree. Visibility is the usual channel for what the player is looking at. The check does not need to run every frame.",
    challenge: challenge(
      "The crosshair is on a door, but the prompt says the floor. What is the usual cause?",
      ["The trace started at the feet or the actor origin.", "The Interact interface is missing.", "The door's tick is turned off."],
      0,
      "The floor is a real hit, so the trace looks like it worked. The start position is the part that lied.",
    ),
    example_ids: ["start-here", "interaction"],
    learn_more: [DOC.traces],
    aliases: ["line-traces"],
  },
];

function mustLine(text, needle) {
  const rows = String(text).split("\n");
  const index = rows.findIndex((row) => row.includes(needle));
  if (index < 0) throw new Error(`Start Here is missing "${needle}"`);
  return index + 1;
}

function chain(labels) {
  const types = ["event", "function", "function", "function"];
  const nodes = labels.map((label, i) => ({
    id: `n${i + 1}`,
    label,
    node_type: types[i] || "function",
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

function why(id, anchor, one, tradeoff, mistake, conceptId) {
  const card = CONCEPTS.find((item) => item.id === conceptId);
  if (!card) throw new Error(`unknown concept ${conceptId}`);
  return {
    id,
    anchor,
    one_line: one,
    tradeoff,
    common_mistake: mistake,
    concept_id: card.id,
    concept_title: card.title,
  };
}

function buildStartHere() {
  const header = `#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Net/UnrealNetwork.h"
#include "CharacterInteractComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnFocusChanged, AActor*, Focused);

UCLASS(ClassGroup=(Game), meta=(BlueprintSpawnableComponent))
class UCharacterInteractComponent : public UActorComponent
{
  GENERATED_BODY()
public:
  UCharacterInteractComponent();
  virtual void BeginPlay() override;

  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Interact")
  float TraceDistance = 250.f;

  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Interact")
  float TraceInterval = 0.1f;

  UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Interact")
  float HoldTime = 0.f;

  UPROPERTY(BlueprintAssignable, Category="Interact")
  FOnFocusChanged OnFocusChanged;

  UFUNCTION(BlueprintCallable, Category="Interact")
  void TryInteract();

  UFUNCTION(BlueprintPure, Category="Interact")
  float GetHoldTime() const;

  UFUNCTION(Server, Reliable)
  void ServerTryInteract();

protected:
  UPROPERTY(ReplicatedUsing=OnRep_LastInteractId)
  int32 LastInteractId = 0;

  UFUNCTION()
  void OnRep_LastInteractId();

  void TraceForFocus();

  virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

  FTimerHandle TraceTimer;
  TWeakObjectPtr<AActor> FocusedActor;
};`;

  const source = `#include "CharacterInteractComponent.h"
#include "Engine/World.h"
#include "Interactable.h"
#include "GameFramework/Pawn.h"
#include "Engine/HitResult.h"

UCharacterInteractComponent::UCharacterInteractComponent()
{
  SetIsReplicatedByDefault(true);
  PrimaryComponentTick.bCanEverTick = false;
}

void UCharacterInteractComponent::BeginPlay()
{
  Super::BeginPlay();
  const float Period = TraceInterval > 0.f ? TraceInterval : 0.1f;
  GetWorld()->GetTimerManager().SetTimer(TraceTimer, this, &UCharacterInteractComponent::TraceForFocus, Period, true);
}

void UCharacterInteractComponent::TraceForFocus()
{
  APawn* OwnerPawn = Cast<APawn>(GetOwner());
  if (!OwnerPawn) return;
  const FVector Start = OwnerPawn->GetPawnViewLocation();
  const FVector End = Start + OwnerPawn->GetControlRotation().Vector() * TraceDistance;
  FHitResult Hit;
  FCollisionQueryParams Params(SCENE_QUERY_STAT(CharacterInteract), false, OwnerPawn);
  const bool bHit = GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params);
  AActor* Next = nullptr;
  if (bHit && Hit.GetActor() && Hit.GetActor()->GetClass()->ImplementsInterface(UInteractable::StaticClass()))
  {
    Next = Hit.GetActor();
  }
  if (Next == FocusedActor.Get()) return;
  FocusedActor = Next;
  OnFocusChanged.Broadcast(Next);
}

float UCharacterInteractComponent::GetHoldTime() const
{
  return HoldTime;
}

void UCharacterInteractComponent::TryInteract()
{
  if (!FocusedActor.IsValid() || !GetOwner()) return;
  if (GetOwner()->HasAuthority())
  {
    ServerTryInteract_Implementation();
  }
  else
  {
    ServerTryInteract();
  }
}

void UCharacterInteractComponent::ServerTryInteract_Implementation()
{
  AActor* Target = FocusedActor.Get();
  if (!Target || !GetOwner() || !GetOwner()->HasAuthority()) return;
  IInteractable::Execute_Interact(Target, GetOwner());
  LastInteractId++;
}

void UCharacterInteractComponent::OnRep_LastInteractId()
{
  if (LastInteractId > 0)
  {
    OnFocusChanged.Broadcast(FocusedActor.Get());
  }
}

void UCharacterInteractComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
  Super::GetLifetimeReplicatedProps(OutLifetimeProps);
  DOREPLIFETIME(UCharacterInteractComponent, LastInteractId);
}`;

  const distanceHeader = mustLine(header, "float TraceDistance");
  const intervalHeader = mustLine(header, "float TraceInterval");
  const holdHeader = mustLine(header, "float HoldTime");
  const repHeader = mustLine(header, "ReplicatedUsing=OnRep_LastInteractId");
  const periodLine = mustLine(source, "TraceInterval");
  const timerLine = mustLine(source, "SetTimer");
  const distanceSource = mustLine(source, "TraceDistance");
  const holdSource = mustLine(source, "return HoldTime");
  const authorityLine = mustLine(source, "HasAuthority()");
  const interactLine = mustLine(source, "Execute_Interact");

  const graph = chain(["Timer Trace", "Focus Actor", "Show Prompt", "Call Interact"]);
  const system = {
    id: "example-character-interaction",
    system_name: "Character Interaction",
    summary: "A component on the player character. A timer traces from the camera, one actor stays in focus, and Interact is an interface call that runs on the server.",
    tunable_parameters: [
      { key: "trace_distance", label: "Trace Distance", value: 250, min: 50, max: 800, step: 10, unit: "cm" },
      { key: "trace_interval", label: "Trace Interval", value: 0.1, min: 0.05, max: 0.5, step: 0.05, unit: "s" },
      { key: "hold_time", label: "Hold Time", value: 0, min: 0, max: 2, step: 0.1, unit: "s" },
    ],
    modules: [
      { name: "Prompt", included: true, description: "The widget binds to On Focus Changed. It does not trace, and it does not decide who can be used." },
      { name: "Outline", included: true, description: "The highlight sits on the focused actor and clears when focus moves on." },
      { name: "Interact", included: true, description: "Doors, pickups, and other characters implement one interface. The component does not cast to their classes." },
      { name: "Authority", included: true, description: "The interface runs on the authority. A client sends the server RPC instead of opening the door locally." },
    ],
    blueprint_pseudocode: `Event BeginPlay
  Set Timer (Trace For Focus, Trace Interval, looping)
WHY: A timer is enough for a look prompt. Tick would trace while the character stands still.

Function Trace For Focus
  Line trace from the camera by Trace Distance
  If the hit implements Interact, set Focus
  Broadcast On Focus Changed
WHY: One focused actor. The previous outline clears when focus changes.

Function Show Prompt
  Bind the widget to On Focus Changed
  Show the prompt only while Focus is set
WHY: The widget is a view. It does not decide who can be used.

Function Call Interact
  If the owner has no authority, Server Try Interact
  Else Interact (interface) on Focus
WHY: The interface runs on the server. A cast list does not survive the next pickup.`,
    cpp_header: header,
    cpp_source: source,
    setup_guide: [
      { step: 1, title: "Add the component to the character", detail: "Drop Character Interaction onto the player character. Do not parent a new character class for it.", why: "The character owns the trace. A door only implements the interface." },
      { step: 2, title: "Implement Interact on each usable actor", detail: "Doors, pickups, and NPCs implement the same interface. The component calls that one message.", why: "A new usable actor does not need a new cast in this graph." },
      { step: 3, title: "Bind the prompt to On Focus Changed", detail: "The widget shows while focus is set and hides when the broadcast says it cleared.", why: "The widget updates on the change. It does not poll on Tick." },
    ],
    node_graph_nodes: graph.nodes,
    node_graph_edges: graph.edges,
    network_notes: "Focus stays on your machine. Interact runs on the authority. LastInteractId replicates with OnRep so other clients can play the cue.",
    applied_changes: [],
    shared_attributes: [],
    learning: {
      challenges: [
        {
          title: "Trace on a timer",
          detail: "About ten looks a second is enough for a prompt. Tick traces even while the character stands still.",
          prompt: "When should this component look for an actor?",
          choices: [
            "On a timer, about ten times a second.",
            "On Tick, every frame.",
            "Only inside the character's constructor.",
          ],
          answer: 0,
          why_people_pick: "Tick feels more accurate, but a prompt does not need a trace on every frame.",
          reveal: { node_ids: ["n1"], lines: [{ file: ".cpp", line: timerLine }], why_id: "trace-timer" },
          related: { kind: "parameter", key: "trace_interval", label: "Trace Interval" },
        },
        {
          title: "Interface, not a cast",
          detail: "The focused actor implements Interact. The graph does not cast to each pickup class.",
          prompt: "How does Call Interact reach a door and a talking character?",
          choices: [
            "Both implement one Interact interface.",
            "The graph casts to every pickup Blueprint.",
            "The character subclasses the door.",
          ],
          answer: 0,
          why_people_pick: "A cast is the first node most people learn, so a chain of casts looks familiar.",
          reveal: { node_ids: ["n4"], lines: [{ file: ".cpp", line: interactLine }], why_id: "call-interface" },
          related: { kind: "module", name: "Interact" },
        },
        {
          title: "Who may change the world",
          detail: "A client asks. The authority runs the interface.",
          prompt: "A client looks at a door and presses Interact. What should run?",
          choices: [
            "A server RPC, then the interface on the authority.",
            "The interface immediately on the client.",
            "A Tick that replicates the door transform.",
          ],
          answer: 0,
          why_people_pick: "Running it locally feels instant, and the door opens on your screen even when the server never heard about it.",
          reveal: { node_ids: ["n4"], lines: [{ file: ".cpp", line: authorityLine }], why_id: "server-authority" },
          related: { kind: "module", name: "Authority" },
        },
      ],
      why_notes: [
        why("trace-timer", { kind: "node", node_id: "n1" },
          "The look trace is a timer, so it does not run on Tick.",
          "A timer can miss a one-frame flicker that Tick would catch. A prompt can live with that.",
          "Leaving the component ticked as well as the timer traces twice.",
          "tick-vs-timers"),
        why("focus-owner", { kind: "node", node_id: "n2" },
          "Focus lives on this component, not on a subclass of the character.",
          "Every pawn that should interact needs the component added.",
          "Subclassing the character for interaction forks the movement code.",
          "components-vs-inheritance"),
        why("prompt-event", { kind: "node", node_id: "n3" },
          "The prompt listens to On Focus Changed instead of polling the component.",
          "A widget that forgets to unbind stays in the list after it is removed.",
          "Reading Focus on Tick inside the widget keeps the UI awake.",
          "delegates-and-events"),
        why("call-interface", { kind: "node", node_id: "n4" },
          "Interact is an interface call, so a door and a character share one node.",
          "The interface cannot see a field that only one Blueprint has.",
          "A cast chain to each pickup class breaks on the next type you add.",
          "interface-vs-cast"),
        why("trace-reach", { kind: "cpp", file: ".h", line: distanceHeader },
          "Trace Distance is the look reach, in one designer property.",
          "One distance cannot prefer a nearby door over a far character.",
          "A second length hidden in the widget makes the prompt and the trace disagree.",
          "line-traces"),
        why("rep-cue", { kind: "cpp", file: ".h", line: repHeader },
          "Last Interact Id replicates with OnRep so clients play the cue once.",
          "The id is a signal, not the focused actor, so clients do not share a pointer.",
          "Replicating the focused actor aims every client at one player's crosshair.",
          "replication-and-repnotify"),
        why("timer-off-tick", { kind: "cpp", file: ".cpp", line: timerLine },
          "Begin Play starts the timer and leaves Tick off.",
          "You tune a period in seconds, not a cost paid every frame.",
          "Turning tick on here brings the per-frame trace back.",
          "tick-vs-timers"),
        why("server-authority", { kind: "cpp", file: ".cpp", line: authorityLine },
          "The interface runs on the authority. A client sends a server RPC.",
          "The client waits a round trip before the door moves.",
          "Calling the interface on the client opens a door the server never saw.",
          "authority-and-rpcs"),
      ],
      parameter_effects: [
        { key: "trace_distance", effect: "Sets how far the look trace reaches. A longer trace can focus an actor the crosshair is barely on." },
        { key: "trace_interval", effect: "Sets the pause between look traces. A shorter pause notices a fast turn sooner and traces more often." },
        { key: "hold_time", effect: "How long the prompt waits before it calls Interact. Zero means a tap is enough. The prompt reads this value. It does not tick." },
      ],
      prerequisites: ["Actor component", "Line trace", "Blueprint interface"],
      complexity: "beginner",
      related_concepts: [
        "tick-vs-timers",
        "interface-vs-cast",
        "line-traces",
        "delegates-and-events",
        "components-vs-inheritance",
        "authority-and-rpcs",
        "replication-and-repnotify",
      ].map((id) => {
        const card = CONCEPTS.find((item) => item.id === id);
        return { id: card.id, title: card.title };
      }),
      traps: [
        { title: "Tick overuse", detail: "The look trace is a timer. Tick would keep running while the character stands still." },
        { title: "Cast instead of Interface", detail: "Doors, pickups, and other characters share Interact. A cast chain misses the next one." },
        { title: "Replicating the look target", detail: "Focus stays on your machine. Replicating the focused actor would aim every client at one crosshair." },
      ],
      module_notes: [
        { name: "Prompt", note: "The widget binds to On Focus Changed. It does not trace, and it does not decide who can be used." },
        { name: "Outline", note: "The highlight sits on the focused actor and clears when focus moves on." },
        { name: "Interact", note: "Doors, pickups, and other characters implement one interface. The component does not cast to their classes." },
        { name: "Authority", note: "The interface runs on the authority. A client sends the server RPC instead of opening the door locally." },
      ],
      what_ifs: [
        {
          title: "Tick vs timer",
          variants: [
            {
              id: "timer",
              label: "Timer",
              code: "void BeginPlay()\n{\n  Super::BeginPlay();\n  GetWorld()->GetTimerManager().SetTimer(TraceTimer, this, &UCharacterInteractComponent::TraceForFocus, TraceInterval, true);\n  PrimaryComponentTick.bCanEverTick = false;\n}",
            },
            {
              id: "tick",
              label: "Tick",
              code: "void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)\n{\n  Super::TickComponent(DeltaTime, TickType, ThisTickFunction);\n  TraceForFocus(); // every frame, even while the character stands still\n}",
            },
          ],
        },
        {
          title: "Interface vs cast",
          variants: [
            {
              id: "interface",
              label: "Interface",
              code: "IInteractable::Execute_Interact(Target, GetOwner());",
            },
            {
              id: "cast",
              label: "Cast",
              code: "if (ABP_Door* Door = Cast<ABP_Door>(Target)) Door->Open();\nelse if (ABP_NPC* Npc = Cast<ABP_NPC>(Target)) Npc->Talk();",
            },
          ],
        },
      ],
      parameter_impacts: [
        { key: "trace_distance", lines: [{ file: ".h", line: distanceHeader }, { file: ".cpp", line: distanceSource }] },
        { key: "trace_interval", lines: [{ file: ".h", line: intervalHeader }, { file: ".cpp", line: periodLine }] },
        { key: "hold_time", lines: [{ file: ".h", line: holdHeader }, { file: ".cpp", line: holdSource }] },
      ],
    },
  };
  system.learning = ensurePractice(system.learning, system);
  assertLearningAnchors(system);
  return system;
}

const START_HERE = buildStartHere();

function startHereExample() {
  return {
    id: START_HERE_ID,
    title: "Character Interaction",
    tagline: "Start here. No API key.",
    kind: "example",
    icon: "hand",
    complexity: START_HERE.learning.complexity,
    prerequisites: START_HERE.learning.prerequisites.slice(),
    learn_more: [DOC.traces, DOC.interfaces, DOC.components, DOC.gameplayTimers, DOC.remoteProcedureCalls],
    prompt: "A character interaction component. A timer traces from the camera, one actor stays in focus, a prompt listens for that change, and Interact is an interface call that runs on the server.",
    default_class: "ActorComponent",
    starter: START_HERE,
  };
}

function templateExamples() {
  return attachStarters(TEMPLATES).map((template) => {
    const learning = template.starter?.learning || {};
    return {
      id: template.id,
      title: template.title,
      tagline: template.tagline,
      kind: "template",
      icon: template.icon,
      complexity: learning.complexity || "intermediate",
      prerequisites: Array.isArray(learning.prerequisites) ? learning.prerequisites : [],
      learn_more: TEMPLATE_DOCS[template.id] || [],
      prompt: template.prompt,
      default_class: template.default_class,
      starter: template.starter,
    };
  });
}

function catalog() {
  return structuredClone({
    intro: INTRO,
    concepts: CONCEPTS,
    examples: [startHereExample(), ...templateExamples()],
  });
}

function exampleById(id) {
  return catalog().examples.find((item) => item.id === id) || null;
}

function resolveConcept(id, concepts = CONCEPTS) {
  const key = String(id || "").trim();
  if (!key) return null;
  return concepts.find((card) => card.id === key || (Array.isArray(card.aliases) && card.aliases.includes(key))) || null;
}

function keyDecisions(system) {
  const notes = system?.learning?.why_notes;
  if (!Array.isArray(notes)) return [];
  return notes
    .map((note) => ({
      id: note?.id || "",
      decision: String(note?.one_line || ""),
      tradeoff: String(note?.tradeoff || ""),
      concept_id: String(note?.concept_id || ""),
      concept_title: String(note?.concept_title || ""),
    }))
    .filter((item) => item.decision);
}

function forkPayload(id) {
  const example = exampleById(id);
  if (!example?.starter?.system_name) return null;
  return {
    name: example.title || example.starter.system_name,
    system: example.starter,
    context: {
      prompt: example.prompt || "",
      blueprint_class: example.default_class || "ActorComponent",
      unreal_version: "5.8",
      project_context: "",
      references: [],
      setup_done: [],
    },
    note: "Forked from the bundled example",
  };
}

function officialUrls() {
  return new Set(Object.values(DOC).map((item) => item.url));
}

function validateBundled() {
  const data = catalog();
  const errors = [];
  const ids = new Set(data.examples.map((item) => item.id));
  const allowed = officialUrls();
  if (data.concepts.length < 8 || data.concepts.length > 10) {
    errors.push(`expected 8 to 10 concepts, have ${data.concepts.length}`);
  }
  for (const card of data.concepts) {
    if (!card.explanation || !card.summary) errors.push(`${card.id} needs an explanation`);
    const task = card.challenge;
    if (!task?.prompt || !Array.isArray(task.choices) || task.choices.length < 2) errors.push(`${card.id} needs a challenge`);
    if (!Number.isInteger(task?.answer) || task.answer < 0 || task.answer >= (task?.choices || []).length) {
      errors.push(`${card.id} challenge answer is out of range`);
    }
    if (!task?.why) errors.push(`${card.id} challenge needs a why`);
    if (!Array.isArray(card.example_ids) || card.example_ids.length < 1) errors.push(`${card.id} needs an example link`);
    for (const exampleId of card.example_ids || []) {
      if (!ids.has(exampleId)) errors.push(`${card.id} links to missing example ${exampleId}`);
    }
    for (const link of card.learn_more || []) {
      if (!allowed.has(link.url)) errors.push(`${card.id} has an unknown doc url ${link.url}`);
    }
  }
  const start = data.examples.find((item) => item.id === START_HERE_ID);
  if (!start?.starter) errors.push("missing Start Here");
  else {
    try { assertLearningAnchors(start.starter); }
    catch (exc) { errors.push(`Start Here learning: ${exc.message}`); }
    const learning = start.starter.learning;
    if (!["beginner", "intermediate", "advanced"].includes(learning.complexity)) errors.push("Start Here complexity");
    if (!Array.isArray(learning.prerequisites) || learning.prerequisites.length < 1) errors.push("Start Here prerequisites");
    if (!Array.isArray(learning.traps) || learning.traps.length < 1) errors.push("Start Here traps");
    if (!Array.isArray(learning.what_ifs) || learning.what_ifs.length < 1 || learning.what_ifs.some((item) => (item.variants || []).length < 2)) {
      errors.push("Start Here what-if snippets");
    }
    for (const item of learning.challenges || []) {
      if (!item.prompt || (item.choices || []).length < 2 || !item.why_people_pick || !item.reveal) {
        errors.push(`Start Here challenge incomplete: ${item.title}`);
      }
    }
    for (const note of learning.why_notes || []) {
      if (!note.one_line || !note.tradeoff || !note.common_mistake) errors.push(`Start Here note ${note.id} is missing a depth`);
      if (!resolveConcept(note.concept_id)) errors.push(`Start Here note ${note.id} concept ${note.concept_id} does not resolve`);
    }
    const effectKeys = new Set((learning.parameter_effects || []).map((item) => item.key));
    const impactKeys = new Set((learning.parameter_impacts || []).map((item) => item.key));
    for (const param of start.starter.tunable_parameters || []) {
      if (!effectKeys.has(param.key)) errors.push(`Start Here missing effect ${param.key}`);
      const impact = (learning.parameter_impacts || []).find((item) => item.key === param.key);
      if (!impactKeys.has(param.key) || !impact?.lines?.length) errors.push(`Start Here missing impact ${param.key}`);
      for (const line of impact?.lines || []) {
        const file = line.file === ".cpp" ? start.starter.cpp_source : start.starter.cpp_header;
        if (!String(file || "").split("\n")[line.line - 1]?.trim()) errors.push(`Start Here impact ${param.key} misses ${line.file}:${line.line}`);
      }
    }
  }
  for (const example of data.examples) {
    if (!["beginner", "intermediate", "advanced"].includes(example.complexity)) errors.push(`${example.id} complexity`);
    if (!Array.isArray(example.prerequisites)) errors.push(`${example.id} prerequisites`);
    for (const link of example.learn_more || []) {
      if (!allowed.has(link.url)) errors.push(`${example.id} has an unknown doc url ${link.url}`);
    }
    for (const note of example.starter?.learning?.why_notes || []) {
      if (!resolveConcept(note.concept_id, data.concepts)) errors.push(`${example.id} WHY ${note.concept_id} does not resolve`);
    }
    for (const concept of example.starter?.learning?.related_concepts || []) {
      if (!resolveConcept(concept.id, data.concepts)) errors.push(`${example.id} related concept ${concept.id} does not resolve`);
    }
  }
  if (!data.examples.some((item) => item.id === "interaction")) errors.push("templates missing");
  if (data.examples.length !== 9) errors.push(`expected 9 examples, have ${data.examples.length}`);
  if (errors.length) throw new Error(errors.join("\n"));
  return data;
}

module.exports = {
  START_HERE_ID,
  INTRO,
  DOC,
  CONCEPTS,
  catalog,
  exampleById,
  resolveConcept,
  keyDecisions,
  forkPayload,
  officialUrls,
  validateBundled,
};
