import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Cpu, Code2, Layers, Sliders, Sparkles, Save, Download, Copy,
  Plus, Trash2, CheckCircle2, Terminal, PackageSearch, Settings,
  Boxes, ChevronDown, PlayCircle, Hammer, Wrench, GitBranch, Network, Zap,
  Swords, Package, MessagesSquare, Shield, HardDrive, Car, Hand, Workflow,
  GitCompareArrows, Compass, StickyNote, Share2, FolderClosed, Eye, Pencil, KeyRound
} from "lucide-react";
import NodeGraph from "../components/NodeGraph";
import AnnotatedPseudocode from "../components/AnnotatedPseudocode";
import SetupGuide from "../components/SetupGuide";
import CompareView from "../components/CompareView";
import { PendingChanges, AppliedChanges } from "../components/ChangePanels";
import { computeChanges, compactForApi } from "../lib/changes";
import { api, errorText, downloadBlob, exportPayload } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ProjectsPanel from "../components/ProjectsPanel";
import ShareModal from "../components/ShareModal";
import AccountMenu from "../components/AccountMenu";
import Modal from "../components/Modal";
import { ReferencesBar, ProjectFiles } from "../components/Files";
import AiKeyModal, { PROVIDERS, aiHeaders, loadAiKey } from "../components/AiKeyModal";
import { highlightCpp, highlightBlueprint } from "../lib/highlight";

const LS_KEY = "ue5_architect_library_v1";
const LS_CONTEXT = "ue5_architect_project_context";

const ICON_MAP = {
  swords: Swords, package: Package, "messages-square": MessagesSquare,
  shield: Shield, "hard-drive": HardDrive, car: Car, sparkles: Sparkles, hand: Hand,
};

const BLUEPRINT_CLASSES = ["ActorComponent", "Actor", "Pawn", "Character", "GameInstanceSubsystem", "WheeledVehiclePawn"];

async function streamGenerate(body, onProgress, aiKey, isAlive) {
  let job_id;
  try {
    ({ data: { job_id } } = await api.post("/generate", body, { headers: aiHeaders(aiKey) }));
  } catch (e) {
    throw new Error(errorText(e));
  }
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    if (!isAlive()) throw new Error("cancelled");
    let job;
    try {
      job = (await api.get(`/generate/${job_id}`)).data;
    } catch {
      continue; // transient network blip, keep polling
    }
    onProgress(job.chars || 0);
    if (job.status === "done") return job.result;
    if (job.status === "error") throw new Error(job.detail);
  }
  throw new Error("Generation took longer than 5 minutes. Please try again.");
}

const MIGRATION_KEY = (uid) => `ue5_architect_migrated_${uid}`;
const readLocalLibrary = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
};

function Slider({ label, value, onChange, min = 0, max = 100, step = 1, unit = "", testId }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">{label}</span>
        <span className="font-mono text-[12px] text-[var(--unreal-orange)]">{value}{unit && ` ${unit}`}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#ff6b00]"
        aria-label={label}
        data-testid={testId}
      />
    </div>
  );
}

function TemplateCard({ tpl, onPick }) {
  const Icon = ICON_MAP[tpl.icon] || Boxes;
  return (
    <button
      onClick={() => onPick(tpl)}
      data-testid={`template-card-${tpl.id}`}
      className="group panel text-left p-3 hover:border-[var(--unreal-orange)] hover:bg-[var(--surface-hover)] transition-all"
    >
      <div className="flex items-start gap-2">
        <div className={`rounded-md p-1.5 border border-[var(--border)] text-[var(--unreal-orange)] group-hover:glow-orange-soft`}>
          <Icon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-sub font-semibold text-[13px] text-[var(--text-primary)] leading-tight truncate">{tpl.title}</div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5 font-mono truncate">{tpl.tagline}</div>
        </div>
      </div>
    </button>
  );
}

