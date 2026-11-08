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
