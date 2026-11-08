p='/app/backend/projects.py'; s=open(p).read()
def r(a,b,cnt=1):
    global s
    assert s.count(a)>=1, a[:70]; s=s.replace(a,b,cnt)
r('''async def snapshot(p: dict, note: str = "") -> None:''','''async def snapshot(p: dict, note: str = "", fixes: Optional[list] = None) -> None:''')
r('''        "note": note.strip()[:200],
    })''','''        "note": note.strip()[:200],
        "fixes": fixes or [],
    })''')
r('''    note: str = Field(default="", max_length=200)


class ProjectUpdate(BaseModel):
    system: dict
    context: dict = Field(default_factory=dict)
    note: str = Field(default="", max_length=200)''','''    note: str = Field(default="", max_length=200)
    fixes: List[FixEntry] = Field(default_factory=list, max_length=20)


class ProjectUpdate(BaseModel):
    system: dict
    context: dict = Field(default_factory=dict)
    note: str = Field(default="", max_length=200)
    fixes: List[FixEntry] = Field(default_factory=list, max_length=20)''')
r('''class ProjectIn(BaseModel):''','''class FixHunk(BaseModel):
    file: Literal[".h", ".cpp"]
    start: int = Field(ge=1)
    removed: List[str] = Field(default_factory=list, max_length=400)
    added: List[str] = Field(default_factory=list, max_length=400)


class FixEntry(BaseModel):
    fix_id: str = Field(max_length=40)
    at: str = Field(max_length=40)
    model: str = Field(default="", max_length=80)
    changes: List[dict] = Field(default_factory=list, max_length=15)
    hunks: List[FixHunk] = Field(default_factory=list, max_length=2)


class ProjectIn(BaseModel):''')
r('''async def create(user: dict, name: str, system: dict, context: dict, note: str = "") -> dict:''','''async def create(user: dict, name: str, system: dict, context: dict, note: str = "", fixes: Optional[list] = None) -> dict:''')
r('''    await snapshot(project, note)''','''    await snapshot(project, note, fixes)''')
r('''    return await create(user, body.name, body.system, body.context, body.note)''','''    return await create(user, body.name, body.system, body.context, body.note, [f.model_dump() for f in body.fixes])''')
r('''        await snapshot(res, body.note)''','''        await snapshot(res, body.note, [f.model_dump() for f in body.fixes])''')
r('''{"$set": {"note": body.note.strip()[:200]}})''','''{"$set": {"note": body.note.strip()[:200], "fixes": [f.model_dump() for f in body.fixes]}})''')
r('''"label": 1, "labeled_by_name": 1, "note": 1, "system.system_name": 1}''','''"label": 1, "labeled_by_name": 1, "note": 1, "fixes": 1, "system.system_name": 1}''')
r('''"labeled_by_name": r.get("labeled_by_name"), "note": r.get("note") or "",''','''"labeled_by_name": r.get("labeled_by_name"), "note": r.get("note") or "", "fixes": r.get("fixes") or [],''')
open(p,'w').write(s)
print("ok")
