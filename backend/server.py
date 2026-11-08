import asyncio
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage
from fastapi import APIRouter, FastAPI, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, IndexModel
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
MODEL_PROVIDER = "anthropic"
MODEL_NAME = "claude-sonnet-4-5-20250929"

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]
RUNNING_JOBS: set = set()

app = FastAPI()


@app.on_event("startup")
async def ensure_indexes():
    await db.jobs.create_indexes([
        IndexModel([("job_id", ASCENDING)], name="job_id", unique=True),
        IndexModel([("created_at", ASCENDING)], name="created_at"),
    ])


@app.on_event("shutdown")
async def shutdown():
    client.close()
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
    parameter_overrides: dict = Field(default_factory=dict)
    project_context: str = Field(default="", max_length=300)
    designer_notes: str = Field(default="", max_length=1000)
    change_requests: List[str] = Field(default_factory=list, max_length=40)
    previous_system: Optional[dict] = None
    stack_systems: List[dict] = Field(default_factory=list, max_length=4)


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


class TunableParam(BaseModel):
    key: str
    label: str = ""
    value: float
    min: float = 0
    max: float = 100
    step: float = 1
    unit: str = ""


class SetupStep(BaseModel):
    step: int
    title: str
    detail: str = ""
    why: str = ""


class ModuleItem(BaseModel):
    name: str
    included: bool = True
    description: str = ""


class SystemOutput(BaseModel):
    id: str
    system_name: str
    summary: str
    tunable_parameters: List[TunableParam]
    modules: List[ModuleItem]
    blueprint_pseudocode: str
    cpp_header: str
    cpp_source: str
    setup_guide: List[SetupStep]
    node_graph_nodes: List[NodeGraphNode]
    node_graph_edges: List[NodeGraphEdge]
    network_notes: str
    applied_changes: List[str] = Field(default_factory=list)
    shared_attributes: List[str] = Field(default_factory=list)
    stacked_from: List[str] = Field(default_factory=list)
    generated_at: str


# ---------- Prompt ----------
SYSTEM_PROMPT = """You are an elite Unreal Engine 5 systems architect. Given a user's system description, you emit a compact, production-ready modular architecture for UE 5.4+.

Respond with ONLY a single raw JSON object (no markdown, no code fences, no prose) matching this schema:

{
  "system_name": "Short Title Case Name",
  "summary": "1-2 sentence description of what this system does",
  "tunable_parameters": [{"key":"max_health","label":"Max Health","value":100,"min":1,"max":1000,"step":1,"unit":"HP"}],
  "modules": [{"name":"StaminaDrain","included":true,"description":"short desc"}],
  "blueprint_pseudocode": "Event BeginPlay\\n  -> Set Health = MaxHealth\\n  WHY: Health is initialised on BeginPlay so designer-set MaxHealth defaults apply per instance\\n  -> Bind OnTakeDamage -> HandleDamage",
  "cpp_header": "// Name.h — compilable UE5 header with UCLASS, UPROPERTY, UFUNCTION",
  "cpp_source": "// Name.cpp — matching implementation",
  "setup_guide": [{"step":1,"title":"Create Blueprint","detail":"short detail","why":"short reason this step/approach was chosen"}],
  "node_graph_nodes": [{"id":"n1","label":"Event BeginPlay","node_type":"event","x":80,"y":120,"inputs":[],"outputs":["exec"]}],
  "node_graph_edges": [{"from_node":"n1","to_node":"n2","kind":"exec"}],
  "network_notes": "Short replication notes.",
  "applied_changes": ["One line per REQUESTED CHANGE stating exactly how it was applied"],
  "shared_attributes": ["Only when stacking: attributes/interfaces shared between the stacked systems"]
}

Rules:
- node_type ∈ {event, function, variable, flow, pure}. Produce 6-9 nodes laid out left-to-right (x ∈ [40,1200], y ∈ [60,560], ~220px x-spacing, ~120px y-spacing). 4-7 edges. edge.kind = "exec" or "data".
- 4-6 setup_guide steps (keep detail <= 140 chars).
- 3-5 tunable_parameters with sensible min/max/step/unit.
- 3-5 modules. Include any user-added names (included:true) and any user-removed names (included:false).
- C++: use #include "CoreMinimal.h", GENERATED_BODY(), UCLASS(), UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="X"), UFUNCTION(BlueprintCallable). Keep each file ~40-80 lines. Add UPROPERTY(Replicated) + GetLifetimeReplicatedProps ONLY if network_replicated is true.
- LEARNING ANNOTATIONS: in blueprint_pseudocode, after 3-5 key decisions add an indented line starting with "WHY:" (e.g. "WHY: Replicated because state must match across all clients", "WHY: Data Asset used so designers can tweak without recompiling"). Every setup_guide step gets a "why" (<= 110 chars).
- If PROJECT CONTEXT is given, every design decision must fit it.
- If a PREVIOUS SYSTEM and REQUESTED CHANGES are given: this is a revision. Keep everything from the previous system that is not affected, apply EVERY requested change exactly (parameter values, module removals/additions, dial shifts, designer notes), and list one applied_changes entry per requested change in the same order. Otherwise applied_changes is [].
- If STACKED SYSTEMS are given: merge them into ONE integrated system. Unify duplicated attributes into a single owner (e.g. one Health attribute used by both), route cross-system calls through interfaces or delegates, rename anything that collides, and list shared_attributes. Record each conflict resolved as an applied_changes entry starting with "Conflict resolved:". Otherwise shared_attributes is [].
- Output raw JSON only, starting with { and ending with }."""


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


