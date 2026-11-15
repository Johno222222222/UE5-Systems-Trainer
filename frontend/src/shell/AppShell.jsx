import React, { useState } from "react";
import { sectionById, sectionScreen } from "../lib/shell.mjs";
import { useShell } from "./ShellContext";
import SectionBar from "./SectionBar";
import Home from "./Home";
import EmptySection from "./EmptySection";
import Workspace from "../pages/Workspace";
import Learn from "./Learn";
import References from "./References";
import AboutCopy from "./AboutCopy";

export default function AppShell() {
  const shell = useShell();
  const section = sectionById(shell.section, shell.registry) || sectionById("home", shell.registry);
  const screen = sectionScreen(section, shell.memory);

  const [introOpen, setIntroOpen] = useState(() => {
    try { return !window.localStorage.getItem("ue5_architect_intro_seen"); }
    catch { return false; }
  });
  const dismissIntro = (openStart) => {
    try { window.localStorage.setItem("ue5_architect_intro_seen", "1"); }
    catch { /* a private window can still continue */ }
    setIntroOpen(false);
    if (openStart) shell.openReference("start-here");
  };

  const onEmptyAction = (action) => {
    if (!section) return;
    if (action === "start-new") {
      shell.issue({ type: "new-project" });
      return;
    }
    if (action === "load-saved") {
      shell.focusHome("saved");
      return;
    }
    if (action === "browse") {
      shell.focusHome("templates");
    }
  };

  return (
    <div className="shell" data-testid="app-shell">
      <SectionBar />
      <div className="shell-body">
        {screen === "home" && <Home />}
        {/* Tools stays mounted so the workspace state is the app session,
            not a screen that disappears when you open Home. */}
        <div className="shell-pane" hidden={screen !== "tools"}>
          <Workspace />
        </div>
        {screen === "learn" && <Learn />}
        {screen === "references" && <References />}
        {introOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,7,11,0.72)] p-4" data-testid="first-run">
            <div className="panel w-full max-w-lg p-5">
              <div className="eyebrow">First run</div>
              <h2 className="font-display text-[26px] font-extrabold uppercase tracking-wider mt-1">Start here</h2>
              <div className="mt-3"><AboutCopy /></div>
              <p className="mt-3 text-[13px] text-[var(--text-secondary)]">Character Interaction ships with the app. You can read it, answer a question, and move a slider with no API key.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="ue-btn ue-btn-primary" data-testid="first-run-open" onClick={() => dismissIntro(true)}>Open Start Here</button>
                <button type="button" className="ue-btn" data-testid="first-run-later" onClick={() => dismissIntro(false)}>Not now</button>
              </div>
            </div>
          </div>
        )}
        {screen === "empty" && <EmptySection section={section} onAction={onEmptyAction} />}
        {screen === "remembered" && (
          <EmptySection section={section} open={shell.memory[section.id]} onAction={onEmptyAction} />
        )}
      </div>
    </div>
  );
}
