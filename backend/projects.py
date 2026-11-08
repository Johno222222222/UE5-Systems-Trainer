import io
import secrets
import uuid
from urllib.parse import quote
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field

from auth import current_user
from core import db
from storage import get_object, put_object

router = APIRouter(prefix="/api")
Role = Literal["editor", "viewer"]
RANK = {"viewer": 1, "editor": 2, "owner": 3}
REF_TYPES = {"image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"}
TEXT_EXT = {"h", "hpp", "cpp", "c", "txt", "md", "json", "ini", "cs", "py"}
REF_LIMIT = 10 * 1024 * 1024
PROJECT_FILE_LIMIT = 25 * 1024 * 1024
TEXT_CHARS = 20000


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Access ----------
def role_for(project: dict, user: dict) -> Optional[str]:
    if project["owner_id"] == user["user_id"]:
        return "owner"
    for m in project.get("members", []):
        if m.get("user_id") == user["user_id"] or (user.get("email_verified") and m["email"] == user["email"] and not m.get("user_id")):
            return m["role"]
    return None


async def load_project(project_id: str, user: dict, need: str = "viewer") -> tuple[dict, str]:
    project = await db.projects.find_one({"project_id": project_id, "is_deleted": False}, {"_id": 0})
    role = role_for(project, user) if project else None
    if not role:
        raise HTTPException(status_code=404, detail="Project not found")
    if RANK[role] < RANK[need]:
        raise HTTPException(status_code=403, detail=f"This needs {need} access")
    return project, role


def summary(p: dict, role: str) -> dict:
    return {
        "project_id": p["project_id"], "name": p["name"], "system_name": (p.get("system") or {}).get("system_name"),
        "owner_name": p["owner_name"], "my_role": role, "version": p["version"],
        "updated_at": p["updated_at"], "updated_by_name": p["updated_by_name"],
    }


def detail(p: dict, role: str) -> dict:
    out = {**summary(p, role), "system": p.get("system"), "context": p.get("context") or {}}
    if role == "owner":
        out["members"] = [{"email": m["email"], "role": m["role"], "joined": bool(m.get("user_id")), "invite_token": m["invite_token"]} for m in p.get("members", [])]
        out["public_token"] = p.get("public_token")
    return out


async def snapshot(p: dict) -> None:
    await db.project_versions.insert_one({
        "project_id": p["project_id"], "version": p["version"], "system": p.get("system"),
        "context": p.get("context") or {}, "saved_by_name": p["updated_by_name"], "saved_at": p["updated_at"],
    })


async def claim_references(context: dict, user: dict, project_id: str) -> None:
    ids = [r["file_id"] for r in context.get("references", []) if r.get("file_id")]
    if ids:
        await db.files.update_many(
            {"file_id": {"$in": ids}, "uploaded_by": user["user_id"], "project_id": None},
            {"$set": {"project_id": project_id}},
        )


# ---------- Models ----------
class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    system: dict
    context: dict = Field(default_factory=dict)


class ProjectUpdate(BaseModel):
    system: dict
    context: dict = Field(default_factory=dict)
    base_version: int
    force: bool = False


class RenameIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class MemberIn(BaseModel):
    email: EmailStr
    role: Role


class RoleIn(BaseModel):
    role: Role


class PublicIn(BaseModel):
    enabled: bool


class ImportIn(BaseModel):
    data: dict


# ---------- Projects ----------
@router.get("/projects")
async def list_projects(user: dict = Depends(current_user)):
    proj = {"_id": 0, "system.cpp_header": 0, "system.cpp_source": 0, "system.blueprint_pseudocode": 0, "system.node_graph_nodes": 0}
    mine = await db.projects.find({"owner_id": user["user_id"], "is_deleted": False}, proj).sort("updated_at", -1).to_list(500)
    member_q = [{"members.user_id": user["user_id"]}]
    if user.get("email_verified"):
        member_q.append({"members.email": user["email"]})
    shared = await db.projects.find({"is_deleted": False, "owner_id": {"$ne": user["user_id"]}, "$or": member_q}, proj).sort("updated_at", -1).to_list(500)
    return {
        "mine": [summary(p, "owner") for p in mine],
        "shared": [summary(p, r) for p in shared if (r := role_for(p, user))],
    }


