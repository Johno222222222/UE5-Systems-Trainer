import secrets
import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field

from auth import current_user
from core import db
import emailer

router = APIRouter(prefix="/api")
RANK = {"viewer": 1, "editor": 2, "owner": 3}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def is_member(m: dict, user: dict) -> bool:
    return m.get("user_id") == user["user_id"] or (bool(user.get("email_verified")) and m["email"] == user["email"] and not m.get("user_id"))


def team_role(team: dict, user: dict) -> Optional[str]:
    if team["owner_id"] == user["user_id"]:
        return "owner"
    return next((m["role"] for m in team.get("members", []) if is_member(m, user)), None)


async def my_teams(user: dict) -> list:
    q = [{"owner_id": user["user_id"]}, {"members.user_id": user["user_id"]}]
    if user.get("email_verified"):
        q.append({"members.email": user["email"]})
    rows = await db.teams.find({"$or": q}, {"_id": 0}).sort("created_at", 1).to_list(100)
    return [t for t in rows if team_role(t, user)]


async def project_roles_via_team(user: dict) -> dict:
    # team_id -> role this user gets on that team's projects (team owners edit, they don't own)
    return {t["team_id"]: ("editor" if team_role(t, user) == "owner" else team_role(t, user)) for t in await my_teams(user)}


def view(team: dict, user: dict) -> dict:
    role = team_role(team, user)
    return {
        "team_id": team["team_id"], "name": team["name"], "owner_name": team["owner_name"], "my_role": role,
        "members": [{"email": m["email"], "role": m["role"], "joined": bool(m.get("user_id")),
                     **({"invite_token": m["invite_token"]} if role == "owner" else {})} for m in team.get("members", [])],
    }


async def load_team(team_id: str, user: dict, need: str = "viewer") -> dict:
    team = await db.teams.find_one({"team_id": team_id}, {"_id": 0})
    role = team_role(team, user) if team else None
    if not role:
        raise HTTPException(status_code=404, detail="Team not found")
    if RANK[role] < RANK[need]:
        raise HTTPException(status_code=403, detail="Only the team owner can do that")
    return team


class TeamIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)


class TeamMemberIn(BaseModel):
    email: EmailStr
    role: Literal["editor", "viewer"]


class TeamRoleIn(BaseModel):
    role: Literal["editor", "viewer"]


class MoveIn(BaseModel):
    team_id: Optional[str] = None


async def send_invite(request: Request, inviter: dict, email: str, what: str, link_path: str) -> bool:
    link = f"{emailer.app_url(request)}{link_path}"
    html = emailer.template(
        f"{inviter['name']} invited you to {what}",
        [f"{inviter['name']} ({inviter['email']}) added you to {what} in UE5 System Architect.",
         "Open the link and sign in (or create an account) with this email address to join."],
        "Open the invite", link)
    return await emailer.send_email(to=email, subject=f"You're invited to {what}"[:150], html=html)


@router.get("/teams")
async def list_teams(user: dict = Depends(current_user)):
    return {"teams": [view(t, user) for t in await my_teams(user)]}


@router.post("/teams")
async def create_team(body: TeamIn, user: dict = Depends(current_user)):
    team = {"team_id": f"team_{uuid.uuid4().hex[:12]}", "name": body.name.strip(), "owner_id": user["user_id"],
            "owner_name": user["name"], "members": [], "created_at": now()}
    await db.teams.insert_one(team)
    return view(team, user)


@router.patch("/teams/{team_id}")
async def rename_team(team_id: str, body: TeamIn, user: dict = Depends(current_user)):
    await load_team(team_id, user, "owner")
    await db.teams.update_one({"team_id": team_id}, {"$set": {"name": body.name.strip()}})
    return view(await load_team(team_id, user), user)


