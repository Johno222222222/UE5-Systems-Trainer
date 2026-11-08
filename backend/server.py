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
import base64
import hashlib
from zoneinfo import ZoneInfo

from emergentintegrations.llm.chat import ImageContent, LlmChat, StreamDone, TextDelta, UserMessage
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from pymongo import ASCENDING, DESCENDING, IndexModel

import auth
import projects
import teams
from core import client, db
from storage import init_storage
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# Synthesis runs on the user's own key (sent per request, never stored)
ALLOWED_MODELS = {
    "gemini": ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash", "gemini-3.1-pro-preview"],
    "openai": ["gpt-4.1-mini", "gpt-4.1", "gpt-5-mini"],
}
# Approximate free-tier requests per day (Google resets at midnight Pacific)
FREE_DAILY = {"gemini-3.5-flash-lite": 500, "gemini-3.1-flash-lite": 500, "gemini-3.8-flash": 250, "gemini-3.1-pro-preview": 0}
PACIFIC = ZoneInfo("America/Los_Angeles")


def usage_day() -> str:
    return datetime.now(PACIFIC).strftime("%Y-%m-%d")


def key_fingerprint(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()[:16]


async def record_usage(user_id: str, key: str, provider: str, model: str, kind: str) -> None:
    await db.llm_usage.insert_one({
        "user_id": user_id, "key_fp": key_fingerprint(key), "provider": provider, "model": model,
        "kind": kind, "day": usage_day(), "at": datetime.now(timezone.utc).isoformat(),
    })


PAID_MODEL_MSG = "{model} needs a paid API key, and this key is on the free tier. Switch back to Gemini 3.5 Flash-Lite, which works free."

RUNNING_JOBS: set = set()

app = FastAPI()


INDEXES = {
    "jobs": [IndexModel([("job_id", ASCENDING)], name="job_id", unique=True)],
    "users": [IndexModel([("email", ASCENDING)], name="email", unique=True), IndexModel([("user_id", ASCENDING)], name="user_id", unique=True)],
    "user_sessions": [IndexModel([("session_token", ASCENDING)], name="session_token")],
    "login_attempts": [IndexModel([("identifier", ASCENDING)], name="identifier")],
    "password_reset_tokens": [IndexModel([("token", ASCENDING)], name="token"), IndexModel([("expires_at", ASCENDING)], name="ttl", expireAfterSeconds=0)],
    "projects": [
        IndexModel([("project_id", ASCENDING)], name="project_id", unique=True),
        IndexModel([("owner_id", ASCENDING), ("updated_at", DESCENDING)], name="owner_updated"),
        IndexModel([("members.user_id", ASCENDING)], name="member_user"),
        IndexModel([("members.email", ASCENDING)], name="member_email"),
        IndexModel([("members.invite_token", ASCENDING)], name="invite_token"),
        IndexModel([("public_token", ASCENDING)], name="public_token"),
    ],
    "llm_usage": [IndexModel([("user_id", ASCENDING), ("key_fp", ASCENDING), ("day", ASCENDING)], name="user_key_day")],
    "project_versions": [IndexModel([("project_id", ASCENDING), ("version", DESCENDING)], name="project_version", unique=True)],
    "files": [IndexModel([("file_id", ASCENDING)], name="file_id", unique=True), IndexModel([("project_id", ASCENDING), ("kind", ASCENDING)], name="project_kind")],
}


@app.on_event("startup")
async def startup():
    for coll, models in INDEXES.items():
        for m in models:
            try:
                await db[coll].create_indexes([m])
            except Exception as exc:
                logging.error("index %s.%s: %s", coll, m.document["name"], exc)
    await auth.seed_admin()
    try:
        await asyncio.to_thread(init_storage)
    except Exception as exc:
        logging.error("Storage init failed: %s", exc)


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
    reference_file_ids: List[str] = Field(default_factory=list, max_length=5)


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
  "blueprint_pseudocode": "Event BeginPlay\\n  -> Set Health = MaxHealth\\n  WHY: <reason for this specific decision>\\n  -> Bind OnTakeDamage -> HandleDamage",
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
- Never copy example text from this schema (e.g. the sample WHY line); every WHY must explain a decision specific to this system.
- system_name is human-readable Title Case with spaces (e.g. "Health And Damage Component").
- C++: use #include "CoreMinimal.h", GENERATED_BODY(), UCLASS(), UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="X"), UFUNCTION(BlueprintCallable). Each file must be 50-120 real lines (not counting blank lines): declare every tunable parameter as a UPROPERTY, every module's functions, delegates and events, and implement them fully in the .cpp. Add UPROPERTY(Replicated) + GetLifetimeReplicatedProps ONLY if network_replicated is true.
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
    return json.loads(text[start : end + 1], strict=False)


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "UE5 Modular System Architect API", "models": ALLOWED_MODELS}


