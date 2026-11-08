p='/app/backend/projects.py'; s=open(p).read()
def r(a,b):
    global s
    assert a in s, a[:70]; s=s.replace(a,b,1)
r('''from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile''','''from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile''')
r('''from storage import get_object, put_object''','''from storage import get_object, put_object
import teams''')
r('''    project = await db.projects.find_one({"project_id": project_id, "is_deleted": False}, {"_id": 0})
    role = role_for(project, user) if project else None
    if not role:''','''    project = await db.projects.find_one({"project_id": project_id, "is_deleted": False}, {"_id": 0})
    role = role_for(project, user) if project else None
    if project and project.get("team_id"):
        via = (await teams.project_roles_via_team(user)).get(project["team_id"])
        if via and (not role or RANK[via] > RANK[role]):
            role = via
    if not role:''')
r('''        "auto_fix_export": bool(p.get("auto_fix_export")),
''','''        "auto_fix_export": bool(p.get("auto_fix_export")), "team_id": p.get("team_id"),
''')
r('''    shared = await db.projects.find({"is_deleted": False, "owner_id": {"$ne": user["user_id"]}, "$or": member_q}, proj).sort("updated_at", -1).to_list(500)
    return {
        "mine": [summary(p, "owner") for p in mine],
        "shared": [summary(p, r) for p in shared if (r := role_for(p, user))],
    }''','''    via = await teams.project_roles_via_team(user)
    shared = await db.projects.find({"is_deleted": False, "owner_id": {"$ne": user["user_id"]}, "$or": member_q}, proj).sort("updated_at", -1).to_list(500)
    team_rows = await db.projects.find({"is_deleted": False, "team_id": {"$in": list(via)}}, proj).sort("updated_at", -1).to_list(1000) if via else []

    def best(p):
        direct = role_for(p, user)
        team = via.get(p.get("team_id"))
        return max([x for x in (direct, team) if x], key=lambda x: RANK[x], default=None)

    return {
        "mine": [summary(p, "owner") for p in mine],
        "shared": [summary(p, best(p)) for p in shared if role_for(p, user) and p.get("team_id") not in via],
        "team": [summary(p, best(p)) for p in team_rows],
    }''')
r('''    rows = await db.projects.find({"is_deleted": False, "$or": [{"owner_id": user["user_id"]}, *member_q]}, {"_id": 0, "project_id": 1, "owner_id": 1, "members": 1}).to_list(2000)
    accessible = [p["project_id"] for p in rows if role_for(p, user)]''','''    via = await teams.project_roles_via_team(user)
    rows = await db.projects.find({"is_deleted": False, "$or": [{"owner_id": user["user_id"]}, {"team_id": {"$in": list(via)}}, *member_q]}, {"_id": 0, "project_id": 1, "owner_id": 1, "members": 1, "team_id": 1}).to_list(2000)
    accessible = [p["project_id"] for p in rows if role_for(p, user) or p.get("team_id") in via]''')
r('''async def add_member(project_id: str, body: MemberIn, user: dict = Depends(current_user)):
    project, _ = await load_project(project_id, user, "owner")''','''async def add_member(project_id: str, body: MemberIn, request: Request, user: dict = Depends(current_user)):
    project, _ = await load_project(project_id, user, "owner")
    emailed = None''')
r('''        member = {"email": email, "role": body.role, "user_id": None, "invite_token": secrets.token_urlsafe(24), "added_at": now()}
        await db.projects.update_one({"project_id": project_id}, {"$push": {"members": member}})
    project, _ = await load_project(project_id, user, "owner")
    return detail(project, "owner")''','''        member = {"email": email, "role": body.role, "user_id": None, "invite_token": secrets.token_urlsafe(24), "added_at": now()}
        await db.projects.update_one({"project_id": project_id}, {"$push": {"members": member}})
        emailed = await teams.send_invite(request, user, email, f'the project "{project["name"]}"', f"/invite/{member['invite_token']}")
    project, _ = await load_project(project_id, user, "owner")
    return {**detail(project, "owner"), "emailed": emailed}''')
open(p,'w').write(s)
print("ok")
