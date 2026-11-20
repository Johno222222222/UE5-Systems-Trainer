import React from "react";
import "@/App.css";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { ShellProvider } from "./shell/ShellContext";
import AppShell from "./shell/AppShell";

export default function App() {
  return (
    <div className="App">
      <Toaster theme="dark" position="bottom-left" offset={16} toastOptions={{ style: { background: "#141923", border: "1px solid #283348", color: "#f1f5f9", fontFamily: "JetBrains Mono, monospace" } }} />
      <BrowserRouter>
        <ShellProvider>
          <AppShell />
        </ShellProvider>
      </BrowserRouter>
    </div>
  );
}