@router.delete("/teams/{team_id}")
async def delete_team(team_id: str, user: dict = Depends(current_user)):
    await load_team(team_id, user, "owner")
    await db.projects.update_many({"team_id": team_id}, {"$set": {"team_id": None}})
    await db.bundle_presets.update_many({"team_id": team_id}, {"$set": {"team_id": None}})
    await db.teams.delete_one({"team_id": team_id})
    return {"ok": True}


@router.post("/teams/{team_id}/members")
async def add_team_member(team_id: str, body: TeamMemberIn, request: Request, user: dict = Depends(current_user)):
    team = await load_team(team_id, user, "owner")
    email = body.email.lower()
    if email == user["email"]:
        raise HTTPException(status_code=400, detail="You already own this team")
    existing = next((m for m in team["members"] if m["email"] == email), None)
    emailed = None
    if existing:
        await db.teams.update_one({"team_id": team_id, "members.email": email}, {"$set": {"members.$.role": body.role}})
    else:
        token = secrets.token_urlsafe(24)
        res = await db.teams.update_one({"team_id": team_id, "members.email": {"$ne": email}}, {"$push": {"members": {"email": email, "role": body.role, "user_id": None, "invite_token": token, "added_at": now()}}})
        emailed = None if not res.modified_count else await send_invite(request, user, email, f'the team "{team["name"]}"', f"/team-invite/{token}")
    return {**view(await load_team(team_id, user), user), "emailed": emailed}


@router.patch("/teams/{team_id}/members/{email}")
async def change_team_role(team_id: str, email: str, body: TeamRoleIn, user: dict = Depends(current_user)):
    await load_team(team_id, user, "owner")
    await db.teams.update_one({"team_id": team_id, "members.email": email.lower()}, {"$set": {"members.$.role": body.role}})
    return view(await load_team(team_id, user), user)


@router.delete("/teams/{team_id}/members/{email}")
async def remove_team_member(team_id: str, email: str, user: dict = Depends(current_user)):
    await load_team(team_id, user, "owner")
    await db.teams.update_one({"team_id": team_id}, {"$pull": {"members": {"email": email.lower()}}})
    return view(await load_team(team_id, user), user)


@router.post("/team-invites/{token}/accept")
async def accept_team_invite(token: str, user: dict = Depends(current_user)):
    team = await db.teams.find_one({"members.invite_token": token}, {"_id": 0})
    if not team:
        raise HTTPException(status_code=404, detail="This invite link is no longer valid")
    member = next(m for m in team["members"] if m["invite_token"] == token)
    if member.get("user_id") and member["user_id"] != user["user_id"]:
        raise HTTPException(status_code=409, detail="This invite was already used by another account")
    if member["email"] != user["email"]:
        raise HTTPException(status_code=403, detail=f"This invite is for {member['email']}. Sign in with that email to join.")
    await db.teams.update_one({"team_id": team["team_id"], "members.invite_token": token}, {"$set": {"members.$.user_id": user["user_id"]}})
    return {"team_id": team["team_id"], "name": team["name"]}


async def check_target_team(team_id: Optional[str], user: dict) -> None:
    if team_id and not team_role(await load_team(team_id, user), user):
        raise HTTPException(status_code=403, detail="You're not in that team")


@router.post("/projects/{project_id}/team")
async def move_project(project_id: str, body: MoveIn, user: dict = Depends(current_user)):
    project = await db.projects.find_one({"project_id": project_id, "is_deleted": False}, {"_id": 0, "owner_id": 1})
    if not project or project["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the project's owner can move it")
    await check_target_team(body.team_id, user)
    await db.projects.update_one({"project_id": project_id}, {"$set": {"team_id": body.team_id}})
    return {"team_id": body.team_id}


@router.post("/bundle-presets/{preset_id}/team")
async def move_preset(preset_id: str, body: MoveIn, user: dict = Depends(current_user)):
    await check_target_team(body.team_id, user)
    res = await db.bundle_presets.update_one({"preset_id": preset_id, "user_id": user["user_id"]}, {"$set": {"team_id": body.team_id}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Preset not found")
    return {"team_id": body.team_id}
