import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Toaster, toast } from "sonner";
import {
  Cpu, Code2, Layers, Sliders, Sparkles, Save, Download, Copy,
  Plus, Trash2, CheckCircle2, Terminal, PackageSearch, Settings,
  Boxes, ChevronDown, PlayCircle, Hammer, Wrench, GitBranch, Network, Zap,
  Swords, Package, MessagesSquare, Shield, HardDrive, Car, Hand, Workflow
} from "lucide-react";
import NodeGraph from "./components/NodeGraph";
import { highlightCpp, highlightBlueprint } from "./lib/highlight";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const LS_KEY = "ue5_architect_library_v1";

const ICON_MAP = {
  swords: Swords, package: Package, "messages-square": MessagesSquare,
  shield: Shield, "hard-drive": HardDrive, car: Car, sparkles: Sparkles, hand: Hand,
};

const BLUEPRINT_CLASSES = ["ActorComponent", "Actor", "Pawn", "Character", "GameInstanceSubsystem", "WheeledVehiclePawn"];

function useLibrary() {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
  });
  useEffect(() => { localStorage.setItem(LS_KEY, JSON.stringify(items)); }, [items]);
  return { items, setItems };
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

function SetupGuide({ steps }) {
  const [done, setDone] = useState({});
  if (!steps?.length) {
    return <div className="text-sm text-slate-500 font-mono p-6">— no setup steps yet —</div>;
  }
  return (
    <div className="space-y-2 p-4 overflow-y-auto h-full">
      {steps.map((s) => {
        const active = done[s.step];
        return (
          <button
            key={s.step}
            onClick={() => setDone((d) => ({ ...d, [s.step]: !d[s.step] }))}
            className={`w-full text-left panel p-3 flex items-start gap-3 transition-all ${active ? "border-[var(--cpp-green)] bg-[rgba(0,230,118,0.05)]" : "hover:border-[var(--unreal-orange)]"}`}
            data-testid={`setup-step-${s.step}`}
          >
            <div className={`h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center font-mono text-[11px] font-bold ${active ? "border-[var(--cpp-green)] text-[var(--cpp-green)] bg-[rgba(0,230,118,0.1)]" : "border-[var(--border)] text-[var(--text-secondary)]"}`}>
              {active ? <CheckCircle2 size={14} /> : s.step}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-sub font-semibold text-[13px] text-[var(--text-primary)]">{s.title}</div>
              <div className="text-[12px] text-[var(--text-secondary)] leading-relaxed mt-0.5 font-mono">{s.detail}</div>
            </div>
          </button>
        );
      })}
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
  const [tab, setTab] = useState("graph");
  const { items: library, setItems: setLibrary } = useLibrary();

  useEffect(() => {
    axios.get(`${API}/templates`).then((r) => setTemplates(r.data.templates || [])).catch(() => {});
  }, []);

  const pickTemplate = (t) => {
    setPrompt(t.prompt);
    setBpClass(t.default_class || "ActorComponent");
    toast.message(`Loaded template: ${t.title}`);
  };

  const generate = async () => {
    if (prompt.trim().length < 5) {
      toast.error("Describe your system in a bit more detail");
      return;
    }
    setLoading(true);
    try {
      const removed = result ? (result.modules || []).filter((m) => !m.included).map((m) => m.name) : [];
      const { data } = await axios.post(`${API}/generate`, {
        prompt,
        blueprint_class: bpClass,
        complexity,
        modularity,
        performance_vs_flexibility: perfFlex,
        tick_rate: tickRate,
        network_replicated: replicated,
        extra_modules: extra,
        removed_modules: removed,
      }, { timeout: 180000 });
      setResult(data);
      setTab("graph");
      toast.success(`${data.system_name} generated`, { description: `${data.node_graph_nodes?.length || 0} nodes · ${data.setup_guide?.length || 0} steps` });
    } catch (e) {
      console.error(e);
      toast.error("Generation failed", { description: e?.response?.data?.detail || e.message });
    } finally {
      setLoading(false);
    }
  };

  const toggleModule = (name) => {
    if (!result) return;
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
    setLibrary((lib) => [{ ...result, saved_at: new Date().toISOString() }, ...lib.filter((x) => x.id !== result.id)]);
    toast.success("Saved to library", { description: result.system_name });
  };
  const loadFromLibrary = (item) => {
    setResult(item);
    setTab("graph");
    toast.message(`Loaded: ${item.system_name}`);
  };
  const removeFromLibrary = (id) => {
    setLibrary((lib) => lib.filter((x) => x.id !== id));
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

  const TABS = [
    { id: "graph", label: "Event Graph", icon: Workflow, test: "tab-node-graph" },
    { id: "blueprint", label: "Blueprint Pseudocode", icon: GitBranch, test: "tab-blueprint-code" },
    { id: "cpp", label: "C++ Snippets", icon: Code2, test: "tab-cpp-code" },
    { id: "setup", label: "Setup Guide", icon: Hammer, test: "tab-setup-guide" },
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
              data-testid="prompt-input"
              className="w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-md p-3 text-[13px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--unreal-orange)] resize-none"
            />
            <div className="mt-2 flex items-center gap-2">
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
            <button
              className="ue-btn ue-btn-primary w-full justify-center mt-3"
              onClick={generate}
              disabled={loading}
              data-testid="generate-system-button"
            >
              {loading ? (<><span className="inline-block h-3 w-3 rounded-full border-2 border-[#0b0e14] border-t-transparent animate-spin" /> Generating…</>)
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
            <div className="space-y-1.5">
              {library.map((it) => (
                <div key={it.id} className="panel p-2 flex items-center gap-2" data-testid={`library-item-${it.id}`}>
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
                  <div className="mt-4 text-[11px] font-mono text-[var(--text-muted)]">Claude Sonnet 4.5 is laying out blueprint nodes + C++ scaffolding.</div>
                </div>
              </div>
            )}

            {tab === "graph" && <NodeGraph nodes={result?.node_graph_nodes || []} edges={result?.node_graph_edges || []} />}
            {tab === "blueprint" && (
              <div className="p-5 h-full overflow-auto">
                <CodeBox title="Blueprint Pseudocode" code={result?.blueprint_pseudocode} lang="bp" testId="blueprint-code" />
              </div>
            )}
            {tab === "cpp" && (
              <div className="p-5 h-full overflow-auto grid md:grid-cols-2 gap-4">
                <CodeBox title={`${result?.system_name || "System"}.h`} code={result?.cpp_header} lang="cpp" testId="cpp-header" />
                <CodeBox title={`${result?.system_name || "System"}.cpp`} code={result?.cpp_source} lang="cpp" testId="cpp-source" />
              </div>
            )}
            {tab === "setup" && <SetupGuide steps={result?.setup_guide || []} />}
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
              <div className="mt-2 text-[10.5px] font-mono text-[var(--text-muted)]">Values update your local preview — they feed back into the model on next Synthesize.</div>
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
              {extra.map((x) => (
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
