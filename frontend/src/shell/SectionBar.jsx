import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { openInTargets, visibleSections } from "../lib/shell.mjs";
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