def compact_system(sys: dict, header_chars: int, full: bool = False) -> str:
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
    if full:
        keep["cpp_source"] = (sys.get("cpp_source") or "")[:12000]
        keep["blueprint_pseudocode"] = (sys.get("blueprint_pseudocode") or "")[:6000]
        keep["setup_guide"] = sys.get("setup_guide", [])
        keep["node_graph"] = {"nodes": sys.get("node_graph_nodes", []), "edges": sys.get("node_graph_edges", [])}
    return json.dumps(keep, indent=1)


def build_user_text(req: "GenerateRequest", refs: list) -> str:
    sections = []
    if refs:
        parts = []
        for r in refs:
            body = "(image attached below)" if r.get("image_bytes") else r.get("text") or ""
            parts.append(f"--- {r['filename']} ---\n{body}")
        sections.append("REFERENCE FILES (use as source material: extend existing code, match screenshots and specs):\n" + "\n\n".join(parts))
    if req.project_context.strip():
        sections.append(f"PROJECT CONTEXT (steer every decision by this): {req.project_context.strip()}")
    if req.stack_systems:
        stacked = "\n\n".join(f"[System {i + 1}]\n{compact_system(s, 4000)}" for i, s in enumerate(req.stack_systems))
        sections.append(f"STACKED SYSTEMS (merge into one integrated system):\n{stacked}")
    if req.previous_system:
        sections.append(f"PREVIOUS SYSTEM (revise this, do not start over):\n{compact_system(req.previous_system, 8000, full=True)}")
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


def classify_error(exc: Exception, model: str = "") -> tuple[str, str]:
    low = str(exc).lower()
    status = getattr(exc, "status_code", None) or getattr(getattr(exc, "__cause__", None), "status_code", None)
    if "free_tier" in low and "limit: 0" in low:
        return "paid_model_required", PAID_MODEL_MSG.format(model=model or "This model")
    if "insufficient_quota" in low:
        return "no_credits", "This OpenAI key has no credits left (free credits expire after 30 days). Add billing to your OpenAI account, or switch to a free Gemini key."
    if isinstance(exc, asyncio.TimeoutError) or "timeout" in low or "timed out" in low:
        return "busy", "The model took too long to answer. Try again, or switch to Gemini 3.5 Flash-Lite."
    if status in (500, 502, 503, 504) or "serviceunavailable" in low or "high demand" in low or "overloaded" in low:
        return "busy", "That model is overloaded right now. Try again in a minute, or switch to Gemini 3.5 Flash-Lite."
    return "error", friendly_error(exc)


def friendly_error(exc: Exception) -> str:
    msg = str(exc)
    low = msg.lower()
    if any(k in low for k in ("api key not valid", "invalid api key", "incorrect api key", "api_key_invalid", "authenticationerror", "permission_denied")):
        return "Your AI key was rejected. Open AI Key settings and check it's correct for the selected provider."
    if any(k in low for k in ("resource_exhausted", "ratelimit", "rate limit", "quota", "429")):
        return "Your AI key hit its rate limit or free quota. Wait a minute and try again, or switch to a lighter model."
    if "not found" in low and "model" in low:
        return "That model isn't available for your key. Pick another model in AI Key settings."
    return f"AI provider error: {msg[:300]}"


async def set_job(job_id: str, **fields) -> None:
    await db.jobs.update_one({"job_id": job_id}, {"$set": fields})


