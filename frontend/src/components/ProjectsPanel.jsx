import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Combine, FileArchive, FileUp, FolderOpen, PackageSearch, Trash2, Users } from "lucide-react";
import { api, errorText } from "../lib/api";
import PresetsList from "./PresetsList";
import TeamModal from "./TeamModal";

const ago = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
};

export default function ProjectsPanel({ refreshKey, currentId, onOpen, onDeleted, onStack, onBundle, busy }) {
  const [lists, setLists] = useState({ mine: [], shared: [], team: [] });
  const [tab, setTab] = useState("mine");
  const [teams, setTeams] = useState([]);
  const [activeTeam, setActiveTeam] = useState("");
  const [teamModal, setTeamModal] = useState(undefined); // undefined closed, null create, object manage
  const [sel, setSel] = useState([]);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    api.get("/projects").then((r) => setLists({ team: [], ...r.data })).catch((e) => toast.error(errorText(e)));
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
  };
  useEffect(() => { load(); }, [load, refreshKey]);

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}" for everyone it's shared with?`)) return;
    try {
      await api.delete(`/projects/${p.project_id}`);
      toast.success("Project deleted");
      setSel((s) => s.filter((x) => x !== p.project_id));
      onDeleted(p.project_id);
      load();
    } catch (e) { toast.error(errorText(e)); }
  };

  const importFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const { data: proj } = await api.post("/projects/import", { data });
      toast.success(`Imported "${proj.name}"`);
      load();
      onOpen(proj.project_id);
    } catch (err) {
      toast.error("Import failed", { description: err instanceof SyntaxError ? "That file isn't valid JSON" : errorText(err) });
    }
  };

  const toggle = (id) => {
    if (sel.includes(id)) setSel(sel.filter((x) => x !== id));
    else if (sel.length >= 6) toast.message("You can tick up to 6 projects", { description: "Untick one first." });
    else setSel([...sel, id]);
  };
  const stack = async () => {
    if (await onStack(sel)) setSel([]);
  };
  const items = tab === "team" ? lists.team.filter((p) => p.team_id === activeTeam) : lists[tab];
  const current = teams.find((t) => t.team_id === activeTeam);

  return (
    <div className="p-4" data-testid="projects-panel">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PackageSearch size={14} className="text-[var(--unreal-orange)]" />
          <span className="eyebrow">Projects</span>
        </div>
        <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={() => fileRef.current?.click()} data-testid="import-project-button"><FileUp size={12} /> Import</button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={importFile} data-testid="import-project-input" />
      </div>
      <div className="flex gap-1 mb-3">
        {[["mine", "Mine"], ["shared", "Shared"], ["team", "Team"]].map(([id, label]) => (
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
      )}
      {lists.mine.length + lists.shared.length + lists.team.length >= 2 && (
        <div className="flex gap-1.5 mb-2">
          <button className="ue-btn flex-1 justify-center !border-[var(--accent-purple)] !text-[var(--accent-purple)]" onClick={stack} disabled={busy || sel.length < 2 || sel.length > 4} title="Merge into one integrated system with AI" data-testid="stack-systems-button">
            <Combine size={13} /> {sel.length < 2 ? "Tick 2+ to stack" : sel.length > 4 ? "Stack up to 4" : `Stack ${sel.length}`}
          </button>
          <button className="ue-btn flex-1 justify-center" onClick={() => onBundle(sel)} disabled={sel.length < 2} title="Export the ticked projects as one Unreal plugin, one module each" data-testid="bundle-plugin-button">
            <FileArchive size={13} /> {sel.length < 2 ? "Tick 2+ to bundle" : `Bundle ${sel.length} as plugin`}
          </button>
        </div>
      )}
      {items.length === 0 && (
        <div className="text-[11px] font-mono text-[var(--text-muted)] p-2" data-testid="projects-empty">
          {tab === "mine" ? "No projects yet. Synthesize a system and press Save." : tab === "team" ? (current ? "No projects in this team yet. Move one in from the Mine tab." : "Create a team to share all its projects at once.") : "Nothing shared with you yet."}
        </div>
      )}
      <div className="space-y-1.5">
        {items.map((p) => (
          <div key={p.project_id} data-testid={`project-item-${p.project_id}`}
            className={`panel p-2 flex items-center gap-2 ${currentId === p.project_id ? "!border-[var(--unreal-orange)]" : sel.includes(p.project_id) ? "!border-[var(--accent-purple)]" : ""}`}>
            <input type="checkbox" checked={sel.includes(p.project_id)} onChange={() => toggle(p.project_id)} aria-label={`Select ${p.name} for stacking or bundling`} className="accent-[#a855f7]" data-testid={`stack-select-${p.project_id}`} />
            <button onClick={() => onOpen(p.project_id)} className="flex-1 text-left min-w-0" data-testid={`project-open-${p.project_id}`}>
              <div className="font-sub text-[12px] font-semibold truncate flex items-center gap-1.5">
                <FolderOpen size={11} className="shrink-0 text-[var(--text-muted)]" /> {p.name}
              </div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">
                {tab !== "mine" && <span className="uppercase text-[var(--accent-cyan)] mr-1">{p.my_role}</span>}
                {p.team_id && teamName(p.team_id) && tab !== "team" && <span className="text-[var(--accent-purple)] mr-1" data-testid={`project-team-badge-${p.project_id}`}>⬢ {teamName(p.team_id)} ·</span>}
                saved by {p.updated_by_name} · {ago(p.updated_at)}
              </div>
            </button>
            {p.my_role === "owner" && teams.length > 0 && (
              <select value={p.team_id || ""} onChange={(e) => move(p, e.target.value)} aria-label={`Team for ${p.name}`} title="Move into a team"
                className="w-[22px] bg-transparent text-[var(--text-muted)] text-[11px] cursor-pointer" data-testid={`project-move-${p.project_id}`}>
                <option value="">No team</option>
                {teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.name}</option>)}
              </select>
            )}
            {p.my_role === "owner" && (
              <button onClick={() => remove(p)} aria-label={`Delete ${p.name}`} className="text-[var(--text-muted)] hover:text-[var(--accent-red)]" data-testid={`project-delete-${p.project_id}`}><Trash2 size={13} /></button>
            )}
          </div>
        ))}
      </div>
      {teamModal !== undefined && <TeamModal team={teamModal} onClose={() => setTeamModal(undefined)} onChanged={load} />}
      <PresetsList teams={teams} refreshKey={refreshKey} onOpen={(pr) => { setSel(pr.project_ids.slice(0, 6)); onBundle(pr.project_ids, pr); }} />
    </div>
  );
}