def compact_system(sys: dict, header_chars: int) -> str:
    keep = {
        "system_name": sys.get("system_name"),
        "summary": sys.get("summary"),
        "modules": [{"name": m.get("name"), "included": m.get("included")} for m in sys.get("modules", [])],
        "tunable_parameters": [
            {k: p.get(k) for k in ("key", "label", "value", "unit")} for p in sys.get("tunable_parameters", [])
        ],
        "network_notes": sys.get("network_notes"),
        "cpp_header_excerpt": (sys.get("cpp_header") or "")[:header_chars],
    }
    return json.dumps(keep, indent=1)


def build_user_text(req: "GenerateRequest") -> str:
    sections = []
    if req.project_context.strip():
        sections.append(f"PROJECT CONTEXT (steer every decision by this): {req.project_context.strip()}")
    if req.stack_systems:
        stacked = "\n\n".join(f"[System {i + 1}]\n{compact_system(s, 1800)}" for i, s in enumerate(req.stack_systems))
        sections.append(f"STACKED SYSTEMS (merge into one integrated system):\n{stacked}")
    if req.previous_system:
        sections.append(f"PREVIOUS SYSTEM (revise this, do not start over):\n{compact_system(req.previous_system, 2500)}")
    if req.change_requests:
        numbered = "\n".join(f"{i + 1}. {c}" for i, c in enumerate(req.change_requests))
        sections.append(f"REQUESTED CHANGES (apply every one, report each in applied_changes):\n{numbered}")
    if req.designer_notes.strip():
        sections.append(f"DESIGNER NOTES: {req.designer_notes.strip()}")
    prefix = "\n\n".join(sections) + "\n\n" if sections else ""
    return prefix + f"""User request:
\"\"\"{req.prompt}\"\"\"

Target UE5 Blueprint class: {req.blueprint_class}
System name hint: {req.system_name or "(auto-generate)"}
Network replicated: {req.network_replicated}

Tunable architecture dials (0-100 unless noted):
  complexity={req.complexity}  (higher = more features, deeper logic)
  modularity={req.modularity}  (higher = split into more ActorComponents / Interfaces)
  performance_vs_flexibility={req.performance_vs_flexibility}  (0=max perf, 100=max flexibility)
  tick_rate={req.tick_rate} Hz  (0 = event-driven only)

User-added modules to INCLUDE: {req.extra_modules or "(none)"}
User-removed modules to mark excluded: {req.removed_modules or "(none)"}
User-tuned parameter values (keep these keys and use these exact values in code defaults): {req.parameter_overrides or "(none)"}

Generate the full modular UE5 system now. Respond with raw JSON only."""


def friendly_error(exc: Exception) -> str:
    msg = str(exc)
    if "Budget has been exceeded" in msg:
        return "Emergent Universal Key budget exceeded. Add balance: Profile → Manage plan → Universal Key → Add Balance."
    return f"LLM error: {msg[:300]}"


async def set_job(job_id: str, **fields) -> None:
    await db.jobs.update_one({"job_id": job_id}, {"$set": fields})


async def run_job(job_id: str, req: GenerateRequest) -> None:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"ue5-{job_id}",
        system_message=SYSTEM_PROMPT,
    ).with_model(MODEL_PROVIDER, MODEL_NAME).with_params(max_tokens=12000 if req.stack_systems else 8000)
    raw, last_report = "", 0
    try:
        async for ev in chat.stream_message(UserMessage(text=build_user_text(req))):
            if isinstance(ev, TextDelta):
                raw += ev.content
                if len(raw) - last_report > 400:
                    last_report = len(raw)
                    await set_job(job_id, chars=len(raw))
            elif isinstance(ev, StreamDone):
                break
    except Exception as exc:
        logging.exception("LLM stream failed")
        await set_job(job_id, status="error", detail=friendly_error(exc))
        return
    try:
        data = extract_json(raw)
        data["id"] = str(uuid.uuid4())
        data["generated_at"] = datetime.now(timezone.utc).isoformat()
        data["stacked_from"] = [s.get("system_name", "") for s in req.stack_systems]
        result = SystemOutput(**data)
    except Exception as exc:
        logging.error("Bad LLM output (%s). Tail: %s", exc, raw[-300:])
        await set_job(job_id, status="error", detail="The model's output was incomplete. Please try again, or lower Complexity.")
        return
    await set_job(job_id, status="done", chars=len(raw), result=result.model_dump())


@api_router.post("/generate")
async def generate_system(req: GenerateRequest):
    job_id = str(uuid.uuid4())
    await db.jobs.insert_one({
        "job_id": job_id, "status": "running", "chars": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    task = asyncio.create_task(run_job(job_id, req))
    RUNNING_JOBS.add(task)
    task.add_done_callback(RUNNING_JOBS.discard)
    return {"job_id": job_id}


@api_router.get("/generate/{job_id}")
async def get_job(job_id: str):
    job = await db.jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


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