async def run_job(job_id: str, req: GenerateRequest, refs: list, provider: str, model: str, key: str, user_id: str) -> None:
    chat = LlmChat(
        api_key=key,
        session_id=f"ue5-{job_id}",
        system_message=SYSTEM_PROMPT,
    ).with_model(provider, model).with_params(max_tokens=24000 if provider == "gemini" else (12000 if req.stack_systems else 8000))
    raw, last_report = "", 0
    try:
        images = [ImageContent(base64.b64encode(r["image_bytes"]).decode()) for r in refs if r.get("image_bytes")]
        message = UserMessage(text=build_user_text(req, refs), file_contents=images)
        if provider == "gemini":
            # litellm can't parse newer Gemini stream chunks, so ask for the whole answer at once.
            # Free-tier Gemini returns brief 503s under load; retry those twice before giving up.
            for attempt in range(3):
                try:
                    await record_usage(user_id, key, provider, model, "synthesis")
                    raw = await chat.send_message(message)
                    break
                except Exception as exc:
                    if attempt == 2 or classify_error(exc, model)[0] != "busy":
                        raise
                    await set_job(job_id, detail=f"Model busy, retrying ({attempt + 1}/2)…")
                    await asyncio.sleep(4 * (attempt + 1))
        else:
            await record_usage(user_id, key, provider, model, "synthesis")
            async for ev in chat.stream_message(message):
                if isinstance(ev, TextDelta):
                    raw += ev.content
                    if len(raw) - last_report > 400:
                        last_report = len(raw)
                        await set_job(job_id, chars=len(raw))
                elif isinstance(ev, StreamDone):
                    break
    except Exception as exc:
        logging.error("LLM stream failed: %s", str(exc).replace(key, "***")[:500])
        code, detail = classify_error(exc, model)
        await set_job(job_id, status="error", error_code=code, detail=detail.replace(key, "***"))
        return
    try:
        data = extract_json(raw)
        data["id"] = str(uuid.uuid4())
        data["generated_at"] = datetime.now(timezone.utc).isoformat()
        data["stacked_from"] = [s.get("system_name", "") for s in req.stack_systems]
        result = SystemOutput(**data)
        missing = [f for f in ("system_name", "blueprint_pseudocode", "cpp_header", "cpp_source") if not getattr(result, f).strip()]
        if missing or not result.node_graph_nodes or not result.setup_guide:
            raise ValueError(f"empty fields: {missing or 'graph/setup'}")
    except Exception as exc:
        logging.error("Bad LLM output (%s). Tail: %s", exc, raw[-300:])
        await set_job(job_id, status="error", detail="The model's output was incomplete. Please try again, or lower Complexity.")
        return
    await set_job(job_id, status="done", chars=len(raw), result=result.model_dump())


