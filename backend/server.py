import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from fastapi import APIRouter, FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
MODEL_PROVIDER = "anthropic"
MODEL_NAME = "claude-sonnet-4-5-20250929"

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class GenerateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    prompt: str = Field(..., min_length=3, max_length=2000)
    system_name: Optional[str] = None
    blueprint_class: str = Field(default="ActorComponent")  # Actor, Pawn, Character, ActorComponent
    complexity: int = Field(default=50, ge=0, le=100)
    modularity: int = Field(default=70, ge=0, le=100)
    performance_vs_flexibility: int = Field(default=50, ge=0, le=100)
    tick_rate: int = Field(default=30, ge=0, le=120)
    network_replicated: bool = False
    extra_modules: List[str] = Field(default_factory=list)
    removed_modules: List[str] = Field(default_factory=list)


class NodeGraphNode(BaseModel):
    id: str
    label: str
    node_type: str  # event, function, variable, flow, pure
    x: int
    y: int
    inputs: List[str] = Field(default_factory=list)
    outputs: List[str] = Field(default_factory=list)


class NodeGraphEdge(BaseModel):
    from_node: str
    to_node: str
    kind: str = "exec"  # exec | data


class SystemOutput(BaseModel):
    id: str
    system_name: str
    summary: str
    tunable_parameters: List[dict]
    modules: List[dict]
    blueprint_pseudocode: str
    cpp_header: str
    cpp_source: str
    setup_guide: List[dict]
    node_graph_nodes: List[NodeGraphNode]
    node_graph_edges: List[NodeGraphEdge]
    network_notes: str
    generated_at: str


# ---------- Prompt ----------
SYSTEM_PROMPT = """You are an elite Unreal Engine 5 systems architect. Given a user's description of a gameplay/tool system, you emit a precise, production-ready modular architecture for UE 5.4+.

You MUST respond with ONLY a single valid JSON object (no markdown, no prose, no code fences) matching this exact schema:

{
  "system_name": "Short Title Case Name",
  "summary": "2-3 sentence plain-English description of what this system does and how it is wired",
  "tunable_parameters": [
    {"key": "max_health", "label": "Max Health", "value": 100, "min": 1, "max": 1000, "step": 1, "unit": "HP"}
  ],
  "modules": [
    {"name": "StaminaDrain", "included": true, "description": "Drains stamina on attack"}
  ],
  "blueprint_pseudocode": "Multi-line Blueprint node pseudocode. Use indentation. Format:\\nEvent BeginPlay\\n  -> Set Health = MaxHealth\\n  -> Bind Delegate OnTakeDamage -> HandleDamage",
  "cpp_header": "// FullName.h  — complete, compilable UE5 header with UCLASS, UPROPERTY, UFUNCTION macros",
  "cpp_source": "// FullName.cpp — complete implementation that pairs with the header",
  "setup_guide": [
    {"step": 1, "title": "Create Blueprint Class", "detail": "Content Browser > Right Click > Blueprint Class > ActorComponent. Name it BP_SystemName."},
    {"step": 2, "title": "...", "detail": "..."}
  ],
  "node_graph_nodes": [
    {"id": "n1", "label": "Event BeginPlay", "node_type": "event", "x": 80, "y": 120, "inputs": [], "outputs": ["exec"]}
  ],
  "node_graph_edges": [
    {"from_node": "n1", "to_node": "n2", "kind": "exec"}
  ],
  "network_notes": "Short notes on replication, RPCs, authority checks."
}

Rules:
- node_type must be one of: event, function, variable, flow, pure
- Lay out nodes on a logical left-to-right grid: x in [40, 1400], y in [60, 700]. Space nodes ~220px horizontally and ~120px vertically. Keep 6-14 nodes total.
- edge.kind is "exec" for execution wires, "data" for variable/data wires.
- Produce 4-10 setup_guide steps.
- Produce 3-8 tunable_parameters that genuinely drive the system; use integer or float values.
- Produce 3-8 modules reflecting the user's extra_modules / removed_modules choices (mark removed ones included:false but still list them for easy re-enable).
- Use Unreal macros correctly: UCLASS(), UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="SystemName"), UFUNCTION(BlueprintCallable). Include replication (UPROPERTY(Replicated)) only if network_replicated is true.
- Keep code idiomatic and compilable: forward declarations, GENERATED_BODY(), proper #include "CoreMinimal.h".
- NEVER wrap the JSON in ```json fences. Respond with raw JSON starting with { and ending with }."""


def extract_json(raw: str) -> dict:
    """Extract the first JSON object from the model output, stripping any accidental code fences."""
    text = raw.strip()
    # Strip ```json ... ``` fences if the model slipped them in
    fence = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    # Find first { and matching last }
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in model response")
    return json.loads(text[start : end + 1])


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "UE5 Modular System Architect API", "model": MODEL_NAME}


