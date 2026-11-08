import re
def edit(p, pairs):
    s=open(p).read()
    for a,b in pairs:
        assert a in s, (p, a[:70]); s=s.replace(a,b,1)
    open(p,'w').write(s)

edit('/app/backend/emailer.py', [
 ('''    return f"https://{request.headers.get('x-forwarded-host') or request.headers['host']}".split(",")[0].strip()''',
  '''    # Only the Host header: the ingress routes on it, so it is always this app's own domain
    return f"https://{request.headers['host'].split(',')[0].strip()}"'''),
 ('''    _assert_safe_email(subject, html)
    payload''','''    try:
        _assert_safe_email(subject, html)
    except ValueError as e:
        logger.error("Email blocked by safety gate: %s", e)
        return False
    payload'''),
])
edit('/app/backend/teams.py', [
 ('''        await db.teams.update_one({"team_id": team_id}, {"$push": {"members": {"email": email, "role": body.role, "user_id": None, "invite_token": token, "added_at": now()}}})
        emailed = await''','''        res = await db.teams.update_one({"team_id": team_id, "members.email": {"$ne": email}}, {"$push": {"members": {"email": email, "role": body.role, "user_id": None, "invite_token": token, "added_at": now()}}})
        emailed = None if not res.modified_count else await'''),
])
edit('/app/backend/projects.py', [
 ('''        await db.projects.update_one({"project_id": project_id}, {"$push": {"members": member}})
        emailed = await''','''        res = await db.projects.update_one({"project_id": project_id, "members.email": {"$ne": email}}, {"$push": {"members": member}})
        emailed = None if not res.modified_count else await'''),
 ('''    added: List[str] = Field(default_factory=list, max_length=400)
''','''    added: List[str] = Field(default_factory=list, max_length=400)
    ctx_before: Optional[str] = Field(default=None, max_length=2000)
    ctx_after: Optional[str] = Field(default=None, max_length=2000)
    truncated: bool = False
'''),
])
edit('/app/backend/server.py', [
 ('''        if not isinstance(code, str) or "It(" not in code:''','''        if not isinstance(code, str) or "It(" not in code or not re.search(r"BEGIN_DEFINE_SPEC|IMPLEMENT_\\w*AUTOMATION_TEST", code):'''),
])
edit('/app/frontend/src/lib/fixLog.js', [
 ('''  return { file, start: p + 1, removed: a.slice(p, a.length - s).slice(0, MAX), added: b.slice(p, b.length - s).slice(0, MAX) };''',
  '''  const removed = a.slice(p, a.length - s);
  const added = b.slice(p, b.length - s);
  return {
    file, start: p + 1, removed: removed.slice(0, MAX), added: added.slice(0, MAX),
    ctx_before: p > 0 ? a[p - 1] : null, ctx_after: s > 0 ? a[a.length - s] : null,
    truncated: removed.length > MAX || added.length > MAX,
  };'''),
 ('''    const at = (i) => h.added.every((l, k) => lines[i + k] === l);''','''    if (h.truncated) return null;
    // Neighbouring lines must match too, so pure insertions/deletions land in the right spot
    const at = (i) => h.added.every((l, k) => lines[i + k] === l)
      && (h.ctx_before == null || lines[i - 1] === h.ctx_before)
      && (h.ctx_after == null || lines[i + h.added.length] === h.ctx_after);'''),
 ('''      if (hits.length !== 1 || !h.added.length) return null;''','''      if (hits.length !== 1) return null;'''),
])
edit('/app/frontend/src/lib/unrealExtras.js', [
 ('''export function blueprintClipboard(system) {''','''export function blueprintClipboard(system, module = null) {'''),
 ('''    classPath: `/Script/${moduleName(system)}.${cls.slice(1)}`,''','''    classPath: `/Script/${module || moduleName(system)}.${cls.slice(1)}`,'''),
])
edit('/app/frontend/src/lib/zipExport.js', [
 ('''blueprintClipboard(system).text);''','''blueprintClipboard(system, module).text);'''),
])
edit('/app/frontend/src/components/ProjectsPanel.jsx', [
 ('''      {lists.mine.length + lists.shared.length >= 2 && (''','''      {lists.mine.length + lists.shared.length + lists.team.length >= 2 && ('''),
])
edit('/app/frontend/src/components/FixReviewModal.jsx', [
 ('''export default function FixReviewModal({ fix, system, base, onAccept, onDiscard, onRetry, onRegenerate, progress, discardLabel, acceptLabel, footnote }) {''',
  '''export default function FixReviewModal({ fix, system, base, onAccept, onDiscard, onCancel, onRetry, onRegenerate, progress, discardLabel, acceptLabel, footnote }) {'''),
 ('''onClose={onDiscard} testId="fix-modal"''','''onClose={onCancel || onDiscard} testId="fix-modal"'''),
 ('''<button className="ue-btn ue-btn-primary" onClick={onAccept} data-testid="fix-accept">''','''<button className="ue-btn ue-btn-primary" onClick={onAccept} disabled={fix.saving} data-testid="fix-accept">'''),
])
edit('/app/frontend/src/components/BundleModal.jsx', [
 ('''  const acceptBatchFix = async () => {
    const b = batch;''','''  const acceptBatchFix = async () => {
    const b = batch;
    if (b.fix.saving) return;
    setBatch({ ...b, fix: { ...b.fix, saving: true } });'''),
])
edit('/app/frontend/src/pages/Workspace.jsx', [
 ('''onAccept={acceptFix} onRetry={() => runFix(fix.list, fix.thenExport)}''','''onAccept={acceptFix} onRetry={() => runFix(fix.list, fix.thenExport, fix.target)} onCancel={() => setFix(null)}'''),
 ('''      setSaveNote("");
      setFixNotes([]);
      setFixLog([]);''','''      if ((projectRef.current?.project_id || null) === savingFor || !savingFor) {
        setSaveNote("");
        setFixNotes([]);
        setFixLog([]);
      }'''),
 ('''      built = await build(project?.name || result.system_name, system, { ...context, references: undefined }, checked, report);''','''      if (sys.tests?.code) checked = [...checked, ...testIssues(sys).map((i) => ({ ...i, file: `tests ${i.file}` }))];
      built = await build(project?.name || result.system_name, system, { ...context, references: undefined }, checked, report);'''),
 ('''      const checked = override ? checkSystem(override)''','''      let checked = override ? checkSystem(override)'''),
])
print("ok")
