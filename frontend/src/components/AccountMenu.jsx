import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { KeyRound, LogOut, User } from "lucide-react";
import Modal from "./Modal";
import { api, errorText } from "../lib/api";
import { useAuth } from "../context/AuthContext";

function ResetLinkModal({ onClose }) {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/admin/reset-link", { email });
      setLink(`${window.location.origin}/reset/${data.token}`);
    } catch (err) { toast.error(errorText(err)); }
  };
  return (
    <Modal title="Create password reset link" onClose={onClose} testId="reset-link-modal" width={460}>
      <form onSubmit={submit} className="flex gap-2">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@studio.com" aria-label="User email"
          className="flex-1 bg-[var(--bg-main)] border border-[var(--border)] rounded-md px-2.5 py-1.5 text-[12px] font-mono outline-none focus:border-[var(--unreal-orange)]" data-testid="reset-link-email" />
        <button className="ue-btn ue-btn-primary" data-testid="reset-link-submit">Create</button>
      </form>
      {link && (
        <div className="mt-3 space-y-2">
          <input readOnly value={link} aria-label="Reset link" className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-md px-2 py-1 text-[11px] font-mono" data-testid="reset-link-value" />
          <button className="ue-btn w-full justify-center" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Reset link copied"))} data-testid="reset-link-copy">Copy link · valid for 1 hour, single use</button>
        </div>
      )}
    </Modal>
  );
}

export default function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [reset, setReset] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button className="ue-btn !px-2" onClick={() => setOpen((v) => !v)} aria-label="Account menu" aria-expanded={open} data-testid="account-menu-button">
        {user.picture ? <img src={user.picture} alt="" className="h-5 w-5 rounded-full" /> : <User size={14} />}
        <span className="hidden xl:inline max-w-[120px] truncate">{user.name}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-40 panel w-[240px] p-1.5 shadow-2xl" data-testid="account-menu">
          <div className="px-2.5 py-2 border-b border-[var(--border-soft)] mb-1">
            <div className="font-sub text-[13px] font-semibold truncate">{user.name}</div>
            <div className="text-[10.5px] font-mono text-[var(--text-muted)] truncate">{user.email}</div>
            {user.role === "admin" && <span className="chip active !py-0 !text-[9.5px] mt-1">ADMIN</span>}
          </div>
          {user.role === "admin" && (
            <button className="w-full text-left px-2.5 py-1.5 rounded text-[12px] font-mono hover:bg-[var(--surface-hover)] flex items-center gap-2" onClick={() => { setReset(true); setOpen(false); }} data-testid="admin-reset-link-button">
              <KeyRound size={13} /> Password reset link
            </button>
          )}
          <button className="w-full text-left px-2.5 py-1.5 rounded text-[12px] font-mono hover:bg-[var(--surface-hover)] flex items-center gap-2 text-[var(--accent-red)]" onClick={logout} data-testid="logout-button">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      )}
      {reset && <ResetLinkModal onClose={() => setReset(false)} />}
    </div>
  );
}
