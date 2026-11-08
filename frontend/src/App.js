import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Toaster, toast } from "sonner";
import {
  Cpu, Code2, Layers, Sliders, Sparkles, Save, Download, Copy,
  Plus, Trash2, CheckCircle2, Terminal, PackageSearch, Settings,
  Boxes, ChevronDown, PlayCircle, Hammer, Wrench, GitBranch, Network, Zap,
  Swords, Package, MessagesSquare, Shield, HardDrive, Car, Hand, Workflow,
  GitCompareArrows, Compass, StickyNote, Combine
} from "lucide-react";
import NodeGraph from "./components/NodeGraph";
import AnnotatedPseudocode from "./components/AnnotatedPseudocode";
import SetupGuide from "./components/SetupGuide";
import CompareView from "./components/CompareView";
import { PendingChanges, AppliedChanges } from "./components/ChangePanels";
import { computeChanges, compactForApi } from "./lib/changes";
import { highlightCpp, highlightBlueprint } from "./lib/highlight";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const LS_KEY = "ue5_architect_library_v1";
const LS_CONTEXT = "ue5_architect_project_context";

const ICON_MAP = {
  swords: Swords, package: Package, "messages-square": MessagesSquare,
  shield: Shield, "hard-drive": HardDrive, car: Car, sparkles: Sparkles, hand: Hand,
};

const BLUEPRINT_CLASSES = ["ActorComponent", "Actor", "Pawn", "Character", "GameInstanceSubsystem", "WheeledVehiclePawn"];

