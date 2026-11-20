import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { openInTargets, visibleSections } from "../lib/shell.mjs";
import { HELP_LEVELS } from "../lib/learning.mjs";
import { feedbackUrl } from "../lib/stage0.mjs";
import { useShell } from "./ShellContext";

export default function SectionBar() {
  const shell = useShell();
  const sections = visibleSections(shell.registry);
  const targets = openInTargets(shell.registry, shell.section);
  const [openIn, setOpenIn] = useState(false);
  const menuRef = useRef(null);
  const chip = shell.chip;

  useEffect(() => {
    if (!openIn) return undefined;
    const onDoc = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpenIn(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [openIn]);

  return (
    <header className="section-bar" data-testid="section-bar">
      <div className="section-brand" aria-hidden="true">
        <span className="section-brand-mark" />
      </div>
      <nav className="section-tabs" aria-label="Sections">
        {sections.map((section) => {
          const active = shell.section === section.id;
          return (
            <button
              key={section.id}
              type="button"
              className={`section-tab ${active ? "active" : ""}`}
              aria-current={active ? "page" : undefined}
              data-testid={`section-${section.id}`}
              onClick={() => shell.go(section.id)}
            >
              {section.label}
            </button>
          );
        })}
      </nav>
      {shell.appInfo?.update?.version && (
        <a className="chip shrink-0" href={shell.appInfo.update.url} target="_blank" rel="noreferrer" data-testid="update-available" title="A newer release is on GitHub">New version {shell.appInfo.update.version}</a>
      )}
      <button type="button" className="ue-btn !py-1 !px-2 !text-[11px]" data-testid="help-reopen" onClick={() => shell.openWelcome()}>Help</button>
      <a className="ue-btn !py-1 !px-2 !text-[11px]" data-testid="report-bug" href={feedbackUrl({ version: shell.version, category: "Bug", os: typeof navigator !== "undefined" ? navigator.platform : "" })} target="_blank" rel="noreferrer">Report a bug</a>
      <div className="help-switch" role="group" aria-label="Help level" data-testid="help-level-switch">
        {HELP_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            className={shell.helpLevel === level ? "active" : ""}
            aria-pressed={shell.helpLevel === level}
            data-testid={`help-level-${level}`}
            onClick={() => shell.setHelpLevel(level)}
          >
            {level}
          </button>
        ))}
      </div>
      <div className="system-chip-wrap" ref={menuRef}>
        <div className="chip system-chip !cursor-default" data-testid="current-system-chip" title={chip.name}>
          {chip.unsaved && <span className="unsaved-dot" data-testid="unsaved-dot" title="Unsaved changes" />}
          <span className="system-chip-name" data-testid="current-system-name">{chip.name}</span>
          {targets.length > 0 && (
            <button
              type="button"
              className="open-in-button"
              aria-expanded={openIn}
              aria-haspopup="menu"
              data-testid="open-in-menu"
              onClick={() => setOpenIn((value) => !value)}
            >
              Open in… <ChevronDown size={12} />
            </button>
          )}
        </div>
        {openIn && targets.length > 0 && (
          <div className="menu-pop section-open-in" role="menu" data-testid="open-in-list">
            {targets.map((section) => (
              <button
                key={section.id}
                type="button"
                role="menuitem"
                className="open-in-item"
                data-testid={`open-in-${section.id}`}
                onClick={() => {
                  setOpenIn(false);
                  shell.sendToSection(section.id);
                }}
              >
                {section.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