export function CodeBox({ title, code, lang = "cpp", testId }) {
  const html = useMemo(() => (lang === "cpp" ? highlightCpp(code) : highlightBlueprint(code)), [code, lang]);
  const copy = async () => {
    await navigator.clipboard.writeText(code || "");
    toast.success(`${title} copied to clipboard`);
  };
  const download = () => {
    const ext = lang === "cpp" ? (title.includes(".h") ? "h" : title.includes(".cpp") ? "cpp" : "txt") : "txt";
    const blob = new Blob([code || ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${title.replace(/[^a-z0-9.-]/gi, "_")}.${ext}`;
    a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="code-box">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${lang === "cpp" ? "bg-[var(--cpp-green)]" : "bg-[var(--blueprint-blue)]"}`} />
          <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--text-secondary)]">{title}</span>
        </div>
        <div className="flex gap-1.5">
          <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={copy} data-testid={`copy-${testId}`}><Copy size={12} /> Copy</button>
          <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={download} data-testid={`download-${testId}`}><Download size={12} /> .{lang === "cpp" ? (title.includes(".h") ? "h" : "cpp") : "txt"}</button>
        </div>
      </div>
      <pre dangerouslySetInnerHTML={{ __html: html || `<span class="tok-com">// awaiting generation…</span>` }} />
    </div>
  );
}