@api_router.post("/generate")
async def generate_system(
    req: GenerateRequest,
    user: dict = Depends(auth.current_user),
    x_llm_provider: str = Header(None),
    x_llm_model: str = Header(None),
    x_llm_key: str = Header(None),
):
    x_llm_provider, x_llm_model, llm_key = resolve_llm(x_llm_provider, x_llm_model, x_llm_key)
    refs = await projects.load_references(req.reference_file_ids, user)
    job_id = str(uuid.uuid4())
    await db.jobs.insert_one({
        "job_id": job_id, "status": "running", "chars": 0, "user_id": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    task = asyncio.create_task(run_job(job_id, req, refs, x_llm_provider, x_llm_model, llm_key, user["user_id"]))
    RUNNING_JOBS.add(task)
    task.add_done_callback(RUNNING_JOBS.discard)
    return {"job_id": job_id}


DEFAULT_PROVIDER, DEFAULT_MODEL = "gemini", "gemini-3.5-flash-lite"


def resolve_llm(provider, model, key) -> tuple[str, str, str]:
    provider = provider or DEFAULT_PROVIDER
    model = model or (DEFAULT_MODEL if provider == "gemini" else ALLOWED_MODELS.get(provider, [""])[0])
    return provider, model, check_llm_headers(provider, model, key)


def check_llm_headers(provider, model, key) -> str:
    if not key or not key.strip():
        raise HTTPException(status_code=400, detail="Add your Gemini or OpenAI API key in AI Key settings before synthesizing.")
    if key.startswith("sk-emergent-"):
        raise HTTPException(status_code=400, detail="Use your own Gemini or OpenAI key, not an Emergent key.")
    if model not in ALLOWED_MODELS.get(provider or "", []):
        raise HTTPException(status_code=400, detail="Pick a supported provider and model in AI Key settings.")
    return key.strip()


@api_router.post("/ai/test-key")
async def test_key(
    user: dict = Depends(auth.current_user),
    x_llm_provider: str = Header(None),
    x_llm_model: str = Header(None),
    x_llm_key: str = Header(None),
):
    x_llm_provider, x_llm_model, key = resolve_llm(x_llm_provider, x_llm_model, x_llm_key)
    chat = LlmChat(api_key=key, session_id=f"keytest-{uuid.uuid4()}", system_message="Reply with the single word OK.") \
        .with_model(x_llm_provider, x_llm_model).with_params(max_tokens=256)
    await record_usage(user["user_id"], key, x_llm_provider, x_llm_model, "key_test")
    try:
        await asyncio.wait_for(chat.send_message(UserMessage(text="Say OK")), timeout=30)
    except asyncio.TimeoutError:
        return {"ok": False, "code": "busy", "message": "The model didn't answer within 30 seconds. It may be overloaded; try Gemini 3.5 Flash-Lite."}
    except Exception as exc:
        logging.error("Key test failed: %s", str(exc).replace(key, "***")[:300])
        code, detail = classify_error(exc, x_llm_model)
        return {"ok": False, "code": code, "message": detail.replace(key, "***")}
    return {"ok": True, "message": f"Key works with {x_llm_model}."}


REVIEW_PROMPT = """You are a strict Unreal Engine 5.4 C++ compile reviewer. Find problems in the given .h/.cpp pair that would make it fail to compile, fail Unreal Header Tool, or fail to link: missing #includes, names that don't match between files, wrong or missing signatures, functions declared but not defined, UCLASS/UPROPERTY/UFUNCTION macro mistakes, wrong Super:: calls, replication mistakes, wrong engine API usage.
Only report real problems, never style. Do not repeat issues already listed under KNOWN ISSUES.
Respond with ONLY raw JSON: {"issues":[{"severity":"error","file":".h","line":12,"message":"what is wrong","fix":"how to fix it"}]}
severity is "error" (will not build) or "warning" (likely wrong at runtime). file is ".h" or ".cpp". line may be null. At most 12 issues. If the code looks fine, return {"issues":[]}."""


class ReviewRequest(BaseModel):
    file_base: str = Field(default="System", max_length=120)
    cpp_header: str = Field(..., max_length=40000)
    cpp_source: str = Field(..., max_length=60000)
    known_issues: List[str] = Field(default_factory=list, max_length=40)


@api_router.post("/ai/review-cpp")
async def review_cpp(
    req: ReviewRequest,
    user: dict = Depends(auth.current_user),
    x_llm_provider: str = Header(None),
    x_llm_model: str = Header(None),
    x_llm_key: str = Header(None),
):
    provider, model, key = resolve_llm(x_llm_provider, x_llm_model, x_llm_key)
    chat = LlmChat(api_key=key, session_id=f"review-{uuid.uuid4()}", system_message=REVIEW_PROMPT) \
        .with_model(provider, model).with_params(max_tokens=8000)
    known = "\n".join(f"- {k[:200]}" for k in req.known_issues) or "(none)"
    text = f"KNOWN ISSUES:\n{known}\n\n=== {req.file_base}.h ===\n{req.cpp_header}\n\n=== {req.file_base}.cpp ===\n{req.cpp_source}"
    await record_usage(user["user_id"], key, provider, model, "review")
    try:
        raw = await asyncio.wait_for(chat.send_message(UserMessage(text=text)), timeout=50)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="The model took too long to review. Try again, or switch to Gemini 3.5 Flash-Lite.")
    except Exception as exc:
        logging.error("Review failed: %s", str(exc).replace(key, "***")[:300])
        raise HTTPException(status_code=502, detail=classify_error(exc, model)[1].replace(key, "***"))
    try:
        issues = extract_json(raw)["issues"]
        if not isinstance(issues, list):
            raise ValueError("issues is not a list")
        out = [{
            "severity": "error" if i.get("severity") == "error" else "warning",
            "file": ".cpp" if str(i.get("file", "")).endswith("cpp") else ".h",
            "line": i.get("line") if isinstance(i.get("line"), int) else None,
            "message": str(i.get("message", ""))[:400],
            "fix": str(i.get("fix", ""))[:400],
        } for i in issues if isinstance(i, dict) and i.get("message")][:12]
        if issues and not out:
            raise ValueError("no readable issues")
    except Exception:
        raise HTTPException(status_code=502, detail="The model's review couldn't be read. Please try again.")
    return {"issues": out, "model": model}


FIX_PROMPT = """You are an Unreal Engine 5.4 C++ fixer. You get a .h/.cpp pair and a list of ISSUES. Fix exactly those issues with the smallest possible edits. Do not rewrite, reformat or rename anything else.
Respond with ONLY raw JSON:
{"edits":[{"file":".h","find":"exact text copied from the file","replace":"new text","why":"which issue this fixes, in a few words"}]}
Rules:
- "find" must be copied character-for-character from the CURRENT file (including indentation) and must appear exactly once in that file. Use one or more whole lines; include enough context to be unique.
- To insert new lines (e.g. an #include or a new function), set "find" to an existing nearby line and "replace" to that same line plus the new lines.
- To delete, set "replace" to "".
- Never return the whole file. At most 15 edits. If an issue can't be fixed safely, skip it."""


class FixRequest(BaseModel):
    file_base: str = Field(default="System", max_length=120)
    cpp_header: str = Field(..., max_length=40000)
    cpp_source: str = Field(..., max_length=60000)
    issues: List[str] = Field(..., min_length=1, max_length=40)
    project_id: Optional[str] = None


def replace_lines_loose(text: str, find: str, repl: str) -> str:
    # Models often change indentation (tabs vs spaces); match whole lines ignoring surrounding whitespace
    lines = text.split("\n")
    want = [w.strip() for w in find.strip("\n").split("\n")]
    starts = [i for i in range(len(lines) - len(want) + 1) if [x.strip() for x in lines[i:i + len(want)]] == want]
    if len(starts) != 1:
        raise ValueError(f"text to change was found {len(starts)} times")
    i = starts[0]
    indent = lines[i][: len(lines[i]) - len(lines[i].lstrip())]
    new = [indent + r.strip() if r.strip() and not r.startswith((" ", "\t")) else r for r in repl.split("\n")] if repl else []
    return "\n".join(lines[:i] + new + lines[i + len(want):])


def apply_edits(files: dict, edits: list) -> list:
    applied = []
    for e in edits:
        if not isinstance(e, dict):
            continue
        name = ".cpp" if str(e.get("file", "")).endswith("cpp") else ".h"
        find, repl = e.get("find"), e.get("replace", "")
        if not isinstance(find, str) or not find.strip() or not isinstance(repl, str):
            raise ValueError("edit without find text")
        hits = files[name].count(find)
        if hits == 1:
            files[name] = files[name].replace(find, repl, 1)
        else:
            files[name] = replace_lines_loose(files[name], find, repl)
        applied.append({"file": name, "why": str(e.get("why", ""))[:200]})
    return applied


@api_router.post("/ai/fix-cpp")
async def fix_cpp(
    req: FixRequest,
    user: dict = Depends(auth.current_user),
    x_llm_provider: str = Header(None),
    x_llm_model: str = Header(None),
    x_llm_key: str = Header(None),
):
    provider, model, key = resolve_llm(x_llm_provider, x_llm_model, x_llm_key)
    if req.project_id:
        await projects.load_project(req.project_id, user, "editor")
    chat = LlmChat(api_key=key, session_id=f"fix-{uuid.uuid4()}", system_message=FIX_PROMPT) \
        .with_model(provider, model).with_params(max_tokens=12000)
    issues = "\n".join(f"{i + 1}. {t[:300]}" for i, t in enumerate(req.issues))
    text = f"ISSUES:\n{issues}\n\n=== {req.file_base}.h ===\n{req.cpp_header}\n\n=== {req.file_base}.cpp ===\n{req.cpp_source}"
    await record_usage(user["user_id"], key, provider, model, "fix")
    try:
        raw = await asyncio.wait_for(chat.send_message(UserMessage(text=text)), timeout=55)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="The model took too long to write the fix. Try again, or fix fewer issues at once.")
    except Exception as exc:
        logging.error("Fix failed: %s", str(exc).replace(key, "***")[:300])
        raise HTTPException(status_code=502, detail=classify_error(exc, model)[1].replace(key, "***"))
    files = {".h": req.cpp_header, ".cpp": req.cpp_source}
    try:
        edits = extract_json(raw)["edits"]
        if not isinstance(edits, list):
            raise ValueError("edits is not a list")
        applied = apply_edits(files, edits[:15])
    except Exception as exc:
        logging.warning("Unusable fix patch: %s", exc)
        raise HTTPException(status_code=422, detail={"code": "patch_failed", "message": "The AI's patch didn't match the current code, so nothing was changed. Try again."})
    if not applied or (files[".h"] == req.cpp_header and files[".cpp"] == req.cpp_source):
        raise HTTPException(status_code=422, detail={"code": "no_changes", "message": "The AI didn't propose any changes for these issues."})
    return {"cpp_header": files[".h"], "cpp_source": files[".cpp"], "changes": applied, "model": model}


