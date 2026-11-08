import React, { useState } from "react";
import { toast } from "sonner";
import { Copy, Globe, Link2, Trash2, UserPlus } from "lucide-react";
import Modal from "./Modal";
import { api, errorText } from "../lib/api";

const copy = async (text, label) => {
  await navigator.clipboard.writeText(text);
  toast.success(`${label} copied`);
};
const selCls = "bg-[var(--bg-main)] border border-[var(--border)] rounded-md px-2 py-1 text-[11px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--unreal-orange)]";

export default function ShareModal({ project, onUpdate, onClose }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const base = `/projects/${project.project_id}`;
  const origin = window.location.origin;

  const call = async (fn) => {
    setBusy(true);
    try {
      const { data } = await fn();
      onUpdate(data);
      return data;
    } catch (e) {
      toast.error(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const add = async (e) => {
    e.preventDefault();
    const data = await call(() => api.post(`${base}/members`, { email, role }));
    if (data) {
      toast.success(`Invited ${email}`, {
        description: data.emailed === false
          ? "The invite email couldn't be sent. Copy their invite link below and send it yourself."
          : data.emailed ? "We emailed them an invite link. They'll also see it under Shared with me after signing in." : "Role updated.",
      });
      setEmail("");
    }
  };
  const togglePublic = () => call(async () => {
    const { data } = await api.post(`${base}/public`, { enabled: !project.public_token });
    return { data: { ...project, public_token: data.public_token } };
  });

  return (
    <Modal title={`Share · ${project.name}`} onClose={onClose} testId="share-modal">
      <form onSubmit={add} className="flex gap-2 mb-4">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@studio.com" aria-label="Invite email"
          className="flex-1 bg-[var(--bg-main)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-[12px] font-mono outline-none focus:border-[var(--unreal-orange)]" data-testid="invite-email-input" />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Invite role" className={selCls} data-testid="invite-role-select">
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
        <button className="ue-btn ue-btn-primary" disabled={busy} data-testid="invite-submit-button"><UserPlus size={13} /> Invite</button>
      </form>

      <div className="eyebrow mb-2">People with access</div>
      <div className="space-y-1.5 mb-5" data-testid="member-list">
        <div className="panel p-2 text-[12px] font-mono flex justify-between"><span>You</span><span className="text-[var(--unreal-orange)] uppercase text-[10.5px]">Owner</span></div>
        {(project.members || []).map((m) => (
          <div key={m.email} className="panel p-2 flex items-center gap-2" data-testid={`member-row-${m.email}`}>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-mono truncate">{m.email}</div>
              <div className="text-[10px] font-mono text-[var(--text-muted)]">{m.joined ? "Joined" : "Invited · not joined yet"}</div>
            </div>
            <button type="button" className="ue-btn !py-1 !px-2 !text-[10.5px]" onClick={() => copy(`${origin}/invite/${m.invite_token}`, "Invite link")} data-testid={`copy-invite-${m.email}`}><Link2 size={11} /> Invite link</button>
            <select value={m.role} disabled={busy} onChange={(e) => call(() => api.patch(`${base}/members/${encodeURIComponent(m.email)}`, { role: e.target.value }))} aria-label={`Role for ${m.email}`} className={selCls} data-testid={`member-role-${m.email}`}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button type="button" disabled={busy} onClick={() => call(() => api.delete(`${base}/members/${encodeURIComponent(m.email)}`))} aria-label={`Remove ${m.email}`} className="text-[var(--text-muted)] hover:text-[var(--accent-red)]" data-testid={`member-remove-${m.email}`}><Trash2 size={13} /></button>
          </div>
        ))}
      </div>

      <div className="panel p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe size={14} className={project.public_token ? "text-[var(--cpp-green)]" : "text-[var(--text-muted)]"} />
            <div>
              <div className="font-sub text-[13px] font-semibold">View-only link</div>
              <div className="text-[10.5px] font-mono text-[var(--text-muted)]">Anyone with the link can view, copy and export. Files stay private.</div>
            </div>
          </div>
          <button type="button" role="switch" aria-checked={!!project.public_token} aria-label="Public view-only link" disabled={busy} onClick={togglePublic} data-testid="public-link-toggle"
            className={`relative h-5 w-9 rounded-full transition-colors ${project.public_token ? "bg-[var(--cpp-green)]" : "bg-[var(--surface-hover)]"}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${project.public_token ? "translate-x-[18px]" : "translate-x-0.5"}`} />
          </button>
        </div>
        {project.public_token && (
          <div className="flex gap-2 mt-3">
            <input readOnly value={`${origin}/share/${project.public_token}`} aria-label="Public link" className="flex-1 bg-[var(--bg-main)] border border-[var(--border)] rounded-md px-2 py-1 text-[11px] font-mono text-[var(--text-secondary)]" data-testid="public-link-value" />
            <button type="button" className="ue-btn !py-1" onClick={() => copy(`${origin}/share/${project.public_token}`, "Share link")} data-testid="copy-public-link"><Copy size={12} /> Copy</button>
          </div>
        )}
      </div>
    </Modal>
  );
}
