import React, { useState } from "react";
import { toast } from "sonner";
import { Link2, Trash2, UserPlus, Users } from "lucide-react";
import Modal from "./Modal";
import { api, errorText } from "../lib/api";

const field = "bg-[var(--bg-main)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-[12px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--unreal-orange)]";

// team: null = create a new team
export default function TeamModal({ team: initial, onClose, onChanged }) {
  const [team, setTeam] = useState(initial);
  const [name, setName] = useState(initial?.name || "");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const owner = team?.my_role === "owner";

  const call = async (fn, ok) => {
    setBusy(true);
    try {
      const { data } = await fn();
      if (data?.team_id) setTeam(data);
      onChanged();
      if (ok) ok(data);
      return data;
    } catch (e) { toast.error(errorText(e)); return null; } finally { setBusy(false); }
  };

  const save = (e) => {
    e.preventDefault();
    if (!team) call(() => api.post("/teams", { name }), (d) => toast.success(`Created team "${d.name}"`, { description: "Invite teammates, then move projects into it." }));
    else call(() => api.patch(`/teams/${team.team_id}`, { name }), () => toast.success("Team renamed"));
  };
  const invite = (e) => {
    e.preventDefault();
    call(() => api.post(`/teams/${team.team_id}/members`, { email, role }), (d) => {
      toast.success(`Added ${email}`, {
        description: d.emailed === false ? "The invite email couldn't be sent. Copy their invite link and send it yourself." : d.emailed ? "We emailed them an invite link." : "Role updated.",
      });
      setEmail("");
    });
  };
  const copyLink = async (m) => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/team-invite/${m.invite_token}`); toast.success("Invite link copied"); }
    catch { toast.error("Your browser blocked the clipboard"); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete the team "${team.name}"? Its projects go back to their creators; nothing is deleted.`)) return;
    if (await call(() => api.delete(`/teams/${team.team_id}`))) { toast.success("Team deleted"); onClose(); }
  };

  return (
    <Modal title={team ? `Team: ${team.name}` : "Create a team"} onClose={onClose} testId="team-modal" width={560}>
      {(!team || owner) && (
        <form onSubmit={save} className="flex gap-2 mb-4">
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="Team name, e.g. Ironclad Studio" className={`flex-1 ${field}`} aria-label="Team name" data-testid="team-name-input" />
          <button className="ue-btn ue-btn-primary" disabled={busy || !name.trim()} data-testid="team-save-button">{team ? "Rename" : "Create team"}</button>
        </form>
      )}
      {team && (
        <>
          <div className="eyebrow mb-2 flex items-center gap-1.5"><Users size={11} /> Members · owner {team.owner_name}</div>
          {owner && (
            <form onSubmit={invite} className="flex gap-2 mb-3">
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@studio.com" className={`flex-1 ${field}`} aria-label="Teammate email" data-testid="team-invite-email" />
              <select value={role} onChange={(e) => setRole(e.target.value)} className={field} aria-label="Team role" data-testid="team-invite-role">
                <option value="editor">Editor</option><option value="viewer">Viewer</option>
              </select>
              <button className="ue-btn ue-btn-primary" disabled={busy} data-testid="team-invite-submit"><UserPlus size={13} /> Invite</button>
            </form>
          )}
          <ul className="space-y-1.5 mb-4" data-testid="team-members">
            {team.members.map((m) => (
              <li key={m.email} className="panel p-2 flex items-center gap-2" data-testid={`team-member-${m.email}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-mono truncate">{m.email}</div>
                  <div className="text-[10px] font-mono text-[var(--text-muted)]">{m.joined ? "Joined" : "Invited · not joined yet"}</div>
                </div>
                {owner ? (
                  <>
                    <select value={m.role} onChange={(e) => call(() => api.patch(`/teams/${team.team_id}/members/${encodeURIComponent(m.email)}`, { role: e.target.value }))} className={field} aria-label={`Role for ${m.email}`} data-testid={`team-role-${m.email}`}>
                      <option value="editor">Editor</option><option value="viewer">Viewer</option>
                    </select>
                    {!m.joined && <button type="button" className="ue-btn !py-1 !px-2 !text-[10.5px]" onClick={() => copyLink(m)} data-testid={`team-copy-invite-${m.email}`}><Link2 size={11} /> Link</button>}
                    <button type="button" onClick={() => call(() => api.delete(`/teams/${team.team_id}/members/${encodeURIComponent(m.email)}`))} aria-label={`Remove ${m.email}`} className="text-[var(--text-muted)] hover:text-[var(--accent-red)]" data-testid={`team-remove-${m.email}`}><Trash2 size={13} /></button>
                  </>
                ) : <span className="chip !py-0 !text-[10px] !cursor-default uppercase">{m.role}</span>}
              </li>
            ))}
            {team.members.length === 0 && <li className="text-[11px] font-mono text-[var(--text-muted)]">No members yet.</li>}
          </ul>
          <div className="text-[10.5px] font-mono text-[var(--text-muted)] mb-3">Everyone in the team can open its projects with their team role. Owners move projects in from the project list.</div>
          {owner && <button className="ue-btn !text-[var(--accent-red)] !border-[var(--accent-red)]" onClick={remove} data-testid="team-delete-button"><Trash2 size={13} /> Delete team</button>}
        </>
      )}
    </Modal>
  );
}