TESTS_PROMPT = """You write Unreal Engine 5.4 automation tests. Given a component's .h/.cpp, write ONE C++ file of Automation Spec tests (BEGIN_DEFINE_SPEC / END_DEFINE_SPEC / Describe / It) that check its core behaviour, e.g. damage lowers health, values clamp at 0 and at max, regen stops at max, events fire.
Rules:
- Wrap everything in #if WITH_DEV_AUTOMATION_TESTS ... #endif.
- Include "Misc/AutomationTest.h", the component's header (exact file name given), and any engine headers you use.
- Create objects with NewObject<...>() (no world needed). Call only functions and properties that exist in the header. If behaviour needs a world, timers or Tick, test the pure logic you can reach and say so in a comment.
- Spec flags: EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter. Test name prefix: "SystemArchitect.<ClassName>".
- 4 to 8 It() cases with clear names. Use TestEqual/TestTrue/TestFalse with readable messages.
Respond with ONLY raw JSON: {"file_name":"<ClassName>Spec.cpp","code":"...","cases":["short name of each It case"]}"""


class TestsRequest(BaseModel):
    file_base: str = Field(default="System", max_length=120)
    cpp_header: str = Field(..., max_length=40000)
    cpp_source: str = Field(..., max_length=60000)
    project_id: Optional[str] = None