export default function Workspace() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [prompt, setPrompt] = useState("A third-person melee combat system with combo chains, directional attacks, hit reactions, and hitstop.");
  const [bpClass, setBpClass] = useState("ActorComponent");
  const [complexity, setComplexity] = useState(55);
  const [modularity, setModularity] = useState(75);
  const [perfFlex, setPerfFlex] = useState(50);
  const [tickRate, setTickRate] = useState(30);
  const [replicated, setReplicated] = useState(false);
  const [extra, setExtra] = useState([]);           // user-added modules
  const [newExtra, setNewExtra] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [tab, setTab] = useState("graph");
  const [previousResult, setPreviousResult] = useState(null);
  const [notes, setNotes] = useState("");
  const [projectContext, setProjectContext] = useState(() => localStorage.getItem(LS_CONTEXT) || "");
  const [project, setProject] = useState(null);
  const [references, setReferences] = useState([]);
  const [shareOpen, setShareOpen] = useState(false);
  const [conflict, setConflict] = useState(null);
  const [projRefresh, setProjRefresh] = useState(0);
  const [migration, setMigration] = useState(null);
  const readOnly = project?.my_role === "viewer";
  const [aiKey, setAiKey] = useState(loadAiKey);
  const [keyModal, setKeyModal] = useState(null); // null | "edit" | "required"
  const [saving, setSaving] = useState(false);
  const projectRef = useRef(null);
  projectRef.current = project;
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);
  useEffect(() => { localStorage.setItem(LS_CONTEXT, projectContext); }, [projectContext]);

  useEffect(() => {
    api.get("/templates").then((r) => setTemplates(r.data.templates || [])).catch(() => {});
    const pending = readLocalLibrary();
    if (pending.length && !localStorage.getItem(MIGRATION_KEY(user.user_id))) setMigration(pending);
    const pid = new URLSearchParams(window.location.search).get("project");
    if (pid) {
      openProject(pid);
      window.history.replaceState(null, "", "/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickTemplate = (t) => {
    setPrompt(t.prompt);
    setBpClass(t.default_class || "ActorComponent");
    toast.message(`Loaded template: ${t.title}`);
  };

  const runSynthesis = async (body, context, successLabel) => {
    if (!aiKey) {
      setKeyModal("required");
      toast.error("Add your AI key to synthesize");
      return false;
    }
    const startedOn = project?.project_id || null;
    setLoading(true);
    setError(null);
    setProgress(0);
    try {
      const data = await streamGenerate({ ...body, project_context: projectContext, reference_file_ids: references.map((r) => r.file_id) }, setProgress, aiKey, () => aliveRef.current);
      if ((projectRef.current?.project_id || null) !== startedOn) {
        toast.message("A synthesis finished after you switched projects, so it was discarded");
        return false;
      }
      if (result) setPreviousResult(result);
      setResult({ ...data, context: { ...context, project_context: projectContext, references, notes: body.designer_notes || "" }, baseline_modules: data.modules });
      setNotes((n) => (n === (body.designer_notes || "") ? "" : n));
      setTab(result ? "compare" : "graph");
      toast.success(successLabel(data), { description: `${data.node_graph_nodes?.length || 0} nodes · ${data.applied_changes?.length || 0} changes applied` });
      return true;
    } catch (e) {
      if (e.message === "cancelled") return false;
      const detail = e.message || "Unknown error";
      setError(detail);
      toast.error("Generation failed", { description: detail, duration: 10000 });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const currentInputs = { prompt, blueprint_class: bpClass, complexity, modularity, performance_vs_flexibility: perfFlex, tick_rate: tickRate, network_replicated: replicated };

  const generate = async () => {
    if (prompt.trim().length < 5) {
      toast.error("Describe your system in a bit more detail");
      return;
    }
    const removed = result ? (result.modules || []).filter((m) => !m.included).map((m) => m.name) : [];
    await runSynthesis({
      ...currentInputs,
      extra_modules: extra,
      removed_modules: removed,
      parameter_overrides: result ? tunable : {},
      designer_notes: notes,
      change_requests: pendingChanges.map((c) => c.text),
      previous_system: result ? (({ context: _c, baseline_modules: _b, ...rest }) => rest)(result) : null,
    }, { ...currentInputs, extra_modules: extra }, (d) => `${d.system_name} ${result ? "regenerated" : "generated"}`);
  };

  const stackSelected = async (ids) => {
    let systems;
    try {
      systems = await Promise.all(ids.map((id) => api.get(`/projects/${id}`).then((r) => r.data.system)));
    } catch (e) {
      toast.error(errorText(e));
      return false;
    }
    const stackPrompt = `Stack these systems into one integrated system: ${systems.map((x) => x.system_name).join(" + ")}`;
    const ok = await runSynthesis({
      ...currentInputs,
      prompt: stackPrompt,
      extra_modules: [],
      designer_notes: notes,
      stack_systems: systems.map(compactForApi),
    }, { ...currentInputs, prompt: stackPrompt, extra_modules: [] }, (d) => `Stacked into ${d.system_name}`);
    if (ok) {
      setPrompt(stackPrompt);
      setExtra([]);
      setProject(null);
    }
    return ok;
  };

  const toggleModule = (name) => {
    if (!result) return;
    setExtra((e) => e.filter((v) => v !== name));
    setResult({
      ...result,
      modules: result.modules.map((m) => (m.name === name ? { ...m, included: !m.included } : m)),
    });
  };
  const addExtra = () => {
    const v = newExtra.trim();
    if (!v) return;
    setExtra((e) => [...new Set([...e, v])]);
    setNewExtra("");
  };

  const splitResult = () => {
    const { context, ...system } = result;
    return { system, context: { ...(context || {}), references } };
  };

  const saveProject = async (force = false) => {
    if (!result || saving) return;
    const { system, context } = splitResult();
    setSaving(true);
    try {
      const { data } = project && !readOnly
        ? await api.put(`/projects/${project.project_id}`, { system, context, base_version: project.version, force })
        : await api.post("/projects", { name: result.system_name, system, context });
      const { system: _s, context: _c, ...meta } = data;
      setProject(meta);
      setConflict(null);
      setProjRefresh((n) => n + 1);
      toast.success(project ? "Project saved" : "Saved as new project", { description: data.name });
    } catch (e) {
      if (e.response?.status === 409) setConflict(e.response.data.detail);
      else toast.error("Couldn't save", { description: errorText(e) });
    } finally {
      setSaving(false);
    }
  };

  const openSystem = (system, context = {}) => {
    const c = context;
    if (c.prompt !== undefined) {
      setPrompt(c.prompt);
      setBpClass(c.blueprint_class || "ActorComponent");
      setComplexity(c.complexity ?? 55);
      setModularity(c.modularity ?? 75);
      setPerfFlex(c.performance_vs_flexibility ?? 50);
      setTickRate(c.tick_rate ?? 30);
      setReplicated(!!c.network_replicated);
      setExtra(c.extra_modules || []);
      if (c.project_context !== undefined) setProjectContext(c.project_context);
    }
    setReferences(c.references || []);
    setResult({ ...system, context: c, baseline_modules: system.baseline_modules || system.modules });
    setPreviousResult(null);
    setNotes("");
    setTab("graph");
  };

  const openProject = async (id) => {
    try {
      const { data } = await api.get(`/projects/${id}`);
      const { system, context, ...meta } = data;
      setProject(meta);
      openSystem(system, context);
      toast.message(`Opened ${data.name}`, { description: meta.my_role === "viewer" ? "View only" : `Last saved by ${meta.updated_by_name}` });
    } catch (e) {
      toast.error("Couldn't open project", { description: errorText(e) });
    }
  };

  const renameProject = async () => {
    const name = window.prompt("Project name", project.name)?.trim();
    if (!name || name === project.name) return;
    try {
      await api.patch(`/projects/${project.project_id}`, { name });
      setProject((p) => ({ ...p, name }));
      setProjRefresh((n) => n + 1);
    } catch (e) { toast.error(errorText(e)); }
  };

  const migrate = async (doImport) => {
    if (doImport) {
      let n = 0;
      for (const item of migration) {
        try {
          await api.post("/projects/import", { data: item });
          n += 1;
        } catch { /* skip unreadable entries */ }
      }
      toast.success(`Imported ${n} of ${migration.length} systems into your account`);
      setProjRefresh((x) => x + 1);
    }
    localStorage.setItem(MIGRATION_KEY(user.user_id), doImport ? "imported" : "fresh");
    setMigration(null);
  };

  const exportData = () => {
    const { system, context } = splitResult();
    return exportPayload(project?.name || result.system_name, system, { ...context, references: undefined });
  };
  const exportAll = () => {
    if (!result) return;
    downloadBlob(JSON.stringify(exportData(), null, 2), `${(project?.name || result.system_name).replace(/\s+/g, "_")}.json`);
  };
  const copyJson = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(exportData(), null, 2));
    toast.success("Project JSON copied");
  };

  // Dynamic tunable params from generated output
  const [tunable, setTunable] = useState({});
  useEffect(() => {
    if (!result?.tunable_parameters) return;
    const init = {};
    result.tunable_parameters.forEach((p) => { init[p.key] = p.value; });
    setTunable(init);
  }, [result?.id]);

  const pendingChanges = useMemo(
    () => computeChanges(result, { ...currentInputs, params: tunable, extra, notes }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, prompt, bpClass, complexity, modularity, perfFlex, tickRate, replicated, tunable, extra, notes]
  );

  const TABS = [
    { id: "graph", label: "Event Graph", icon: Workflow, test: "tab-node-graph" },
    { id: "blueprint", label: "Blueprint Pseudocode", icon: GitBranch, test: "tab-blueprint-code" },
    { id: "cpp", label: "C++ Snippets", icon: Code2, test: "tab-cpp-code" },
    { id: "setup", label: "Setup Guide", icon: Hammer, test: "tab-setup-guide" },
    { id: "compare", label: "Compare", icon: GitCompareArrows, test: "tab-compare" },
    { id: "files", label: "Files", icon: FolderClosed, test: "tab-files" },
  ];

  return (
    <div className="App flex flex-col" data-testid="app-root">

      {/* ============ TOP HEADER BAR ============ */}
      <header className="h-14 shrink-0 border-b border-[var(--border-soft)] bg-[var(--bg-secondary)] flex items-center px-4 gap-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-md border border-[var(--unreal-orange)] bg-[rgba(255,107,0,0.08)] flex items-center justify-center glow-orange-soft">
            <Cpu size={16} className="text-[var(--unreal-orange)]" />
          </div>
          <div>
            <div className="font-display text-[16px] font-extrabold uppercase tracking-wider leading-none">UE5 System Architect</div>
            <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest mt-0.5">Modular · AI-driven · Blueprint + C++</div>
          </div>
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2 pl-4 ml-2 border-l border-[var(--border-soft)]">
          {project ? (
            <>
              <button className="font-sub font-semibold text-[14px] truncate max-w-[260px] flex items-center gap-1.5 hover:text-[var(--unreal-orange)] disabled:hover:text-inherit" onClick={renameProject} disabled={readOnly} title={readOnly ? project.name : "Rename project"} data-testid="project-name">
                {project.name} {!readOnly && <Pencil size={11} className="opacity-60" />}
              </button>
              <span className={`chip !py-0.5 !cursor-default uppercase !text-[10px] ${readOnly ? "!text-[var(--accent-cyan)] !border-[rgba(0,240,255,0.4)]" : "active"}`} data-testid="project-role-badge">
                {readOnly ? <><Eye size={10} /> View only</> : project.my_role}
              </span>
              <span className="hidden lg:inline text-[10.5px] font-mono text-[var(--text-muted)] truncate" data-testid="project-last-saved">saved by {project.updated_by_name} · {new Date(project.updated_at).toLocaleString()}</span>
            </>
          ) : (
            <span className="text-[11px] font-mono text-[var(--text-muted)]" data-testid="project-name-unsaved">Unsaved system</span>
          )}
        </div>
        <div className="hidden 2xl:flex items-center gap-2">
          <span className="chip"><Zap size={11} /> UE 5.4+</span>
          <span className="chip"><Network size={11} /> {replicated ? "Replicated" : "Local"}</span>
          <span className="chip"><Terminal size={11} /> {aiKey ? aiKey.model : "No AI key"}</span>
        </div>
        {project?.my_role === "owner" && <button className="ue-btn" onClick={() => setShareOpen(true)} data-testid="share-button"><Share2 size={13} /> Share</button>}
        <button className="ue-btn" onClick={copyJson} disabled={!result} data-testid="copy-json-btn"><Copy size={13} /> Copy JSON</button>
        <button className="ue-btn" onClick={exportAll} disabled={!result} data-testid="export-all-btn"><Download size={13} /> Export JSON</button>
        <button className="ue-btn ue-btn-primary" onClick={() => saveProject(false)} disabled={!result || readOnly || saving} data-testid="save-system-button"><Save size={13} /> {project ? "Save" : "Save project"}</button>
        <button className={`ue-btn ${aiKey ? "" : "!border-[var(--unreal-orange)] !text-[var(--unreal-orange)]"}`} onClick={() => setKeyModal("edit")} data-testid="ai-key-button">
          <KeyRound size={13} /> {aiKey ? PROVIDERS[aiKey.provider].label.split(" ").pop() : "Add AI key"}
        </button>
        <AccountMenu />
      </header>

      {/* ============ BODY ============ */}
      <div className="flex-1 flex min-h-0">

        {/* LEFT SIDEBAR */}
        <aside className="w-[320px] shrink-0 border-r border-[var(--border-soft)] bg-[var(--bg-secondary)] overflow-y-auto">
          {/* Prompt */}
          <fieldset disabled={readOnly} className="p-4 border-b border-[var(--border-soft)] min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-[var(--unreal-orange)]" />
              <span className="eyebrow">AI Synthesizer</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
              placeholder="Describe the system you want to build..."
              maxLength={2000}
              data-testid="prompt-input"
              className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-md p-3 text-[13px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--unreal-orange)] resize-none"
            />
            <div className="text-right text-[10px] font-mono text-[var(--text-muted)]" data-testid="prompt-char-count">{prompt.length}/2000</div>
            <ReferencesBar references={references} onChange={setReferences} projectId={project && !readOnly ? project.project_id : null} disabled={readOnly} />
            <div className="mt-1 flex items-center gap-2">
              <select
                value={bpClass}
                onChange={(e) => setBpClass(e.target.value)}
                data-testid="blueprint-class-select"
                className="bg-[var(--bg-main)] border border-[var(--border)] rounded-md px-2 py-1.5 text-[11px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--unreal-orange)] flex-1"
              >
                {BLUEPRINT_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-secondary)] cursor-pointer">
                <input type="checkbox" checked={replicated} onChange={(e) => setReplicated(e.target.checked)} data-testid="replicated-toggle" className="accent-[#ff6b00]" />
                NET
              </label>
            </div>
            <div className="mt-3">
              <label htmlFor="project-context" className="eyebrow flex items-center gap-1.5 mb-1.5">
                <Compass size={11} /> Project Context <span className="normal-case tracking-normal font-normal">(optional)</span>
              </label>
              <input
                id="project-context"
                value={projectContext}
                onChange={(e) => setProjectContext(e.target.value)}
                maxLength={300}
                placeholder="e.g. realistic large-scale FPS"
                data-testid="project-context-input"
                className={`w-full bg-[var(--bg-main)] border rounded-md px-2.5 py-1.5 text-[11.5px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--unreal-orange)] ${projectContext.trim() ? "border-[rgba(0,240,255,0.45)]" : "border-[var(--border)]"}`}
              />
              <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">Steers every synthesis. Saved in this browser.</div>
            </div>
            <button
              className="ue-btn ue-btn-primary w-full justify-center mt-3"
              onClick={generate}
              disabled={loading}
              data-testid="generate-system-button"
            >
              {!aiKey && !loading ? (<><KeyRound size={14} /> Add your AI key to synthesize</>) : loading ? (<><span className="inline-block h-3 w-3 rounded-full border-2 border-[#0b0e14] border-t-transparent animate-spin" /> Generating…</>)
                       : result && pendingChanges.length
                         ? (<><PlayCircle size={14} /> Regenerate with {pendingChanges.length} change{pendingChanges.length === 1 ? "" : "s"}</>)
                         : (<><PlayCircle size={14} /> Synthesize System</>)}
            </button>
          </fieldset>

          {/* Templates */}
          <div className="p-4 border-b border-[var(--border-soft)]">
            <div className="flex items-center gap-2 mb-3">
              <Layers size={14} className="text-[var(--unreal-orange)]" />
              <span className="eyebrow">Template Library</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {templates.map((t) => <TemplateCard key={t.id} tpl={t} onPick={pickTemplate} />)}
            </div>
          </div>

          <ProjectsPanel refreshKey={projRefresh} currentId={project?.project_id} onOpen={openProject}
            onDeleted={(id) => { if (project?.project_id === id) setProject(null); }} onStack={stackSelected} busy={loading} />
        </aside>

        {/* CENTER STAGE */}
        <main className="flex-1 flex flex-col min-w-0 bg-[var(--bg-main)]">
          {/* System header */}
          <div className="h-14 shrink-0 px-5 border-b border-[var(--border-soft)] flex items-center justify-between bg-[var(--bg-secondary)]/60">
            <div className="min-w-0">
              <div className="font-display text-[20px] font-extrabold uppercase tracking-wider leading-none truncate">
                {result?.system_name || <span className="text-[var(--text-muted)]">Awaiting Synthesis</span>}
              </div>
              {result?.stacked_from?.length > 0 && (
                <div className="flex gap-1 mt-1" data-testid="stacked-from">
                  {result.stacked_from.map((n) => <span key={n} className="chip !py-0 !text-[10px] !cursor-default">{n}</span>)}
                </div>
              )}
              <div className="text-[11px] font-mono text-[var(--text-secondary)] truncate mt-1">
                {result?.summary || "Describe a system on the left, tune the dials, press Synthesize."}
              </div>
            </div>
            <div className="flex gap-1 shrink-0 ml-4">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    data-testid={t.test}
                    aria-label={t.label}
                    aria-pressed={active}
                    title={t.label}
                    className={`ue-btn !py-1.5 ${active ? "!border-[var(--unreal-orange)] !text-[var(--unreal-orange)] !bg-[rgba(255,107,0,0.08)]" : ""}`}
                  >
                    <Icon size={13} /> <span className="hidden lg:inline">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 relative">
            {loading && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(11,14,20,0.75)] backdrop-blur-sm" data-testid="generation-loader">
                <div className="panel p-6 w-[320px] scan-line">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="text-[var(--unreal-orange)] animate-pulse" size={16} />
                    <span className="font-display uppercase tracking-wider text-[14px]">Compiling Modular System…</span>
                  </div>
                  <div className="space-y-2">
                    <div className="h-2 shimmer rounded"></div>
                    <div className="h-2 shimmer rounded w-5/6"></div>
                    <div className="h-2 shimmer rounded w-4/6"></div>
                  </div>
                  <div className="mt-4 h-1.5 rounded bg-[var(--bg-main)] overflow-hidden">
                    <div className="h-full bg-[var(--unreal-orange)] transition-[width] duration-300" style={{ width: `${Math.min(97, (progress / 14000) * 100)}%` }} />
                  </div>
                  <div className="mt-2 text-[11px] font-mono text-[var(--text-muted)]" data-testid="generation-progress">
                    {progress ? `${progress.toLocaleString()} chars streamed…` : `${aiKey?.model || "The model"} is laying out blueprint nodes + C++ scaffolding.`}
                  </div>
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="absolute left-5 right-5 top-5 z-20 panel p-4 border-[var(--accent-red)] bg-[rgba(239,68,68,0.08)]" data-testid="generation-error">
                <div className="flex items-start gap-3">
                  <div className="h-7 w-7 shrink-0 rounded-md border border-[var(--accent-red)] bg-[rgba(239,68,68,0.15)] flex items-center justify-center">
                    <Terminal size={14} className="text-[var(--accent-red)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display uppercase tracking-wider text-[13px] text-[var(--accent-red)]">Synthesis Failed</div>
                    <div className="text-[12px] font-mono text-[var(--text-secondary)] mt-1 leading-relaxed">{error}</div>
                  </div>
                  <button onClick={() => setError(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm" data-testid="dismiss-error">×</button>
                </div>
              </div>
            )}
            {tab === "graph" && <NodeGraph nodes={result?.node_graph_nodes || []} edges={result?.node_graph_edges || []} />}
            {tab === "blueprint" && (
              <div className="p-5 h-full overflow-auto">
                <AnnotatedPseudocode code={result?.blueprint_pseudocode} />
              </div>
            )}
            {tab === "cpp" && (
              <div className="p-5 h-full overflow-auto grid md:grid-cols-2 gap-4">
                <CodeBox title={`${result?.system_name || "System"}.h`} code={result?.cpp_header} lang="cpp" testId="cpp-header" />
                <CodeBox title={`${result?.system_name || "System"}.cpp`} code={result?.cpp_source} lang="cpp" testId="cpp-source" />
              </div>
            )}
            {tab === "setup" && <SetupGuide steps={result?.setup_guide || []} />}
            {tab === "compare" && <CompareView before={previousResult} after={result} />}
            {tab === "files" && <ProjectFiles project={project} />}
          </div>

          {/* Bottom diagnostic bar */}
          <div className="h-8 shrink-0 border-t border-[var(--border-soft)] bg-[var(--bg-secondary)] px-4 flex items-center gap-4 text-[10.5px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${result ? "bg-[var(--cpp-green)]" : "bg-slate-600"}`}/> {result ? "Ready" : "Idle"}</span>
            <span>Class: <span className="text-[var(--text-secondary)]">{bpClass}</span></span>
            <span>Nodes: <span className="text-[var(--text-secondary)]">{result?.node_graph_nodes?.length || 0}</span></span>
            <span>Modules: <span className="text-[var(--text-secondary)]">{result?.modules?.filter(m=>m.included).length || 0}</span></span>
            <div className="flex-1" />
            <span>{result?.network_notes?.slice(0, 80) || "—"}</span>
          </div>
        </main>

        {/* RIGHT TUNER PANEL */}
        <aside className="w-[340px] shrink-0 border-l border-[var(--border-soft)] bg-[var(--bg-secondary)] overflow-y-auto">
          {readOnly && <div className="px-4 py-2 text-[11px] font-mono text-[var(--accent-cyan)] border-b border-[var(--border-soft)] flex items-center gap-2" data-testid="view-only-banner"><Eye size={12} /> View only: ask the owner for Editor access to change this system.</div>}
          <fieldset disabled={readOnly} className="contents">
          <PendingChanges changes={pendingChanges} />
          {pendingChanges.length === 0 && <AppliedChanges result={result} />}
          <div className="p-4 border-b border-[var(--border-soft)]">
            <div className="flex items-center gap-2 mb-4">
              <Sliders size={14} className="text-[var(--unreal-orange)]" />
              <span className="eyebrow">Architecture Dials</span>
            </div>
            <div className="space-y-4">
              <Slider label="Complexity" value={complexity} onChange={setComplexity} testId="slider-complexity" />
              <Slider label="Modularity" value={modularity} onChange={setModularity} testId="slider-modularity" />
              <Slider label="Perf ↔ Flex" value={perfFlex} onChange={setPerfFlex} testId="slider-perf-flex" />
              <Slider label="Tick Rate" value={tickRate} onChange={setTickRate} min={0} max={120} unit="Hz" testId="slider-tick" />
            </div>
            <div className="mt-3 text-[11px] font-mono text-[var(--text-muted)]">Dials steer the next synthesis — press Synthesize to regenerate.</div>
          </div>

          {/* Tunable params from generated system */}
          {result?.tunable_parameters?.length > 0 && (
            <div className="p-4 border-b border-[var(--border-soft)]">
              <div className="flex items-center gap-2 mb-3">
                <Wrench size={14} className="text-[var(--unreal-orange)]" />
                <span className="eyebrow">System Parameters</span>
              </div>
              <div className="space-y-3">
                {result.tunable_parameters.map((p) => (
                  <Slider
                    key={p.key}
                    label={p.label || p.key}
                    value={tunable[p.key] ?? p.value}
                    min={p.min ?? 0}
                    max={p.max ?? 100}
                    step={p.step ?? 1}
                    unit={p.unit || ""}
                    onChange={(v) => setTunable((t) => ({ ...t, [p.key]: v }))}
                    testId={`param-${p.key}`}
                  />
                ))}
              </div>
              <div className="mt-2 text-[10.5px] font-mono text-[var(--text-muted)]">Tuned values are baked into the code defaults on next Synthesize.</div>
            </div>
          )}

          {/* Modules add/subtract */}
          <div className="p-4 border-b border-[var(--border-soft)]">
            <div className="flex items-center gap-2 mb-3">
              <Boxes size={14} className="text-[var(--unreal-orange)]" />
              <span className="eyebrow">Modules</span>
            </div>
            {result?.modules?.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {result.modules.map((m) => (
                  <button
                    key={m.name}
                    onClick={() => toggleModule(m.name)}
                    className={`chip ${m.included ? "active" : "danger"}`}
                    title={m.description}
                    data-testid={`module-chip-${m.name}`}
                  >
                    {m.included ? <CheckCircle2 size={11} /> : <Trash2 size={11} />} {m.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-[11px] font-mono text-[var(--text-muted)] mb-3">Generate a system to see its modules here.</div>
            )}

            <div className="flex flex-wrap gap-1.5 mb-2">
              {extra.filter((x) => !result?.modules?.some((m) => m.name === x)).map((x) => (
                <span key={x} className="chip active" data-testid={`extra-chip-${x}`}>
                  <Plus size={10} /> {x}
                  <button onClick={() => setExtra((e) => e.filter((v) => v !== x))} className="ml-1 opacity-70 hover:opacity-100">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                value={newExtra}
                onChange={(e) => setNewExtra(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addExtra()}
                placeholder="+ Add module (e.g. StaminaDrain)"
                data-testid="add-module-input"
                className="flex-1 bg-[var(--bg-main)] border border-[var(--border)] rounded-md px-2 py-1.5 text-[11px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--unreal-orange)]"
              />
              <button className="ue-btn" onClick={addExtra} data-testid="add-component-button"><Plus size={12} /></button>
            </div>
            <div className="mt-2 text-[10.5px] font-mono text-[var(--text-muted)]">Chips toggle include/exclude. Press Synthesize to regenerate with changes.</div>
          </div>

          <div className="p-4 border-b border-[var(--border-soft)]">
            <label htmlFor="designer-notes" className="flex items-center gap-2 mb-2">
              <StickyNote size={14} className="text-[var(--unreal-orange)]" />
              <span className="eyebrow">Notes for next synthesis</span>
            </label>
            <textarea
              id="designer-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="e.g. Use a Gameplay Tag for stun instead of a bool"
              data-testid="designer-notes-input"
              className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-md p-2 text-[11.5px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--unreal-orange)] resize-none"
            />
          </div>

          {/* Network notes */}
          {result?.network_notes && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Network size={14} className="text-[var(--unreal-orange)]" />
                <span className="eyebrow">Replication Notes</span>
              </div>
              <div className="text-[12px] font-mono text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{result.network_notes}</div>
            </div>
          )}
          </fieldset>
        </aside>
      </div>
      {keyModal && (
        <AiKeyModal current={aiKey} required={keyModal === "required"} onClose={() => setKeyModal(null)}
          onSave={(k) => { setAiKey(k); setKeyModal(null); }} />
      )}
      {shareOpen && project && (
        <ShareModal project={project} onClose={() => setShareOpen(false)}
          onUpdate={(d) => { const { system: _s, context: _c, ...meta } = d; setProject((p) => ({ ...p, ...meta })); }} />
      )}
      {conflict && (
        <Modal title="Newer version saved" onClose={() => setConflict(null)} testId="conflict-modal" width={460}>
          <div className="text-[13px] text-[var(--text-secondary)] mb-4" data-testid="conflict-message">
            {conflict.updated_by_name} saved this project at {new Date(conflict.updated_at).toLocaleString()} while you were editing.
          </div>
          <div className="flex gap-2 justify-end">
            <button className="ue-btn" onClick={() => { setConflict(null); openProject(project.project_id); }} data-testid="conflict-load-theirs">Load their version</button>
            <button className="ue-btn ue-btn-primary" onClick={() => saveProject(true)} data-testid="conflict-overwrite">Overwrite with mine</button>
          </div>
        </Modal>
      )}
      {migration && (
        <Modal title="Systems found in this browser" testId="migration-modal" width={460}>
          <div className="text-[13px] text-[var(--text-secondary)] mb-3">
            You have {migration.length} system{migration.length === 1 ? "" : "s"} saved in this browser from before accounts existed. Copy them into your account?
          </div>
          <ul className="mb-4 space-y-1 max-h-40 overflow-y-auto">
            {migration.map((m, i) => <li key={i} className="text-[12px] font-mono text-[var(--text-muted)] truncate">· {m.system_name || "Untitled system"}</li>)}
          </ul>
          <div className="flex gap-2 justify-end">
            <button className="ue-btn" onClick={() => migrate(false)} data-testid="migration-start-fresh">Start fresh</button>
            <button className="ue-btn ue-btn-primary" onClick={() => migrate(true)} data-testid="migration-import">Import them</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
