import React, { useState } from "react";
import { Cpu, LogIn, UserPlus } from "lucide-react";
import { api, errorText } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export function AuthShell({ children }) {
  return (
    <div className="bp-grid h-full w-full flex items-center justify-center p-6 overflow-auto">
      <div className="panel w-full max-w-[420px] p-8 glow-orange-soft">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-10 w-10 rounded-md border border-[var(--unreal-orange)] bg-[rgba(255,107,0,0.08)] flex items-center justify-center">
            <Cpu size={18} className="text-[var(--unreal-orange)]" />
          </div>
          <div>
            <div className="font-display text-[20px] font-extrabold uppercase tracking-wider leading-none">UE5 System Architect</div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest mt-1">Modular · AI-driven · Blueprint + C++</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputCls = "w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-md px-3 py-2 text-[13px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--unreal-orange)]";

export default function Login() {
  const { setUser } = useAuth();
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const google = () => {
    sessionStorage.setItem("ue5_google_pending", "1");
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + window.location.pathname;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = mode === "signup" ? form : { email: form.email, password: form.password };
      const { data } = await api.post(mode === "signup" ? "/auth/register" : "/auth/login", body);
      setUser(data);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <AuthShell>
      <button className="ue-btn w-full justify-center !py-2.5" onClick={google} data-testid="google-login-button">
        <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        Continue with Google
      </button>
      <div className="flex items-center gap-3 my-5"><div className="h-px flex-1 bg-[var(--border)]" /><span className="eyebrow">or email</span><div className="h-px flex-1 bg-[var(--border)]" /></div>
      <form onSubmit={submit} className="space-y-3" data-testid="email-auth-form">
        {mode === "signup" && (
          <input className={inputCls} placeholder="Your name" value={form.name} onChange={set("name")} maxLength={80} aria-label="Name" data-testid="auth-name-input" />
        )}
        <input className={inputCls} type="email" required placeholder="you@studio.com" value={form.email} onChange={set("email")} aria-label="Email" data-testid="auth-email-input" />
        <input className={inputCls} type="password" required minLength={mode === "signup" ? 8 : undefined} placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"} value={form.password} onChange={set("password")} aria-label="Password" data-testid="auth-password-input" />
        {error && <div className="text-[12px] font-mono text-[var(--accent-red)]" data-testid="auth-error">{error}</div>}
        <button type="submit" className="ue-btn ue-btn-primary w-full justify-center" disabled={busy} data-testid="auth-submit-button">
          {mode === "signup" ? <><UserPlus size={14} /> Create account</> : <><LogIn size={14} /> Sign in</>}
        </button>
      </form>
      <div className="flex justify-between mt-4 text-[12px] font-mono">
        <button className="text-[var(--unreal-orange)] hover:underline" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }} data-testid="auth-mode-toggle">
          {mode === "signup" ? "Have an account? Sign in" : "New here? Create an account"}
        </button>
        <button className="text-[var(--text-muted)] hover:text-[var(--text-primary)]" onClick={() => setShowForgot((v) => !v)} data-testid="forgot-password-link">Forgot password?</button>
      </div>
      {showForgot && (
        <div className="mt-3 text-[11.5px] font-mono text-[var(--text-secondary)] panel p-3" data-testid="forgot-password-help">
          Ask the app owner for a reset link. They can create one from their account menu, and it works for 1 hour. If you signed up with Google, just use Continue with Google.
        </div>
      )}
    </AuthShell>
  );
}
