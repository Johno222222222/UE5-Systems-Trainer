import React from "react";
import "@/App.css";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Workspace from "./pages/Workspace";
import PublicView from "./pages/PublicView";
import { AuthCallback, InviteAccept, ResetPassword } from "./pages/AuthPages";

function Gate({ children }) {
  const { user } = useAuth();
  if (user === null) {
    return <div className="bp-grid h-full flex items-center justify-center font-mono text-sm text-[var(--text-muted)]" data-testid="auth-checking">Loading workspace…</div>;
  }
  return user ? children : <Login />;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/share/:token" element={<PublicView />} />
      <Route path="/reset/:token" element={<ResetPassword />} />
      <Route path="/invite/:token" element={<Gate><InviteAccept /></Gate>} />
      <Route path="*" element={<Gate><Workspace /></Gate>} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <Toaster theme="dark" position="top-right" toastOptions={{ style: { background: "#141923", border: "1px solid #283348", color: "#f1f5f9", fontFamily: "JetBrains Mono, monospace" } }} />
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