async def create(user: dict, name: str, system: dict, context: dict) -> dict:
    if not isinstance(system, dict) or not system.get("system_name"):
        raise HTTPException(status_code=400, detail="That doesn't look like a generated system")
    project = {
        "project_id": f"proj_{uuid.uuid4().hex[:12]}", "owner_id": user["user_id"], "owner_name": user["name"],
        "name": name.strip()[:120], "system": system, "context": context, "version": 1,
        "updated_at": now(), "updated_by_name": user["name"], "members": [], "public_token": None,
        "is_deleted": False, "created_at": now(),
    }
    await db.projects.insert_one(project)
    project.pop("_id", None)
    await snapshot(project)
    await claim_references(context, user, project["project_id"])
    return detail(project, "owner")


@router.post("/projects")
async def create_project(body: ProjectIn, user: dict = Depends(current_user)):
    return await create(user, body.name, body.system, body.context)


@router.post("/projects/import")
async def import_project(body: ImportIn, user: dict = Depends(current_user)):
    data = body.data
    system = data.get("system") if isinstance(data.get("system"), dict) else data
    context = data.get("context") if isinstance(data.get("context"), dict) else system.get("context", {})
    context = {k: v for k, v in (context or {}).items() if k != "references"}
    name = data.get("name") or system.get("system_name") or "Imported system"
    clean = {k: v for k, v in system.items() if k not in ("context", "saved_at")}
    return await create(user, str(name), clean, context)


@router.get("/projects/{project_id}")
async def get_project(project_id: str, user: dict = Depends(current_user)):
    project, role = await load_project(project_id, user)
    return detail(project, role)


@router.put("/projects/{project_id}")
async def save_project(project_id: str, body: ProjectUpdate, user: dict = Depends(current_user)):
    project, role = await load_project(project_id, user, "editor")
    if project["version"] != body.base_version and not body.force:
        raise HTTPException(status_code=409, detail={
            "message": f"{project['updated_by_name']} saved a newer version while you were editing.",
            "updated_by_name": project["updated_by_name"], "updated_at": project["updated_at"], "version": project["version"],
        })
    if not await db.project_versions.find_one({"project_id": project_id, "version": project["version"]}, {"_id": 1}):
        try:
            await snapshot(project)
        except Exception:
            pass  # a concurrent save already recorded it
    expected = project["version"] if body.force else body.base_version
    res = await db.projects.find_one_and_update(
        {"project_id": project_id, "version": expected},
        {"$set": {"system": body.system, "context": body.context, "updated_at": now(), "updated_by_name": user["name"]}, "$inc": {"version": 1}},
        projection={"_id": 0}, return_document=True,
    )
    if not res:
        latest = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
        raise HTTPException(status_code=409, detail={
            "message": f"{latest['updated_by_name']} saved a newer version while you were editing.",
            "updated_by_name": latest["updated_by_name"], "updated_at": latest["updated_at"], "version": latest["version"],
        })
    try:
        await snapshot(res)
    except Exception:
        pass  # version already recorded by a concurrent backfill
    await claim_references(body.context, user, project_id)
    return detail(res, role)


@router.get("/projects/{project_id}/versions")
async def list_versions(project_id: str, user: dict = Depends(current_user)):
    await load_project(project_id, user)
    rows = await db.project_versions.find(
        {"project_id": project_id}, {"_id": 0, "version": 1, "saved_by_name": 1, "saved_at": 1, "system.system_name": 1}
    ).sort("version", -1).to_list(1000)
    return {"versions": [{"version": r["version"], "saved_by_name": r["saved_by_name"], "saved_at": r["saved_at"],
                          "system_name": (r.get("system") or {}).get("system_name")} for r in rows]}


