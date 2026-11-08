import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Cpu, Code2, Layers, Sliders, Sparkles, Save, Download, Copy,
  Plus, Trash2, CheckCircle2, Terminal, PackageSearch, Settings,
  Boxes, ChevronDown, PlayCircle, Hammer, Wrench, GitBranch, Network, Zap,
  Swords, Package, MessagesSquare, Shield, HardDrive, Car, Hand, Workflow,
  GitCompareArrows, Compass, StickyNote, Share2, FolderClosed, Eye, Pencil, KeyRound, FileArchive, History, Tag, ChevronDown as Caret, AlertTriangle
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
import UsageChip, { modelUsage, useUsage } from "../components/UsageChip";
import { baseName, buildPluginZip, buildProjectZip } from "../lib/zipExport";
import AiKeyModal, { DEFAULT_MODEL, PROVIDERS, aiHeaders, loadAiKey, saveAiKey } from "../components/AiKeyModal";
import { CodeBox } from "../components/CodeBox";
import CompileCheck, { IssueList, useAiReview } from "../components/CompileCheck";
import BundleModal from "../components/BundleModal";
import HistoryModal from "../components/HistoryModal";
import { checkSystem, issueKey, issueText, issuesToText, locateIssue } from "../lib/compileCheck";
import FixReviewModal from "../components/FixReviewModal";

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
    if (job.status === "error") throw Object.assign(new Error(job.detail), { code: job.error_code });
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
  useEffect(() => {
    const onStorage = (e) => { if (e.key === "ue5_architect_ai_key") setAiKey(loadAiKey()); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState([]);
  const [compareBase, setCompareBase] = useState("previous"); // "previous" | version number
  const [baseSystem, setBaseSystem] = useState(null);
  const [usageTick, setUsageTick] = useState(0);
  const [restoring, setRestoring] = useState(false);
  const usage = useUsage(aiKey, usageTick);
  const [limitPrompt, setLimitPrompt] = useState(null);
  const [zipMenu, setZipMenu] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  const [exportPrompt, setExportPrompt] = useState(null);
  const [bundle, setBundle] = useState(null); // {ids, preset}
  const [ignores, setIgnores] = useState([]); // [{key, file, message}] saved per project
  const [jump, setJump] = useState(null); // {file, line, nonce}
  const [fix, setFix] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
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

  const runSynthesis = async (body, context, successLabel, opts = {}) => {
    const key = opts.key || aiKey;
    if (!key) {
      setKeyModal("required");
      toast.error("Add your AI key to synthesize");
      return false;
    }
    if (!opts.skipLimit) {
      const { used, limit } = modelUsage(usage, key.provider, key.model);
      // a synthesis can take up to 3 requests when the model is busy
      if (limit && used + 3 > limit * 0.85) {
        const alt = Object.entries(usage.free_limits)
          .filter(([m, l]) => m !== key.model && l > 0)
          .map(([m, l]) => ({ model: m, left: l - (usage.models[m]?.used || 0) }))
          .sort((a, b) => b.left - a.left)[0];
        setLimitPrompt({ body, context, successLabel, used, limit, model: key.model, alt: alt && alt.left > limit - used ? alt : null });
        return false;
      }
    }
    const startedOn = project?.project_id || null;
    setLoading(true);
    setError(null);
    setProgress(0);
    try {
      const data = await streamGenerate({ ...body, project_context: projectContext, reference_file_ids: references.map((r) => r.file_id) }, setProgress, key, () => aliveRef.current);
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
      setError(e.code === "paid_model_required" ? { text: detail, paid: true } : detail);
      toast.error("Generation failed", { description: detail, duration: 10000 });
      return false;
    } finally {
      setLoading(false);
      setUsageTick((n) => n + 1);
    }
  };

  const continueFromLimit = async (switchTo) => {
    const p = limitPrompt;
    setLimitPrompt(null);
    let key = aiKey;
    if (switchTo) {
      key = { ...aiKey, model: switchTo };
      saveAiKey(key);
      setAiKey(key);
      toast.success(`Switched to ${switchTo}`);
    }
    const ok = await runSynthesis(p.body, p.context, p.successLabel, { key, skipLimit: true });
    if (ok && p.body.stack_systems) { setPrompt(p.body.prompt); setExtra([]); setProject(null); setIgnores([]); }
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
      setIgnores([]);
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
    const savingFor = project?.project_id || null;
    const note = saveNote.trim().slice(0, 200);
    setSaving(true);
    try {
      const { data } = project && !readOnly
        ? await api.put(`/projects/${project.project_id}`, { system, context, note, base_version: project.version, force })
        : await api.post("/projects", { name: result.system_name, system, context, note });
      const { system: _s, context: _c, ...meta } = data;
      if ((projectRef.current?.project_id || null) === savingFor) {
        setProject(meta);
        setConflict(null);
        if (!savingFor && ignores.length) api.put(`/projects/${data.project_id}/ignores`, { ignores }).catch(() => {});
      }
      setProjRefresh((n) => n + 1);
      setSaveDialog(false);
      setSaveNote("");
      toast.success(project ? `Saved v${data.version}` : "Saved as new project", { description: note ? `${data.name}: ${note}` : data.name });
    } catch (e) {
      setSaveDialog(false);
      if ((projectRef.current?.project_id || null) !== savingFor) toast.error("Couldn't save the project you switched away from", { description: errorText(e) });
      else if (e.response?.status === 409) setConflict(e.response.data.detail);
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
      setIgnores(meta.ignored_issues || []);
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
  const exportZip = async (kind, force = false) => {
    if (!result) return;
    setZipMenu(false);
    if (!force && exportIssues.length) { setExportPrompt(kind); return; }
    setExportPrompt(null);
    const { system, context } = splitResult();
    const build = kind === "plugin" ? buildPluginZip : buildProjectZip;
    let built;
    try {
      built = await build(project?.name || result.system_name, system, { ...context, references: undefined });
    } catch (e) {
      toast.error("Couldn't build the zip", { description: e.message });
      return;
    }
    const { blob, filename } = built;
    downloadBlob(blob, filename);
    toast.success(`Downloaded ${filename}`, {
      description: kind === "plugin" ? "Copy the folder into YourProject/Plugins and build. No code edits needed." : "Public/.h, Private/.cpp, SETUP.md and README.md",
    });
  };

  const restoreVersion = async () => {
    if (typeof compareBase !== "number" || !project) return;
    if (pendingChanges.length && !window.confirm(`Restore v${compareBase}? Your ${pendingChanges.length} unsynthesized change(s) will be discarded.`)) return;
    setRestoring(true);
    try {
      const pid = project.project_id;
      const { data } = await api.post(`/projects/${pid}/versions/${compareBase}/restore`);
      if (projectRef.current?.project_id !== pid) return;
      const { system, context, ...meta } = data;
      const from = compareBase;
      setProject(meta);
      openSystem(system, context);
      setProjRefresh((n) => n + 1);
      toast.success(`Restored v${from} as v${meta.version}`, { description: "Nothing is lost: the version you replaced is still in history." });
    } catch (e) {
      toast.error("Couldn't restore", { description: errorText(e) });
    } finally {
      setRestoring(false);
    }
  };

  const copyJson = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(exportData(), null, 2));
    toast.success("Project JSON copied");
  };

  useEffect(() => {
    if (tab !== "compare" || !project) { setVersions([]); return; }
    const pid = project.project_id;
    api.get(`/projects/${pid}/versions`)
      .then((r) => { if (projectRef.current?.project_id === pid) setVersions(r.data.versions); })
      .catch(() => setVersions([]));
  }, [tab, project?.project_id, project?.version]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setCompareBase("previous"); setBaseSystem(null); }, [project?.project_id]);

  const pickBase = async (value) => {
    if (value === "previous") { setCompareBase("previous"); setBaseSystem(null); return; }
    const v = Number(value);
    try {
      const pid = project.project_id;
      const { data } = await api.get(`/projects/${pid}/versions/${v}`);
      if (projectRef.current?.project_id !== pid) return;
      setCompareBase(v);
      setBaseSystem({ ...data.system, context: data.context, version_label: `v${v}${data.label ? ` · ${data.label}` : ` · ${data.saved_by_name}`}` });
    } catch (e) { toast.error(errorText(e)); }
  };

  const compareBefore = compareBase === "previous" ? previousResult : baseSystem;
  const canRestore = typeof compareBase === "number" && compareBase !== project?.version && project && !readOnly;
  const labelVersion = async () => {
    const current = versions.find((v) => v.version === compareBase);
    const label = window.prompt(`Name v${compareBase} (leave empty to remove the name)`, current?.label || "");
    if (label === null) return;
    try {
      const { data } = await api.patch(`/projects/${project.project_id}/versions/${compareBase}`, { label: label.trim().slice(0, 60) });
      setVersions((vs) => vs.map((v) => (v.version === data.version ? { ...v, label: data.label } : v)));
      setBaseSystem((b) => b && { ...b, version_label: `v${data.version}${data.label ? ` · ${data.label}` : ""}` });
      toast.success(data.label ? `Named v${data.version} "${data.label}"` : `Removed the name from v${data.version}`);
    } catch (e) { toast.error(errorText(e)); }
  };
  const versionOption = (v) => (
    <option key={v.version} value={v.version}>
      {v.label ? `★ ${v.label} · ` : ""}v{v.version}{v.version === project?.version ? " (latest)" : ""} · {v.saved_by_name} · {new Date(v.saved_at).toLocaleString()}{v.note ? ` · ${v.note.length > 40 ? `${v.note.slice(0, 40)}…` : v.note}` : ""}
    </option>
  );
  const labeled = versions.filter((v) => v.label);
  const baseNote = typeof compareBase === "number" ? versions.find((v) => v.version === compareBase)?.note : "";
  const versionPicker = (versions.length > 0 || previousResult) ? (
    <>
    <select value={String(compareBase)} onChange={(e) => pickBase(e.target.value)} aria-label="Compare against"
      className="bg-[var(--bg-main)] border border-[var(--border)] rounded-md px-2 py-1 text-[11px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--unreal-orange)]" data-testid="compare-base-select">
      <option value="previous" disabled={!previousResult}>Previous synthesis{previousResult ? "" : " (none yet)"}</option>
      {labeled.length > 0 && <optgroup label="Named versions">{labeled.map(versionOption)}</optgroup>}
      {versions.length > 0 && <optgroup label="All saved versions">{versions.map(versionOption)}</optgroup>}
    </select>
    {typeof compareBase === "number" && project && !readOnly && (
      <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={labelVersion} data-testid="label-version-button">
        <Tag size={12} /> {versions.find((v) => v.version === compareBase)?.label ? "Rename" : "Name"} v{compareBase}
      </button>
    )}
    {versions.length > 0 && (
      <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={() => setHistoryOpen(true)} data-testid="history-button"><History size={12} /> History</button>
    )}
    {baseNote && (
      <span className="text-[11px] font-mono text-[var(--text-secondary)] truncate max-w-[320px]" title={baseNote} data-testid="compare-version-note">“{baseNote}”</span>
    )}
    {canRestore && (
      <button className="ue-btn !py-1 !px-2 !text-[11px] !border-[var(--cpp-green)] !text-[var(--cpp-green)]" onClick={restoreVersion} disabled={restoring} data-testid="restore-version-button">
        <History size={12} /> {restoring ? "Restoring…" : `Restore v${compareBase}`}
      </button>
    )}
    </>
  ) : null;

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

  const checkIssues = useMemo(() => (result ? checkSystem(result) : []), [result?.cpp_header, result?.cpp_source]); // eslint-disable-line react-hooks/exhaustive-deps
  const ignoreKeys = useMemo(() => new Set(ignores.map((i) => i.key)), [ignores]);
  const keyedIssues = useMemo(() => checkIssues.map((i) => ({ ...i, key: issueKey(i, result) })), [checkIssues]); // eslint-disable-line react-hooks/exhaustive-deps
  const activeIssues = keyedIssues.filter((i) => !ignoreKeys.has(i.key));
  const ignoredIssues = keyedIssues.filter((i) => ignoreKeys.has(i.key));
  const checkErrors = activeIssues.filter((i) => i.severity === "error").length;
  const [aiReview, runAiReview] = useAiReview(result, activeIssues, aiKey, () => setKeyModal("required"), () => setUsageTick((n) => n + 1));
  const exportIssues = aiReview?.status === "done" ? [...activeIssues, ...aiReview.issues.map((i) => ({ ...i, message: `AI review: ${i.message}` }))] : activeIssues;
  const exportErrors = exportIssues.filter((i) => i.severity === "error").length;

  useEffect(() => { setJump(null); }, [result?.id]);
  const jumpTo = (issue) => {
    if (!result) return;
    setExportPrompt(null);
    setTab("cpp");
    setJump({ ...locateIssue(issue, result), nonce: Date.now() });
  };
  const ignoreQueue = useRef(Promise.resolve());
  const saveIgnores = (next) => {
    setIgnores(next);
    if (!project || readOnly) return;
    const pid = project.project_id;
    // Whole-list writes are queued so a slower earlier write can't overwrite a later one
    ignoreQueue.current = ignoreQueue.current.then(() => api.put(`/projects/${pid}/ignores`, { ignores: next })
      .catch((e) => toast.error("Couldn't save ignored issues", { description: errorText(e) })));
  };
  const ignoreIssue = (i) => { saveIgnores([...ignores, { key: i.key, file: i.file, message: i.message.slice(0, 400) }]); toast.message("Issue ignored", { description: "Restore it from the Ignored list." }); };
  const restoreIssue = (i) => saveIgnores(ignores.filter((x) => x.key !== i.key));
  const copyIssues = async (list) => {
    try {
      await navigator.clipboard.writeText(issuesToText(list));
      toast.success(`Copied ${list.length} issue${list.length === 1 ? "" : "s"}`);
    } catch { toast.error("Your browser blocked the clipboard"); }
  };
  const runFix = async (list) => {
    if (!aiKey) { setKeyModal("required"); toast.error("Add your AI key to fix issues"); return; }
    const { used, limit } = modelUsage(usage, aiKey.provider, aiKey.model);
    if (limit && used + 1 > limit * 0.85 && !window.confirm(`You've used about ${used} of ~${limit} free ${aiKey.model} requests today. Fix anyway?`)) return;
    const before = { id: result.id, h: result.cpp_header || "", c: result.cpp_source || "" };
    setFix({ status: "running", count: list.length, list, before });
    try {
      const { data } = await api.post("/ai/fix-cpp", {
        file_base: baseName(result), cpp_header: before.h, cpp_source: before.c, project_id: project?.project_id || null,
        issues: list.slice(0, 40).map((i) => `${issueText(i)}${i.fix ? ` (suggested fix: ${i.fix})` : ""}`),
      }, { headers: aiHeaders(aiKey) });
      setFix((f) => (f?.list === list ? { ...f, status: "review", data } : f));
    } catch (e) {
      const d = e.response?.data?.detail;
      setFix((f) => (f?.list === list ? { ...f, status: "error", error: d?.message || errorText(e) } : f));
    } finally {
      setUsageTick((n) => n + 1);
    }
  };
  const acceptFix = () => {
    const { data, list, before } = fix;
    if (result?.id !== before.id || (result.cpp_header || "") !== before.h || (result.cpp_source || "") !== before.c) {
      setFix({ ...fix, status: "error", error: "The code changed while the fix was being written, so it wasn't applied." });
      return;
    }
    const next = { ...result, cpp_header: data.cpp_header, cpp_source: data.cpp_source };
    setResult(next);
    setFix(null);
    const sig = (i) => `${i.file}|${i.message}`;
    const after = checkSystem(next).filter((i) => !ignoreKeys.has(issueKey(i, next)));
    const afterSigs = new Set(after.map(sig));
    const beforeSigs = new Set(keyedIssues.map(sig));
    const builtIn = list.filter((i) => i.key);
    const cleared = builtIn.filter((i) => !afterSigs.has(sig(i))).length;
    const fresh = after.filter((i) => !beforeSigs.has(sig(i))).length;
    const aiCount = list.length - builtIn.length;
    toast.success(builtIn.length ? `Cleared ${cleared} of ${builtIn.length} issue${builtIn.length === 1 ? "" : "s"}` : `Applied ${data.changes.length} change${data.changes.length === 1 ? "" : "s"}`, {
      description: [after.length ? `${after.length} still listed${fresh ? ` (${fresh} new)` : ""}.` : "The compile check is clean.", aiCount ? "Run AI review again to confirm the AI findings." : "", "Press Save to keep it."].filter(Boolean).join(" "),
      duration: 10000,
      action: {
        label: "Undo fix",
        onClick: () => setResult((r) => (r?.id === before.id && r.cpp_header === data.cpp_header && r.cpp_source === data.cpp_source ? { ...r, cpp_header: before.h, cpp_source: before.c } : r)),
      },
    });
    setTab("cpp");
  };

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
        <div className="hidden min-[2200px]:flex items-center gap-2">
          <span className="chip"><Zap size={11} /> UE 5.4+</span>
          <span className="chip"><Network size={11} /> {replicated ? "Replicated" : "Local"}</span>
          <span className="chip"><Terminal size={11} /> {aiKey ? aiKey.model : "No AI key"}</span>
        </div>
        {project?.my_role === "owner" && <button className="ue-btn" onClick={() => setShareOpen(true)} data-testid="share-button"><Share2 size={13} /> Share</button>}
        <button className="ue-btn" onClick={copyJson} disabled={!result} data-testid="copy-json-btn"><Copy size={13} /> Copy JSON</button>
        <button className="ue-btn" onClick={exportAll} disabled={!result} data-testid="export-all-btn"><Download size={13} /> JSON</button>
        <div className="relative">
          <button className="ue-btn" onClick={() => setZipMenu((v) => !v)} disabled={!result} aria-expanded={zipMenu} data-testid="export-zip-btn"><FileArchive size={13} /> UE5 .zip <Caret size={12} /></button>
          {zipMenu && (
            <div className="absolute right-0 top-full mt-1 z-40 panel w-[290px] p-1.5 shadow-2xl" data-testid="export-zip-menu">
              <button className="w-full text-left px-2.5 py-2 rounded hover:bg-[var(--surface-hover)]" onClick={() => exportZip("plugin")} data-testid="export-plugin-zip">
                <div className="font-sub text-[13px] font-semibold">Unreal plugin <span className="chip active !py-0 !text-[9.5px] ml-1">RECOMMENDED</span></div>
                <div className="text-[10.5px] font-mono text-[var(--text-muted)]">Drop into Plugins/ and build. No code edits.</div>
              </button>
              <button className="w-full text-left px-2.5 py-2 rounded hover:bg-[var(--surface-hover)]" onClick={() => exportZip("source")} data-testid="export-source-zip">
                <div className="font-sub text-[13px] font-semibold">Source files only</div>
                <div className="text-[10.5px] font-mono text-[var(--text-muted)]">.h/.cpp to add to your own game module</div>
              </button>
            </div>
          )}
        </div>
        <button className="ue-btn ue-btn-primary" onClick={() => setSaveDialog(true)} disabled={!result || readOnly || saving} data-testid="save-system-button"><Save size={13} /> {project ? "Save" : "Save project"}</button>
        <UsageChip aiKey={aiKey} usage={usage} />
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
            onDeleted={(id) => { if (project?.project_id === id) setProject(null); }} onStack={stackSelected} onBundle={(ids, preset) => setBundle({ ids, preset })} busy={loading} />
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
                    {t.id === "cpp" && activeIssues.length > 0 && (
                      <span className={`ml-0.5 rounded-full px-1.5 text-[9.5px] font-mono leading-[15px] ${checkErrors ? "bg-[var(--accent-red)] text-white" : "bg-[#e8c547] text-[#0b0e14]"}`} data-testid="cpp-issue-badge">{activeIssues.length}</span>
                    )}
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
                    {progress ? `${progress.toLocaleString()} chars streamed…` : `${aiKey?.model || "The model"} is laying out blueprint nodes + C++ scaffolding. This usually takes 20–90 seconds.`}
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
                    <div className="text-[12px] font-mono text-[var(--text-secondary)] mt-1 leading-relaxed">{error.text || error}</div>
                    {error.paid && (
                      <button className="ue-btn !py-1 !px-2 !text-[11px] mt-2" data-testid="banner-switch-free-model"
                        onClick={() => {
                          setError(null);
                          if (aiKey?.provider !== "gemini") { setKeyModal("required"); toast.message("Add a free Gemini key to switch"); return; }
                          const k = { ...aiKey, model: DEFAULT_MODEL }; saveAiKey(k); setAiKey(k); toast.success("Switched to Gemini 3.5 Flash-Lite");
                        }}>
                        Switch to Gemini 3.5 Flash-Lite
                      </button>
                    )}
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
              <div className="p-5 h-full overflow-auto">
                {result && <CompileCheck issues={activeIssues} ignored={ignoredIssues} ai={aiReview} onReview={runAiReview} aiKey={aiKey} canEdit={!readOnly}
                  fixing={fix?.status === "running"} onJump={jumpTo} onFix={runFix} onIgnore={ignoreIssue} onRestore={restoreIssue} onCopy={copyIssues} />}
                <div className="grid md:grid-cols-2 gap-4">
                  <CodeBox title={`${result ? baseName(result) : "System"}.h`} code={result?.cpp_header} lang="cpp" testId="cpp-header" target={jump?.file === ".h" ? jump : null} />
                  <CodeBox title={`${result ? baseName(result) : "System"}.cpp`} code={result?.cpp_source} lang="cpp" testId="cpp-source" target={jump?.file === ".cpp" ? jump : null} />
                </div>
              </div>
            )}
            {tab === "setup" && <SetupGuide steps={result?.setup_guide || []} />}
            {tab === "compare" && <CompareView before={compareBefore} after={result} picker={versionPicker} />}
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
        <AiKeyModal current={aiKey} required={keyModal === "required"} onClose={() => { setKeyModal(null); setUsageTick((n) => n + 1); }}
          onSave={(k) => { setAiKey(k); setKeyModal(null); setUsageTick((n) => n + 1); }} />
      )}
      {limitPrompt && (
        <Modal title="Close to today's free limit" onClose={() => setLimitPrompt(null)} testId="limit-warning-modal" width={480}>
          <div className="flex gap-3 mb-4">
            <AlertTriangle size={18} className="shrink-0 text-[#e8c547] mt-0.5" />
            <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed" data-testid="limit-warning-text">
              {limitPrompt.used >= limitPrompt.limit ? "You've used" : "You've used about"} <b className="text-[var(--text-primary)]">{limitPrompt.used} of ~{limitPrompt.limit}</b> free {limitPrompt.model} requests today with this key.
              {" "}A synthesis can take up to 3 requests if the model is busy, and Google may refuse once the limit is reached. It resets at midnight Pacific time.
              {limitPrompt.alt && <> Each Gemini model has its own free quota: <b className="text-[var(--text-primary)]">{limitPrompt.alt.model}</b> has about {limitPrompt.alt.left} left.</>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button className="ue-btn" onClick={() => setLimitPrompt(null)} data-testid="limit-cancel">Cancel</button>
            <button className="ue-btn" onClick={() => continueFromLimit(null)} data-testid="limit-continue">Synthesize anyway</button>
            {limitPrompt.alt && (
              <button className="ue-btn ue-btn-primary" onClick={() => continueFromLimit(limitPrompt.alt.model)} data-testid="limit-switch-model">Switch to {limitPrompt.alt.model} and synthesize</button>
            )}
          </div>
        </Modal>
      )}
      {saveDialog && (
        <Modal title={project && !readOnly ? `Save v${project.version + 1}` : "Save project"} onClose={() => setSaveDialog(false)} testId="save-modal" width={460}>
          <form onSubmit={(e) => { e.preventDefault(); saveProject(false); }}>
            <label htmlFor="save-note" className="eyebrow">What changed and why? <span className="normal-case tracking-normal font-normal">(optional)</span></label>
            <textarea id="save-note" autoFocus value={saveNote} onChange={(e) => setSaveNote(e.target.value)} maxLength={200} rows={3}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveProject(false); } }}
              placeholder={result?.applied_changes?.[0] ? `e.g. ${result.applied_changes[0].slice(0, 90)}` : "e.g. Moved stamina into its own component so AI can reuse it"}
              className="w-full mt-1 bg-[var(--bg-main)] border border-[var(--border)] rounded-md p-2.5 text-[12px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--unreal-orange)] resize-none" data-testid="save-note-input" />
            <div className="flex items-center justify-between mt-1 mb-4 text-[10.5px] font-mono text-[var(--text-muted)]">
              <span>Shown in version history. Enter saves.</span><span data-testid="save-note-count">{saveNote.length}/200</span>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" className="ue-btn" onClick={() => setSaveDialog(false)} data-testid="save-cancel">Cancel</button>
              <button className="ue-btn ue-btn-primary" disabled={saving} data-testid="save-confirm"><Save size={13} /> {saving ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}
      {exportPrompt && (
        <Modal title="Check before export" onClose={() => setExportPrompt(null)} testId="export-check-modal" width={560}>
          <div className="text-[13px] text-[var(--text-secondary)] mb-3" data-testid="export-check-text">
            The compile check found {exportErrors} likely error{exportErrors === 1 ? "" : "s"} and {exportIssues.length - exportErrors} warning{exportIssues.length - exportErrors === 1 ? "" : "s"}. Click one to see it in the code, use Fix these in the C++ tab, or export as it is.
          </div>
          <div className="max-h-[300px] overflow-y-auto panel p-3 mb-4"><IssueList issues={exportIssues} testId="export-check-issues" onJump={jumpTo} /></div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button className="ue-btn" onClick={() => { setExportPrompt(null); setTab("cpp"); }} data-testid="export-check-review">Review in C++ tab</button>
            <button className="ue-btn ue-btn-primary" onClick={() => exportZip(exportPrompt, true)} data-testid="export-check-anyway"><FileArchive size={13} /> Export anyway</button>
          </div>
        </Modal>
      )}
      {bundle && <BundleModal ids={bundle.ids} preset={bundle.preset} onClose={() => setBundle(null)} onPresetsChanged={() => setProjRefresh((n) => n + 1)} />}
      {fix && result && (
        <FixReviewModal fix={fix} system={result} base={baseName(result)} onAccept={acceptFix} onDiscard={() => setFix(null)} onRetry={() => runFix(fix.list)} />
      )}
      {historyOpen && (
        <HistoryModal versions={versions} current={project?.version} onClose={() => setHistoryOpen(false)}
          onCompare={(v) => { setHistoryOpen(false); pickBase(String(v)); }} />
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
