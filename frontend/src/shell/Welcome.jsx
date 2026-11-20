import React from "react";
import { useShell } from "./ShellContext";

const STOPS = [
  { id: "tools", title: "Tools", body: "Tools is the workspace. Describe a system, edit the event graph, and read the C++ the graph writes." },
  { id: "learn", title: "Learn", body: "Learn is the open system's big picture and a short quiz. Click a C++ line for a plain-language note. The quiz shuffles its answers each time you open it." },
  { id: "programs", title: "Programs", body: "Programs are genre tracks. Read the lesson, do the self-scored assignments, then press NEXT: QUIZ. The next lesson stays open even if you skip the quiz." },
  { id: "courses", title: "Courses", body: "Courses use the same lesson shape as programs, with a shorter path. The topic chips are the sections. Each section has its own quiz." },
  { id: "glossary", title: "Glossary", body: "Dotted words open a short definition. See more jumps to that term in the glossary." },
];

export default function Welcome() {
  const shell = useShell();
  if (!shell.welcomeOpen) return null;
  return (
    <div className="welcome-scrim" data-testid="welcome-screen">
      <div className="welcome-card panel p-4">
        <div className="eyebrow">Welcome</div>
        <h2 className="font-display text-[28px] font-extrabold uppercase tracking-wider leading-none mt-1">A short tour</h2>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)]">Five places. You can open this again from Help.</p>
        <div className="mt-3">
          {STOPS.map((stop) => (
            <button key={stop.id} type="button" className="welcome-stop" data-testid={`welcome-${stop.id}`} onClick={() => { shell.dismissWelcome(); shell.go(stop.id); }}>
              <span className="font-semibold">{stop.title}</span>
              <span className="block text-[13px] text-[var(--text-secondary)]">{stop.body}</span>
            </button>
          ))}
        </div>
        <button type="button" className="ue-btn ue-btn-primary mt-3" data-testid="welcome-dismiss" onClick={() => shell.dismissWelcome()}>Dismiss</button>
      </div>
    </div>
  );
}