@router.post("/projects/{project_id}/versions/{version}/restore")
async def restore_version(project_id: str, version: int, user: dict = Depends(current_user)):
    project, role = await load_project(project_id, user, "editor")
    row = await db.project_versions.find_one({"project_id": project_id, "version": version}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Version not found")
    res = await db.projects.find_one_and_update(
        {"project_id": project_id, "version": project["version"]},
        {"$set": {"system": row["system"], "context": row["context"], "updated_at": now(), "updated_by_name": user["name"]}, "$inc": {"version": 1}},
        projection={"_id": 0}, return_document=True,
    )
    if not res:
        raise HTTPException(status_code=409, detail="Someone saved this project just now. Reopen it and try again.")
    try:
        await snapshot(res)
    except Exception:
        pass
    return detail(res, role)


@router.get("/projects/{project_id}/versions/{version}")
async def get_version(project_id: str, version: int, user: dict = Depends(current_user)):
    await load_project(project_id, user)
    row = await db.project_versions.find_one({"project_id": project_id, "version": version}, {"_id": 0})
    if not row:
        raise HTTPException(status_code=404, detail="Version not found")
    return row


@router.patch("/projects/{project_id}")
async def rename_project(project_id: str, body: RenameIn, user: dict = Depends(current_user)):
    await load_project(project_id, user, "editor")
    await db.projects.update_one({"project_id": project_id}, {"$set": {"name": body.name.strip()}})
    return {"ok": True}


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(current_user)):
    await load_project(project_id, user, "owner")
    await db.projects.update_one({"project_id": project_id}, {"$set": {"is_deleted": True, "public_token": None}})
    return {"ok": True}


# ---------- Members & sharing ----------
@router.post("/projects/{project_id}/members")
async def add_member(project_id: str, body: MemberIn, user: dict = Depends(current_user)):
    project, _ = await load_project(project_id, user, "owner")
    email = body.email.lower()
    if email == user["email"]:
        raise HTTPException(status_code=400, detail="You already own this project")
    if any(m["email"] == email for m in project["members"]):
        await db.projects.update_one({"project_id": project_id, "members.email": email}, {"$set": {"members.$.role": body.role}})
    else:
        member = {"email": email, "role": body.role, "user_id": None, "invite_token": secrets.token_urlsafe(24), "added_at": now()}
        await db.projects.update_one({"project_id": project_id}, {"$push": {"members": member}})
    project, _ = await load_project(project_id, user, "owner")
    return detail(project, "owner")


@router.patch("/projects/{project_id}/members/{email}")
async def change_role(project_id: str, email: str, body: RoleIn, user: dict = Depends(current_user)):
    await load_project(project_id, user, "owner")
    await db.projects.update_one({"project_id": project_id, "members.email": email.lower()}, {"$set": {"members.$.role": body.role}})
    project, _ = await load_project(project_id, user, "owner")
    return detail(project, "owner")


@router.delete("/projects/{project_id}/members/{email}")
async def remove_member(project_id: str, email: str, user: dict = Depends(current_user)):
    await load_project(project_id, user, "owner")
    await db.projects.update_one({"project_id": project_id}, {"$pull": {"members": {"email": email.lower()}}})
    project, _ = await load_project(project_id, user, "owner")
    return detail(project, "owner")


