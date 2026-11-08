import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api, errorText } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { AuthShell, inputCls } from "./Login";

export function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const done = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const sessionId = new URLSearchParams(location.hash.slice(1)).get("session_id");
    // Only finish sign-ins this browser started (blocks forced logins via crafted links)
    const expected = sessionStorage.getItem("ue5_google_pending");
    const got = new URLSearchParams(location.search).get("gs");
    sessionStorage.removeItem("ue5_google_pending");
    if (!expected || expected !== got) {
      window.history.replaceState(null, "", location.pathname);
      setError("This sign-in wasn't started from this browser.");
      return;
    }
    api.post("/auth/google", { session_id: sessionId })
      .then(({ data }) => {
        setUser(data);
        navigate(location.pathname, { replace: true });
      })
      .catch((e) => setError(errorText(e)));
  }, [location, navigate, setUser]);

  return (
    <AuthShell>
      <div className="font-mono text-[12px] text-[var(--text-secondary)]" data-testid="auth-callback">
        {error ? <span className="text-[var(--accent-red)]">{error} <a href="/" className="underline">Back to sign in</a></span> : "Signing you in…"}
      </div>
    </AuthShell>
  );
}

export function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("Password updated. Sign in with your new password.");
      navigate("/", { replace: true });
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <AuthShell>
      <form onSubmit={submit} className="space-y-3">
        <div className="font-sub font-semibold">Choose a new password</div>
        <input className={inputCls} type="password" required minLength={8} placeholder="New password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="New password" data-testid="reset-password-input" />
        {error && <div className="text-[12px] font-mono text-[var(--accent-red)]" data-testid="reset-error">{error}</div>}
        <button className="ue-btn ue-btn-primary w-full justify-center" data-testid="reset-password-submit">Update password</button>
      </form>
    </AuthShell>
  );
}

export function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const done = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    api.post(`/invites/${token}/accept`)
      .then(({ data }) => {
        toast.success(`You joined "${data.name}"`);
        navigate(`/?project=${data.project_id}`, { replace: true });
      })
      .catch((e) => setError(errorText(e)));
  }, [token, navigate]);
  return (
    <AuthShell>
      <div className="font-mono text-[12px] text-[var(--text-secondary)]" data-testid="invite-accept">
        {error ? <span className="text-[var(--accent-red)]">{error} <a href="/" className="underline">Open workspace</a></span> : "Joining project…"}
      </div>
    </AuthShell>
  );
}

export function TeamInviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const done = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    api.post(`/team-invites/${token}/accept`)
      .then(({ data }) => {
        toast.success(`You joined the team "${data.name}"`, { description: "Its projects are in the Team tab." });
        navigate("/", { replace: true });
      })
      .catch((e) => setError(errorText(e)));
  }, [token, navigate]);
  return (
    <AuthShell>
      <div className="font-mono text-[12px] text-[var(--text-secondary)]" data-testid="team-invite-accept">
        {error ? <span className="text-[var(--accent-red)]">{error} <a href="/" className="underline">Open workspace</a></span> : "Joining team…"}
      </div>
    </AuthShell>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setSent(data.message);
    } catch (err) { toast.error(errorText(err)); } finally { setBusy(false); }
  };
  return (
    <AuthShell>
      <form onSubmit={submit} className="space-y-3" data-testid="forgot-form">
        <div className="font-sub font-semibold text-[15px]">Reset your password</div>
        {sent ? (
          <div className="text-[12px] font-mono text-[var(--cpp-green)]" data-testid="forgot-sent">{sent} The link works once and expires in 1 hour.</div>
        ) : (
          <>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@studio.com" className={inputCls} data-testid="forgot-email-input" />
            <button className="ue-btn ue-btn-primary w-full justify-center" disabled={busy} data-testid="forgot-submit">{busy ? "Sending…" : "Email me a reset link"}</button>
          </>
        )}
        <a href="/" className="block text-[11px] font-mono text-[var(--text-muted)] hover:underline" data-testid="forgot-back">Back to sign in</a>
      </form>
    </AuthShell>
  );
}
