import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Boxes, Car, FilePlus, FolderOpen, Hand, HardDrive, History, Layers, MessagesSquare, Package, Shield, Sparkles, Swords,
} from "lucide-react";
import { api } from "../lib/api";
import { rankProjects } from "../lib/shell.mjs";
import { useShell } from "./ShellContext";
import AboutCopy from "./AboutCopy";

const ICONS = {
  swords: Swords,
  package: Package,
  "messages-square": MessagesSquare,
  shield: Shield,
  "hard-drive": HardDrive,
  car: Car,
  sparkles: Sparkles,
  hand: Hand,
};

function ago(iso) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = (Date.now() - then) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Home() {
  const shell = useShell();
  const [projects, setProjects] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [showRest, setShowRest] = useState(false);
  const [continueCards, setContinueCards] = useState([]);
  const [startHere, setStartHere] = useState(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const ranked = rankProjects(projects);

  const reloadProjects = () => api.get("/projects").then((r) => setProjects(r.data?.mine || [])).catch(() => {});
  const forkLibrary = async (source, id, title) => {
    try {
      await api.post("/library/fork", { source, id });
      await reloadProjects();
      toast.success(`Forked ${title}`, { description: "It is an editable project. The original is unchanged." });
    } catch {
      toast.error("Couldn't fork that");
    }
  };

  useEffect(() => {
    let alive = true;
    api.get("/projects")
      .then((r) => { if (alive) setProjects(r.data?.mine || []); })
      .catch(() => { if (alive) setLoadError("Couldn't load saved projects."); });
    api.get("/templates")
      .then((r) => { if (alive) setTemplates(r.data?.templates || []); })
      .catch(() => {});
    api.get("/examples")
      .then((r) => { if (alive) setStartHere(r.data?.examples?.[0] || null); })
      .catch(() => {});
    api.get("/progress")
      .then((r) => {
        if (!alive) return;
        const practiced = Array.isArray(r.data?.practiced) ? r.data.practiced : [];
        setContinueCards(practiced.slice(0, 4));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!shell.homeFocus) return undefined;
    const node = document.querySelector(shell.homeFocus === "templates" ? "[data-testid='home-templates']" : "[data-testid='home-recent']");
    node?.scrollIntoView({ block: "start" });
    shell.clearHomeFocus();
    return undefined;
  }, [shell.homeFocus, shell]);

  return (
    <div className="home-screen" data-testid="home-screen">
      <div className="home-inner">
        <div className="eyebrow">UE5 System Architect</div>
        <h1 className="font-display text-[40px] font-extrabold uppercase tracking-wider leading-none mt-1">Home</h1>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)] max-w-xl">
          Recent systems, a new project, or a template. The workspace itself is under Tools.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="ue-btn ue-btn-primary" data-testid="home-new-project" onClick={() => shell.issue({ type: "new-project" })}>
            <FilePlus size={14} /> New project
          </button>
          <button
            type="button"
            className="ue-btn"
            data-testid="home-open-last"
            disabled={!ranked.last}
            title={ranked.last ? `Open ${ranked.last.name}` : "No saved system yet"}
            onClick={() => ranked.last && shell.issue({ type: "open-project", id: ranked.last.project_id })}
          >
            <History size={14} /> Open last system
          </button>
        </div>

        {/* Continue cards land in this slot in a later stage. Empty on purpose. */}
        <div data-testid="continue-cards-slot" className={continueCards.length ? "mt-6" : "home-reserve"}>
          {continueCards.length > 0 && (
            <>
              <div className="eyebrow mb-2">Continue</div>
              <div className="home-grid">
                {continueCards.map((card) => (
                  <button
                    key={card.system_name}
                    type="button"
                    className="panel home-card text-left"
                    data-testid={`continue-card-${card.system_name}`}
                    onClick={() => {
                      if (card.project_id) shell.issue({ type: "open-project", id: card.project_id });
                      else shell.go("learn");
                    }}
                  >
                    <div className="font-sub font-semibold text-[14px]">Continue {card.system_name}</div>
                    <div className="mt-1 text-[11px] font-mono text-[var(--text-muted)]">{card.count} answered</div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <section className="mt-8" data-testid="home-start-here">
          <div className="eyebrow mb-2">Start here</div>
          <div className="panel p-4">
            <div className="font-sub font-semibold text-[16px]">{startHere?.title || "Character Interaction"}</div>
            <p className="mt-1 text-[12px] text-[var(--text-secondary)] max-w-xl">{startHere?.tagline || "A look trace, a prompt, and Interact. No API key."}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {startHere?.complexity && <span className="chip !cursor-default">{startHere.complexity}</span>}
              {(startHere?.prerequisites || []).map((item) => <span key={item} className="chip !cursor-default">{item}</span>)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="ue-btn ue-btn-primary" data-testid="home-open-start-here" onClick={() => shell.openReference("start-here")}>Open</button>
              <button type="button" className="ue-btn" data-testid="home-fork-start-here" onClick={() => forkLibrary("example", "start-here", "Character Interaction")}>Fork</button>
            </div>
          </div>
        </section>

        <section className="mt-8" data-testid="home-recent" id="home-recent">
          <div className="flex items-center gap-2 mb-3">
            <FolderOpen size={14} className="text-[var(--unreal-orange)]" />
            <h2 className="eyebrow !text-[var(--text-secondary)]">Recent</h2>
          </div>
          {loadError && <p className="text-[12px] font-mono text-[var(--accent-red)]" data-testid="home-load-error">{loadError}</p>}
          {!loadError && projects.length === 0 && (
            <p className="text-[12px] font-mono text-[var(--text-muted)]" data-testid="home-no-projects">
              No saved systems yet. Start a new project or pick a template.
            </p>
          )}
          <div className="home-grid">
            {ranked.prominent.map((project) => (
              <div key={project.project_id} className="panel home-card text-left" data-testid={`home-project-${project.project_id}`}>
                <button
                  type="button"
                  className="block w-full text-left bg-transparent border-0 p-0 text-inherit cursor-pointer"
                  data-testid={`home-open-${project.project_id}`}
                  onClick={() => shell.issue({ type: "open-project", id: project.project_id })}
                >
                  <div className="font-sub font-semibold text-[14px] truncate">{project.name}</div>
                  <div className="mt-1 text-[11px] font-mono text-[var(--text-muted)] truncate">
                    saved {ago(project.updated_at)}
                  </div>
                </button>
                <button
                  type="button"
                  className="mt-2 bg-transparent border-0 p-0 text-[11px] font-mono text-[var(--unreal-orange)] hover:underline cursor-pointer"
                  data-testid={`home-versions-${project.project_id}`}
                  onClick={() => shell.issue({ type: "open-project", id: project.project_id, history: true })}
                >
                  v{project.version} · versions
                </button>
              </div>
            ))}
          </div>
          {ranked.rest.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                className="ue-btn !py-1 !px-2 !text-[11px]"
                aria-expanded={showRest}
                data-testid="home-show-rest"
                onClick={() => setShowRest((value) => !value)}
              >
                {showRest ? "Hide" : "Show"} {ranked.rest.length} more saved
              </button>
              {showRest && (
                <ul className="mt-2 space-y-1" data-testid="home-rest-list">
                  {ranked.rest.map((project) => (
                    <li key={project.project_id} className="home-rest-row" data-testid={`home-project-${project.project_id}`}>
                      <button
                        type="button"
                        className="truncate text-left flex-1 min-w-0 bg-transparent border-0 p-0 text-inherit cursor-pointer"
                        data-testid={`home-open-${project.project_id}`}
                        onClick={() => shell.issue({ type: "open-project", id: project.project_id })}
                      >
                        {project.name}
                      </button>
                      <button
                        type="button"
                        className="font-mono text-[10px] text-[var(--unreal-orange)] shrink-0 hover:underline bg-transparent border-0 p-0 cursor-pointer"
                        data-testid={`home-versions-${project.project_id}`}
                        onClick={() => shell.issue({ type: "open-project", id: project.project_id, history: true })}
                      >
                        v{project.version} · versions
                      </button>
                      <span className="font-mono text-[10px] text-[var(--text-muted)] shrink-0">{ago(project.updated_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="mt-8" data-testid="home-templates" id="home-templates">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={14} className="text-[var(--unreal-orange)]" />
            <h2 className="eyebrow !text-[var(--text-secondary)]">Template quick start</h2>
          </div>
          <div className="home-grid">
            {templates.map((tpl) => {
              const Icon = ICONS[tpl.icon] || Boxes;
              return (
                <div key={tpl.id} className="panel home-card home-template text-left">
                  <button
                    type="button"
                    className="block w-full text-left bg-transparent border-0 p-0 text-inherit cursor-pointer"
                    data-testid={`home-template-${tpl.id}`}
                    onClick={() => shell.issue({ type: "template", template: tpl })}
                  >
                    <div className="flex items-start gap-2">
                      <span className="home-template-icon"><Icon size={14} /></span>
                      <span className="min-w-0">
                        <span className="block font-sub font-semibold text-[13px] leading-tight">{tpl.title}</span>
                        <span className="block mt-0.5 text-[11px] font-mono text-[var(--text-muted)] truncate">{tpl.tagline}</span>
                      </span>
                    </div>
                  </button>
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {tpl.complexity && <span className="chip !py-0 !text-[10px] !cursor-default">{tpl.complexity}</span>}
                    <button type="button" className="text-[11px] font-mono text-[var(--unreal-orange)] bg-transparent border-0 p-0 cursor-pointer" data-testid={`home-fork-${tpl.id}`} onClick={() => forkLibrary("template", tpl.id, tpl.title)}>Fork</button>
                    {(tpl.learn_more || []).slice(0, 1).map((link) => (
                      <a key={link.url} className="text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--unreal-orange)]" href={link.url} target="_blank" rel="noreferrer">Learn more</a>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Stats strip lands in this slot in a later stage. No numbers until then. */}
        <div data-testid="stats-strip-slot" className="home-reserve" />

        <footer className="home-footer" data-testid="app-version">
          UE5 System Architect <span data-testid="app-version-number">{shell.version}</span>
          <button type="button" className="ml-3 text-[var(--unreal-orange)] bg-transparent border-0 p-0 cursor-pointer" data-testid="open-about" onClick={() => setAboutOpen(true)}>About</button>
        </footer>
        {aboutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(5,7,11,0.72)] p-4" data-testid="about-dialog">
            <div className="panel w-full max-w-lg p-5">
              <div className="eyebrow">About</div>
              <h2 className="font-display text-[26px] font-extrabold uppercase tracking-wider mt-1">UE5 System Architect</h2>
              <div className="mt-3"><AboutCopy /></div>
              <button type="button" className="ue-btn mt-4" data-testid="about-close" onClick={() => setAboutOpen(false)}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