@router.post("/invites/{token}/accept")
async def accept_invite(token: str, user: dict = Depends(current_user)):
    project = await db.projects.find_one({"members.invite_token": token, "is_deleted": False}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="This invite link is no longer valid")
    member = next(m for m in project["members"] if m["invite_token"] == token)
    if member["email"] != user["email"]:
        raise HTTPException(status_code=403, detail=f"This invite is for {member['email']}. Sign in with that email to accept it.")
    if member.get("user_id") and member["user_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="This invite has already been used")
    if project["owner_id"] != user["user_id"]:
        await db.projects.update_one({"project_id": project["project_id"], "members.invite_token": token}, {"$set": {"members.$.user_id": user["user_id"]}})
    return {"project_id": project["project_id"], "name": project["name"]}


@router.post("/projects/{project_id}/public")
async def toggle_public(project_id: str, body: PublicIn, user: dict = Depends(current_user)):
    project, _ = await load_project(project_id, user, "owner")
    token = (project.get("public_token") or secrets.token_urlsafe(18)) if body.enabled else None
    await db.projects.update_one({"project_id": project_id}, {"$set": {"public_token": token}})
    return {"public_token": token}


@router.get("/public/{token}")
async def public_view(token: str):
    p = await db.projects.find_one({"public_token": token, "is_deleted": False}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="This share link is off or doesn't exist")
    context = {k: v for k, v in (p.get("context") or {}).items() if k not in ("references", "notes")}
    return {"name": p["name"], "owner_name": p["owner_name"], "updated_at": p["updated_at"], "updated_by_name": p["updated_by_name"], "system": p["system"], "context": context}


# ---------- Files ----------
def file_out(f: dict) -> dict:
    return {k: f.get(k) for k in ("file_id", "filename", "content_type", "size", "kind", "uploaded_by_name", "created_at", "project_id")}


def extract_text(data: bytes, filename: str, content_type: str) -> Optional[str]:
    if content_type == "application/pdf":
        from pypdf import PdfReader
        try:
            reader = PdfReader(io.BytesIO(data))
            return "\n".join((pg.extract_text() or "") for pg in reader.pages[:40])[:TEXT_CHARS]
        except Exception:
            raise HTTPException(status_code=400, detail="Couldn't read that PDF")
    try:
        return data.decode("utf-8")[:TEXT_CHARS]
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Text files must be UTF-8")


@router.post("/files")
async def upload_file(
    file: UploadFile = File(...),
    kind: Literal["reference", "project"] = Form(...),
    project_id: Optional[str] = Form(None),
    user: dict = Depends(current_user),
):
    if kind == "project" and not project_id:
        raise HTTPException(status_code=400, detail="Project files need a saved project")
    if project_id:
        await load_project(project_id, user, "editor")
    filename = (file.filename or "file").strip()
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    ctype = file.content_type or "application/octet-stream"
    data = await file.read()
    limit = REF_LIMIT if kind == "reference" else PROJECT_FILE_LIMIT
    if len(data) > limit:
        raise HTTPException(status_code=413, detail=f"File is larger than {limit // (1024 * 1024)} MB")
    text = None
    if kind == "reference":
        if ext in TEXT_EXT:
            ctype = "text/plain"
        elif ctype not in REF_TYPES:
            raise HTTPException(status_code=400, detail="References can be images, PDFs, or code/text files (.h .cpp .txt .md .json)")
        if not ctype.startswith("image/"):
            text = extract_text(data, filename, ctype)
    file_id = f"file_{uuid.uuid4().hex[:12]}"
    stored = await put_object(f"{kind}/{user['user_id']}/{file_id}.{ext or 'bin'}", data, ctype)
    record = {
        "file_id": file_id, "storage_path": stored["path"], "filename": filename, "content_type": ctype,
        "size": len(data), "kind": kind, "project_id": project_id, "uploaded_by": user["user_id"],
        "uploaded_by_name": user["name"], "text": text, "is_deleted": False, "created_at": now(),
    }
    await db.files.insert_one(record)
    return file_out(record)


async def accessible_file(file_id: str, user: dict, need: str = "viewer") -> dict:
    f = await db.files.find_one({"file_id": file_id, "is_deleted": False}, {"_id": 0})
    if not f:
        raise HTTPException(status_code=404, detail="File not found")
    if f["uploaded_by"] == user["user_id"] and not f.get("project_id"):
        return f
    if f.get("project_id"):
        await load_project(f["project_id"], user, need)
        return f
    raise HTTPException(status_code=404, detail="File not found")


@router.get("/projects/{project_id}/files")
async def list_files(project_id: str, user: dict = Depends(current_user)):
    await load_project(project_id, user)
    files = await db.files.find({"project_id": project_id, "kind": "project", "is_deleted": False}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"files": [file_out(f) for f in files]}


@router.get("/files/{file_id}")
async def download_file(file_id: str, user: dict = Depends(current_user)):
    f = await accessible_file(file_id, user)
    data, _ = await get_object(f["storage_path"])
    ascii_name = f["filename"].encode("ascii", "ignore").decode().replace('"', "") or "download"
    disposition = f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(f['filename'])}"
    return Response(content=data, media_type=f["content_type"], headers={"Content-Disposition": disposition})


@router.delete("/files/{file_id}")
async def delete_file(file_id: str, user: dict = Depends(current_user)):
    await accessible_file(file_id, user, "editor")
    await db.files.update_one({"file_id": file_id}, {"$set": {"is_deleted": True}})
    return {"ok": True}


async def load_references(file_ids: list[str], user: dict) -> list[dict]:
    out = []
    for fid in file_ids[:5]:
        f = await accessible_file(fid, user)
        if f["kind"] != "reference":
            continue
        if f["content_type"].startswith("image/"):
            data, _ = await get_object(f["storage_path"])
            f["image_bytes"] = data
        out.append(f)
    return out