@api_router.post("/ai/tests")
async def generate_tests(
    req: TestsRequest,
    user: dict = Depends(auth.current_user),
    x_llm_provider: str = Header(None),
    x_llm_model: str = Header(None),
    x_llm_key: str = Header(None),
):
    provider, model, key = resolve_llm(x_llm_provider, x_llm_model, x_llm_key)
    if req.project_id:
        await projects.load_project(req.project_id, user, "editor")
    chat = LlmChat(api_key=key, session_id=f"tests-{uuid.uuid4()}", system_message=TESTS_PROMPT) \
        .with_model(provider, model).with_params(max_tokens=12000)
    text = f"Header file name: {req.file_base}.h\n\n=== {req.file_base}.h ===\n{req.cpp_header}\n\n=== {req.file_base}.cpp ===\n{req.cpp_source}"
    await record_usage(user["user_id"], key, provider, model, "tests")
    try:
        raw = await asyncio.wait_for(chat.send_message(UserMessage(text=text)), timeout=55)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="The model took too long to write tests. Try again.")
    except Exception as exc:
        logging.error("Tests failed: %s", str(exc).replace(key, "***")[:300])
        raise HTTPException(status_code=502, detail=classify_error(exc, model)[1].replace(key, "***"))
    try:
        data = extract_json(raw)
        code = data["code"]
        if not isinstance(code, str) or "It(" not in code:
            raise ValueError("no test cases")
    except Exception:
        raise HTTPException(status_code=502, detail="The model's tests couldn't be read. Please try again.")
    name = re.sub(r"[^A-Za-z0-9_]", "", str(data.get("file_name", "")).removesuffix(".cpp")) or f"{req.file_base}Spec"
    return {"file_name": f"{name}.cpp", "code": code, "cases": [str(c)[:120] for c in data.get("cases", [])][:12], "model": model}


@api_router.get("/usage/today")
async def usage_today(fp: str, user: dict = Depends(auth.current_user)):
    day = usage_day()
    rows = await db.llm_usage.aggregate([
        {"$match": {"user_id": user["user_id"], "key_fp": fp[:16], "day": day}},
        {"$group": {"_id": "$model", "count": {"$sum": 1}}},
    ]).to_list(50)
    return {
        "day": day, "resets": "midnight Pacific time",
        "models": {r["_id"]: {"used": r["count"], "free_limit": FREE_DAILY.get(r["_id"])} for r in rows},
        "free_limits": FREE_DAILY,
    }


@api_router.get("/generate/{job_id}")
async def get_job(job_id: str, user: dict = Depends(auth.current_user)):
    job = await db.jobs.find_one({"job_id": job_id, "user_id": user["user_id"]}, {"_id": 0, "user_id": 0})
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
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(teams.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ["CORS_ORIGINS"].split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)
# Gemini puts the user's key in the request URL; keep HTTP client logs quiet so it never hits disk
for noisy in ("httpx", "httpcore", "LiteLLM", "litellm"):
    logging.getLogger(noisy).setLevel(logging.ERROR)