@api_router.post("/generate", response_model=SystemOutput)
async def generate_system(req: GenerateRequest):
    session_id = f"ue5-{uuid.uuid4()}"

    user_text = f"""User request:
\"\"\"{req.prompt}\"\"\"

Target UE5 Blueprint class: {req.blueprint_class}
System name hint: {req.system_name or "(auto-generate)"}
Network replicated: {req.network_replicated}

Tunable architecture dials (0-100 unless noted):
  complexity={req.complexity}  (higher = more features, more classes, deeper logic)
  modularity={req.modularity}  (higher = split into more ActorComponents / Interfaces)
  performance_vs_flexibility={req.performance_vs_flexibility}  (0=max perf, 100=max flexibility)
  tick_rate={req.tick_rate} Hz  (0 = event-driven only)

User-added modules to INCLUDE: {req.extra_modules or "(none)"}
User-removed modules to mark excluded: {req.removed_modules or "(none)"}

Generate the full modular UE5 system now. Respond with raw JSON only."""

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=SYSTEM_PROMPT,
    ).with_model(MODEL_PROVIDER, MODEL_NAME).with_params(max_tokens=8000)

    try:
        raw = await chat.send_message(UserMessage(text=user_text))
    except Exception as exc:
        logging.exception("LLM call failed")
        raise HTTPException(status_code=502, detail=f"LLM error: {exc}") from exc

    try:
        data = extract_json(raw)
    except Exception as exc:
        logging.error("Failed to parse LLM JSON. Raw first 500 chars: %s", raw[:500])
        raise HTTPException(status_code=502, detail=f"Model returned invalid JSON: {exc}") from exc

    data["id"] = str(uuid.uuid4())
    data["generated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        return SystemOutput(**data)
    except Exception as exc:
        logging.error("Validation failed for generated system: %s", exc)
        raise HTTPException(status_code=502, detail=f"Schema validation failed: {exc}") from exc


# ---------- Template library (static, served from backend for easy expansion) ----------
TEMPLATES = [
    {
        "id": "combat",
        "title": "Advanced Combat System",
        "tagline": "Combo attacks, hitstop, damage types",
        "accent": "red",
        "icon": "swords",
        "prompt": "A third-person melee combat system with combo chains, directional attacks, hit reactions, hitstop, and a damage type enum. Uses an ActorComponent attached to the player Character.",
        "default_class": "ActorComponent",
    },
    {
        "id": "inventory",
        "title": "Grid Inventory",
        "tagline": "Slot grid, stacking, tooltips",
        "accent": "orange",
        "icon": "package",
        "prompt": "A slot-based grid inventory system (like Resident Evil) with stackable items, item tooltips, drag-and-drop between slots, and a lightweight DataAsset for item definitions.",
        "default_class": "ActorComponent",
    },
    {
        "id": "dialogue",
        "title": "Branching Dialogue & Quests",
        "tagline": "Nodes, choices, flags",
        "accent": "blue",
        "icon": "messages-square",
        "prompt": "A branching dialogue system with speaker lines, player choices, condition-gated branches, quest-stage flag updates, and a DataTable-driven conversation graph.",
        "default_class": "Actor",
    },
    {
        "id": "ai_guard",
        "title": "Behavior Tree AI Guard",
        "tagline": "Patrol, chase, search",
        "accent": "purple",
        "icon": "shield",
        "prompt": "An AI guard pawn using a Behavior Tree and Blackboard with patrol route, sight/hearing perception, chase, investigate-last-known-position, and return-to-post states.",
        "default_class": "Character",
    },
    {
        "id": "save",
        "title": "Save / Load Game State",
        "tagline": "Slots, versioning, async",
        "accent": "green",
        "icon": "hard-drive",
        "prompt": "A robust save/load subsystem with multiple save slots, autosave timer, versioned USaveGame struct, async disk I/O, and a Blueprint-friendly API.",
        "default_class": "GameInstanceSubsystem",
    },
    {
        "id": "vehicle",
        "title": "Vehicle Physics Controller",
        "tagline": "Chaos vehicles, gears, drift",
        "accent": "cyan",
        "icon": "car",
        "prompt": "A Chaos Vehicles arcade car controller with throttle, brake, handbrake drift, automatic gear shifting, boost ability, and tire smoke VFX hooks.",
        "default_class": "WheeledVehiclePawn",
    },
    {
        "id": "gas",
        "title": "Gameplay Ability System",
        "tagline": "GAS attributes & abilities",
        "accent": "orange",
        "icon": "sparkles",
        "prompt": "A Gameplay Ability System setup with an AttributeSet (Health, Mana, Stamina), three granted GameplayAbilities (Dash, Fireball, Heal), cooldown & cost GEs, and a tag-driven cancellation policy.",
        "default_class": "Character",
    },
    {
        "id": "interaction",
        "title": "Interaction System",
        "tagline": "Line trace, prompts, outlines",
        "accent": "blue",
        "icon": "hand",
        "prompt": "A first-person interaction system using a line trace from the camera, a BPI_Interactable interface, dynamic prompt widgets, and a post-process outline on focused actors.",
        "default_class": "ActorComponent",
    },
]


@api_router.get("/templates")
async def list_templates():
    return {"templates": TEMPLATES}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)
