import React from "react";
import { sectionById, sectionScreen } from "../lib/shell.mjs";
import { useShell } from "./ShellContext";
import SectionBar from "./SectionBar";
import Home from "./Home";
import EmptySection from "./EmptySection";
import Workspace from "../pages/Workspace";
import Learn from "./Learn";
import References from "./References";

export default function AppShell() {
  const shell = useShell();
  const section = sectionById(shell.section, shell.registry) || sectionById("home", shell.registry);
  const screen = sectionScreen(section, shell.memory);

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
        {screen === "empty" && <EmptySection section={section} onAction={onEmptyAction} />}
        {screen === "remembered" && (
          <EmptySection section={section} open={shell.memory[section.id]} onAction={onEmptyAction} />
        )}
      </div>
    </div>
  );
}
