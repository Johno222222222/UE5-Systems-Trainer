p='/app/frontend/src/components/ProjectsPanel.jsx'; s=open(p).read()
def r(a,b):
    global s
    assert a in s, a[:70]; s=s.replace(a,b,1)
r('''import PresetsList from "./PresetsList";''','''import PresetsList from "./PresetsList";
import TeamModal from "./TeamModal";''')
r('''  const [lists, setLists] = useState({ mine: [], shared: [] });
  const [tab, setTab] = useState("mine");''','''  const [lists, setLists] = useState({ mine: [], shared: [], team: [] });
  const [tab, setTab] = useState("mine");
  const [teams, setTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState("");
  const [teamModal, setTeamModal] = useState(undefined); // undefined closed, null create, object manage''')
r('''    api.get("/projects").then((r) => setLists(r.data)).catch((e) => toast.error(errorText(e)));
  }, []);''','''    api.get("/projects").then((r) => setLists({ team: [], ...r.data })).catch((e) => toast.error(errorText(e)));
    api.get("/teams").then((r) => {
      setTeams(r.data.teams);
      setActiveTeam((cur) => (r.data.teams.some((t) => t.team_id === cur) ? cur : r.data.teams[0]?.team_id || ""));
    }).catch(() => {});
  }, []);
  const teamName = (id) => teams.find((t) => t.team_id === id)?.name;
  const move = async (p, teamId) => {
    try {
      await api.post(`/projects/${p.project_id}/team`, { team_id: teamId || null });
      toast.success(teamId ? `Moved "${p.name}" into ${teamName(teamId)}` : `"${p.name}" is no longer in a team`);
      load();
    } catch (e) { toast.error(errorText(e)); }
  };''')
r('''  const items = lists[tab];''','''  const items = tab === "team" ? lists.team.filter((p) => p.team_id === activeTeam) : lists[tab];
  const current = teams.find((t) => t.team_id === activeTeam);''')
r('''        {[["mine", "Mine"], ["shared", "Shared with me"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id} data-testid={`projects-tab-${id}`}
            className={`chip flex-1 justify-center ${tab === id ? "active" : ""}`}>
            {id === "shared" && <Users size={11} />} {label} ({lists[id].length})
          </button>
        ))}
      </div>''','''        {[["mine", "Mine"], ["shared", "Shared"], ["team", "Team"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id} data-testid={`projects-tab-${id}`}
            className={`chip flex-1 justify-center ${tab === id ? "active" : ""}`}>
            {id === "shared" && <Users size={11} />} {label} ({id === "team" ? lists.team.filter((p) => p.team_id === activeTeam).length : lists[id].length})
          </button>
        ))}
      </div>
      {tab === "team" && (
        <div className="flex gap-1.5 mb-3" data-testid="team-bar">
          {teams.length > 0 ? (
            <select value={activeTeam} onChange={(e) => setActiveTeam(e.target.value)} aria-label="Team" data-testid="team-switcher"
              className="flex-1 min-w-0 bg-[var(--bg-main)] border border-[var(--border)] rounded-md px-2 py-1 text-[11.5px] font-mono text-[var(--text-primary)]">
              {teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.name} ({t.my_role})</option>)}
            </select>
          ) : <span className="flex-1 text-[11px] font-mono text-[var(--text-muted)] self-center">You're not in a team yet.</span>}
          {current && <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={() => setTeamModal(current)} data-testid="team-manage-button">{current.my_role === "owner" ? "Manage" : "Members"}</button>}
          <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={() => setTeamModal(null)} data-testid="team-create-button">New team</button>
        </div>
      )}''')
r('''          {tab === "mine" ? "No projects yet. Synthesize a system and press Save." : "Nothing shared with you yet."}''','''          {tab === "mine" ? "No projects yet. Synthesize a system and press Save." : tab === "team" ? (current ? "No projects in this team yet. Move one in from the Mine tab." : "Create a team to share all its projects at once.") : "Nothing shared with you yet."}''')
r('''                {tab === "shared" && <span className="uppercase text-[var(--accent-cyan)] mr-1">{p.my_role}</span>}''','''                {tab !== "mine" && <span className="uppercase text-[var(--accent-cyan)] mr-1">{p.my_role}</span>}
                {p.team_id && teamName(p.team_id) && tab !== "team" && <span className="text-[var(--accent-purple)] mr-1" data-testid={`project-team-badge-${p.project_id}`}>⬢ {teamName(p.team_id)} ·</span>}''')
r('''            {p.my_role === "owner" && (
              <button onClick={() => remove(p)}''','''            {p.my_role === "owner" && teams.length > 0 && (
              <select value={p.team_id || ""} onChange={(e) => move(p, e.target.value)} aria-label={`Team for ${p.name}`} title="Move into a team"
                className="w-[22px] bg-transparent text-[var(--text-muted)] text-[11px] cursor-pointer" data-testid={`project-move-${p.project_id}`}>
                <option value="">No team</option>
                {teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.name}</option>)}
              </select>
            )}
            {p.my_role === "owner" && (
              <button onClick={() => remove(p)}''')
r('''      <PresetsList refreshKey={refreshKey}''','''      {teamModal !== undefined && <TeamModal team={teamModal} onClose={() => setTeamModal(undefined)} onChanged={load} />}
      <PresetsList teams={teams} refreshKey={refreshKey}''')
open(p,'w').write(s)
print("ok")