async function streamGenerate(body, onProgress) {
  const res = await fetch(`${API}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    const msg = typeof j.detail === "string" ? j.detail
      : Array.isArray(j.detail) ? j.detail.map((d) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join("; ")
      : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  const { job_id } = await res.json();
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    let job;
    try {
      const r = await fetch(`${API}/generate/${job_id}`);
      if (!r.ok) continue;
      job = await r.json();
    } catch {
      continue; // transient network blip, keep polling
    }
    onProgress(job.chars || 0);
    if (job.status === "done") return job.result;
    if (job.status === "error") throw new Error(job.detail);
  }
  throw new Error("Generation took longer than 5 minutes. Please try again.");
}

const readLib = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
};

function useLibrary() {
  const [items, setItems] = useState(readLib);
  useEffect(() => {
    const onStorage = (e) => { if (e.key === LS_KEY) setItems(readLib()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  // Applies fn to the latest stored list; returns false if storage write fails
  const update = (fn) => {
    const next = fn(readLib());
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      return false;
    }
    setItems(next);
    return true;
  };
  return { items, update };
}

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

function CodeBox({ title, code, lang = "cpp", testId }) {
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

export default function App() {
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
  const [stackSel, setStackSel] = useState([]);
  useEffect(() => { localStorage.setItem(LS_CONTEXT, projectContext); }, [projectContext]);
  const { items: library, update: updateLibrary } = useLibrary();

  useEffect(() => {
    axios.get(`${API}/templates`).then((r) => setTemplates(r.data.templates || [])).catch(() => {});
  }, []);

  const pickTemplate = (t) => {
    setPrompt(t.prompt);
    setBpClass(t.default_class || "ActorComponent");
    toast.message(`Loaded template: ${t.title}`);
  };

  const runSynthesis = async (body, context, successLabel) => {
    setLoading(true);
    setError(null);
    setProgress(0);
    try {
      const data = await streamGenerate({ ...body, project_context: projectContext }, setProgress);
      if (result) setPreviousResult(result);
      setResult({ ...data, context: { ...context, project_context: projectContext }, baseline_modules: data.modules });
      setNotes("");
      setTab(result ? "compare" : "graph");
      toast.success(successLabel(data), { description: `${data.node_graph_nodes?.length || 0} nodes · ${data.applied_changes?.length || 0} changes applied` });
      return true;
    } catch (e) {
      console.error(e);
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
      previous_system: result ? compactForApi(result) : null,
    }, { ...currentInputs, extra_modules: extra }, (d) => `${d.system_name} ${result ? "regenerated" : "generated"}`);
  };

  const stackSelected = async () => {
    const systems = library.filter((x) => stackSel.includes(x.id));
    if (systems.length < 2) return;
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
      setStackSel([]);
    }
  };
  const toggleStack = (id) => setStackSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-4)));

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

  const saveToLibrary = () => {
    if (!result) return;
    const ok = updateLibrary((lib) => [{ ...result, saved_at: new Date().toISOString() }, ...lib.filter((x) => x.id !== result.id)]);
    if (ok) toast.success("Saved to library", { description: result.system_name });
    else toast.error("Couldn't save", { description: "Browser storage is full. Delete some saved systems and try again." });
  };
  const loadFromLibrary = (item) => {
    const c = item.context;
    if (c) {
      setPrompt(c.prompt);
      setBpClass(c.blueprint_class);
      setComplexity(c.complexity);
      setModularity(c.modularity);
      setPerfFlex(c.performance_vs_flexibility);
      setTickRate(c.tick_rate);
      setReplicated(c.network_replicated);
      setExtra(c.extra_modules || []);
    }
    setResult({ ...item, baseline_modules: item.baseline_modules || item.modules });
    setPreviousResult(null);
    setNotes("");
    setTab("graph");
    toast.message(`Loaded: ${item.system_name}`);
  };
  const removeFromLibrary = (id) => {
    updateLibrary((lib) => lib.filter((x) => x.id !== id));
    setStackSel((s) => s.filter((x) => x !== id));
  };
  const exportAll = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${result.system_name.replace(/\s+/g, "_")}.json`;
    a.click(); URL.revokeObjectURL(url);
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
  ];

  return (
    <div className="App flex flex-col" data-testid="app-root">
      <Toaster theme="dark" position="top-right" toastOptions={{ style: { background: "#141923", border: "1px solid #283348", color: "#f1f5f9", fontFamily: "JetBrains Mono, monospace" } }} />

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
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-2">
          <span className="chip"><Zap size={11} /> UE 5.4+</span>
          <span className="chip"><Network size={11} /> {replicated ? "Replicated" : "Local"}</span>
          <span className="chip"><Terminal size={11} /> Claude Sonnet 4.5</span>
        </div>
        <button className="ue-btn" onClick={exportAll} disabled={!result} data-testid="export-all-btn"><Download size={13} /> Export JSON</button>
        <button className="ue-btn ue-btn-primary" onClick={saveToLibrary} disabled={!result} data-testid="save-system-button"><Save size={13} /> Save</button>
      </header>

      {/* ============ BODY ============ */}
      <div className="flex-1 flex min-h-0">

        {/* LEFT SIDEBAR */}
        <aside className="w-[320px] shrink-0 border-r border-[var(--border-soft)] bg-[var(--bg-secondary)] overflow-y-auto">
          {/* Prompt */}
          <div className="p-4 border-b border-[var(--border-soft)]">
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
              {loading ? (<><span className="inline-block h-3 w-3 rounded-full border-2 border-[#0b0e14] border-t-transparent animate-spin" /> Generating…</>)
                       : result && pendingChanges.length
                         ? (<><PlayCircle size={14} /> Regenerate with {pendingChanges.length} change{pendingChanges.length === 1 ? "" : "s"}</>)
                         : (<><PlayCircle size={14} /> Synthesize System</>)}
            </button>
          </div>

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

          {/* Saved Library */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <PackageSearch size={14} className="text-[var(--unreal-orange)]" />
                <span className="eyebrow">My Library</span>
              </div>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">{library.length}</span>
            </div>
            {library.length === 0 && <div className="text-[11px] font-mono text-[var(--text-muted)] p-2">No saved systems yet.</div>}
            {library.length >= 2 && (
              <div className="mb-2">
                <button
                  className="ue-btn w-full justify-center !border-[var(--accent-purple)] !text-[var(--accent-purple)]"
                  onClick={stackSelected}
                  disabled={loading || stackSel.length < 2}
                  data-testid="stack-systems-button"
                >
                  <Combine size={13} /> {stackSel.length < 2 ? "Tick 2+ systems to stack" : `Stack ${stackSel.length} systems`}
                </button>
              </div>
            )}
            <div className="space-y-1.5">
              {library.map((it) => (
                <div key={it.id} className={`panel p-2 flex items-center gap-2 ${stackSel.includes(it.id) ? "!border-[var(--accent-purple)]" : ""}`} data-testid={`library-item-${it.id}`}>
                  <input
                    type="checkbox"
                    checked={stackSel.includes(it.id)}
                    onChange={() => toggleStack(it.id)}
                    aria-label={`Select ${it.system_name} for stacking`}
                    className="accent-[#a855f7]"
                    data-testid={`stack-select-${it.id}`}
                  />
                  <button onClick={() => loadFromLibrary(it)} className="flex-1 text-left min-w-0">
                    <div className="font-sub text-[12px] font-semibold truncate">{it.system_name}</div>
                    <div className="text-[10px] font-mono text-[var(--text-muted)]">{new Date(it.saved_at).toLocaleString()}</div>
                  </button>
                  <button onClick={() => removeFromLibrary(it.id)} className="text-[var(--text-muted)] hover:text-[var(--accent-red)]" data-testid={`library-delete-${it.id}`}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>
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
                    {progress ? `${progress.toLocaleString()} chars streamed…` : "Claude Sonnet 4.5 is laying out blueprint nodes + C++ scaffolding."}
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
        </aside>
      </div>
    </div>
  );
}
