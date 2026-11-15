import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Cpu, Code2, Layers, FlaskConical, ClipboardCopy, Sliders, Sparkles, Save, Download, Copy,
  Plus, Trash2, CheckCircle2, Terminal, PackageSearch,
  Boxes, ChevronDown, PlayCircle, Hammer, Wrench, GitBranch, Network, Zap,
  Swords, Package, MessagesSquare, Shield, HardDrive, Car, Hand, Workflow,
  GitCompareArrows, Compass, StickyNote, FolderClosed, Eye, Pencil, KeyRound, FileArchive, History, Tag, ChevronDown as Caret, AlertTriangle,
  FilePlus, MessageSquarePlus
} from "lucide-react";
import NodeGraph from "../components/NodeGraph";
import AnnotatedPseudocode from "../components/AnnotatedPseudocode";
import SetupGuide from "../components/SetupGuide";
import CompareView from "../components/CompareView";
import { PendingChanges, AppliedChanges } from "../components/ChangePanels";
import { computeChanges, compactForApi } from "../lib/changes";
import { api, errorText, downloadBlob, exportPayload } from "../lib/api";
import ProjectsPanel from "../components/ProjectsPanel";
import Modal from "../components/Modal";
import { ReferencesBar, ProjectFiles } from "../components/Files";
import UsageChip, { modelUsage, useUsage } from "../components/UsageChip";
import { baseName, buildPluginZip, buildProjectZip } from "../lib/zipExport";
import AiKeyModal, { DEFAULT_MODEL, aiHeaders, saveAiKey, settingsToKey } from "../components/AiKeyModal";
import { CodeBox } from "../components/CodeBox";
import TestsPanel, { testIssues } from "../components/TestsPanel";
import { blueprintClipboard, compileReport, reportSection } from "../lib/unrealExtras";
import CompileCheck, { IssueList, useAiReview } from "../components/CompileCheck";
import BundleModal from "../components/BundleModal";
import HistoryModal from "../components/HistoryModal";
import { checkSystem, issueKey, issueText, issuesToText, locateIssue } from "../lib/compileCheck";
import FixReviewModal, { FixDetailModal } from "../components/FixReviewModal";
import { fixNote, makeFixEntry, undoFixEntry } from "../lib/fixLog";
import {
  blankSnapshot, compileHeadline, DEFAULT_UNREAL_VERSION, DIAL_DEFAULTS, feedbackUrl, FEEDBACK_CATEGORIES,
  isWorkspaceDirty, LEGACY_UNREAL_VERSION, LS_CONTEXT, LS_UNREAL_VERSION, normalizeUnrealVersion,
  resultSignature, saveRequest, setupDoneList, setupDoneMap, UNREAL_VERSIONS, workspaceSnapshot,
} from "../lib/stage0.mjs";
import { APP_VERSION } from "../lib/shell.mjs";
import { draftToSnapshotInput } from "../lib/workspaceSession.mjs";
import { useShell } from "../shell/ShellContext";

const LS_KEY = "ue5_architect_library_v1";
const STOCK_PROMPT = "A third-person melee combat system with combo chains, directional attacks, hit reactions, and hitstop.";

function readStoredContext() {
  try { return localStorage.getItem(LS_CONTEXT) || ""; } catch { return ""; }
}
function readStoredVersion() {
  try { return normalizeUnrealVersion(localStorage.getItem(LS_UNREAL_VERSION)) || DEFAULT_UNREAL_VERSION; }
  catch { return DEFAULT_UNREAL_VERSION; }
}

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

const MIGRATION_KEY = "ue5_architect_migrated_local";
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
  const shell = useShell();
  const session = shell.session;
  // Restore the in-progress system from the app session. A plain value is
  // copied so later edits don't rewrite the stored draft in place.
  const readDraft = (key, fallback) => {
    const draft = session.get();
    if (draft && Object.prototype.hasOwnProperty.call(draft, key)) {
      const value = draft[key];
      if (value && typeof value === "object") return JSON.parse(JSON.stringify(value));
      return value;
    }
    return typeof fallback === "function" ? fallback() : fallback;
  };
  const tunableGuard = useRef(undefined);
  if (tunableGuard.current === undefined) {
    const existing = session.get();
    tunableGuard.current = existing?.result?.id && existing.tunable && Object.keys(existing.tunable).length
      ? existing.result.id
      : false;
  }
  const [templates, setTemplates] = useState([]);
  const [prompt, setPrompt] = useState(() => readDraft("prompt", STOCK_PROMPT));
  const [bpClass, setBpClass] = useState(() => readDraft("bpClass", "ActorComponent"));
  const [complexity, setComplexity] = useState(() => readDraft("complexity", 55));
  const [modularity, setModularity] = useState(() => readDraft("modularity", 75));
  const [perfFlex, setPerfFlex] = useState(() => readDraft("perfFlex", 50));
  const [tickRate, setTickRate] = useState(() => readDraft("tickRate", 30));
  const [replicated, setReplicated] = useState(() => readDraft("replicated", false));
  const [extra, setExtra] = useState(() => readDraft("extra", []));           // user-added modules
  const [newExtra, setNewExtra] = useState(() => readDraft("newExtra", ""));
  const [result, setResult] = useState(() => readDraft("result", null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [tab, setTab] = useState(() => readDraft("tab", "graph"));
  const [previousResult, setPreviousResult] = useState(() => readDraft("previousResult", null));
  const [notes, setNotes] = useState(() => readDraft("notes", ""));
  const [projectContext, setProjectContext] = useState(() => readDraft("projectContext", readStoredContext));
  const [unrealVersion, setUnrealVersion] = useState(() => readDraft("unrealVersion", readStoredVersion));
  const [setupDone, setSetupDone] = useState(() => readDraft("setupDone", {}));
  const [tunable, setTunable] = useState(() => readDraft("tunable", {}));
  const [appInfo, setAppInfo] = useState({ version: APP_VERSION, update: null });
  const [newProjectAsk, setNewProjectAsk] = useState(null);
  const [templateAsk, setTemplateAsk] = useState(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [baseline, setBaseline] = useState(() => readDraft("baseline", () => workspaceSnapshot({
    prompt: STOCK_PROMPT,
    blueprint_class: "ActorComponent",
    complexity: 55,
    modularity: 75,
    performance_vs_flexibility: 50,
    tick_rate: 30,
    network_replicated: false,
    extra: [],
    notes: "",
    new_extra: "",
    project_context: readStoredContext(),
    references: [],
    setup_done: [],
    unreal_version: readStoredVersion(),
    result_sig: "",
    project_id: null,
  })));
  const [project, setProject] = useState(() => readDraft("project", null));
  const [references, setReferences] = useState(() => readDraft("references", []));
  const [conflict, setConflict] = useState(null);
  const [projRefresh, setProjRefresh] = useState(0);
  const [migration, setMigration] = useState(null);
  const readOnly = project?.my_role === "viewer";
  const [aiKey, setAiKey] = useState(null);
  const [keyModal, setKeyModal] = useState(null); // null | "edit" | "required"
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState([]);
  const [versionsReady, setVersionsReady] = useState(false);
  const [viewingVersion, setViewingVersion] = useState(null);
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
  const [ignores, setIgnores] = useState(() => readDraft("ignores", [])); // [{key, file, message}] saved per project
  const [jump, setJump] = useState(null); // {file, line, nonce}
  const [fix, setFix] = useState(null);
  const [fixNotes, setFixNotes] = useState(() => readDraft("fixNotes", [])); // pre-fill the next save note
  const [fixLog, setFixLog] = useState(() => readDraft("fixLog", [])); // accepted patches, saved with the next version
  const [viewFix, setViewFix] = useState(null); // {entry, pending}
  const [historyOpen, setHistoryOpen] = useState(false);
  const projectRef = useRef(null);
  projectRef.current = project;
  const aliveRef = useRef(true);
  const epochRef = useRef(0);
  const afterSaveRef = useRef(null);
  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // The shell owns this copy, so Home can show the chip and a later visit
  // can restore the same system if this screen is created again.
  const draftSnapshot = {
    prompt, bpClass, complexity, modularity, perfFlex, tickRate, replicated,
    extra, newExtra, result, previousResult, notes, projectContext,
    unrealVersion, setupDone, tunable, baseline, project, references,
    ignores, fixNotes, fixLog, tab,
  };
  const draftJson = JSON.stringify(draftSnapshot);
  useEffect(() => {
    session.replace(JSON.parse(draftJson));
  }, [draftJson, session]);
  useEffect(() => {
    if (projectContext) localStorage.setItem(LS_CONTEXT, projectContext);
    else localStorage.removeItem(LS_CONTEXT);
  }, [projectContext]);

  useEffect(() => {
    api.get("/app").then((r) => setAppInfo(r.data || {})).catch(() => {});
    api.get("/templates").then((r) => setTemplates(r.data.templates || [])).catch(() => {});
    api.get("/settings").then((r) => setAiKey(settingsToKey(r.data))).catch(() => {});
    const pending = readLocalLibrary();
    if (pending.length && !localStorage.getItem(MIGRATION_KEY)) setMigration(pending);
    const pid = new URLSearchParams(window.location.search).get("project");
    if (pid) {
      openProject(pid);
      window.history.replaceState(null, "", "/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const liveSnapshot = (overrides = {}) => workspaceSnapshot({
    ...draftToSnapshotInput({
      prompt, bpClass, complexity, modularity, perfFlex, tickRate, replicated,
      extra, notes, newExtra, projectContext, references, setupDone, unrealVersion,
      result, tunable, project,
    }),
    ...overrides,
  });

  const applyBlank = ({ keepContext = false } = {}) => {
    epochRef.current += 1;
    const context = keepContext ? projectContext : "";
    const version = readStoredVersion();
    setPrompt(DIAL_DEFAULTS.prompt);
    setBpClass(DIAL_DEFAULTS.blueprint_class);
    setComplexity(DIAL_DEFAULTS.complexity);
    setModularity(DIAL_DEFAULTS.modularity);
    setPerfFlex(DIAL_DEFAULTS.performance_vs_flexibility);
    setTickRate(DIAL_DEFAULTS.tick_rate);
    setReplicated(DIAL_DEFAULTS.network_replicated);
    setExtra([]);
    setNewExtra("");
    setResult(null);
    setPreviousResult(null);
    setNotes("");
    setProjectContext(context);
    setReferences([]);
    setSetupDone({});
    setUnrealVersion(version);
    setProject(null);
    setIgnores([]);
    setFixNotes([]);
    setFixLog([]);
    setSaveNote("");
    setTunable({});
    setTab("graph");
    setError(null);
    setJump(null);
    setFix(null);
    setConflict(null);
    setZipMenu(false);
    setExportPrompt(null);
    setCompareBase("previous");
    setBaseSystem(null);
    setViewingVersion(null);
    setBaseline(blankSnapshot({ project_context: context, unreal_version: version }));
    toast.message("New project", { description: keepContext ? "Project context kept. The API key was not changed." : "Workspace cleared. The API key was not changed." });
  };

  const requestNewProject = () => {
    const dirty = isWorkspaceDirty(liveSnapshot(), baseline);
    if (!dirty && !String(projectContext || "").trim()) {
      applyBlank({ keepContext: false });
      return;
    }
    setNewProjectAsk({ keepContext: false, dirty });
  };

  const applyTemplate = (t, mode) => {
    epochRef.current += 1;
    const detach = mode === "new";
    const nextClass = t.default_class || "ActorComponent";
    const nextRefs = detach ? [] : references;
    if (detach) {
      setProject(null);
      setIgnores([]);
      setFixNotes([]);
      setFixLog([]);
      setReferences([]);
    }
    setPrompt(t.prompt);
    setBpClass(nextClass);
    setResult(null);
    setPreviousResult(null);
    setNotes("");
    setExtra([]);
    setNewExtra("");
    setSetupDone({});
    setTunable({});
    setTab("graph");
    setError(null);
    setJump(null);
    setBaseline(workspaceSnapshot({
      prompt: t.prompt,
      blueprint_class: nextClass,
      complexity,
      modularity,
      performance_vs_flexibility: perfFlex,
      tick_rate: tickRate,
      network_replicated: replicated,
      extra: [],
      notes: "",
      new_extra: "",
      project_context: projectContext,
      references: nextRefs,
      setup_done: [],
      unreal_version: unrealVersion,
      result_sig: "",
      project_id: detach ? null : (project?.project_id || null),
    }));
    setTemplateAsk(null);
    toast.message(detach ? `Started a new project from ${t.title}` : `Loaded ${t.title} into this project`, {
      description: detach ? "Save will create a new project." : "The next save adds a version of this project, after you synthesize.",
    });
  };

  const pickTemplate = (t) => {
    if (project) {
      setTemplateAsk({ template: t });
      return;
    }
    setPrompt(t.prompt);
    setBpClass(t.default_class || "ActorComponent");
    toast.message(`Loaded template: ${t.title}`);
  };

  const clearRememberedContext = () => {
    localStorage.removeItem(LS_CONTEXT);
    if (!project) {
      setProjectContext("");
      setBaseline((current) => workspaceSnapshot({ ...current, project_context: "" }));
    }
    toast.success("Remembered project context cleared", { description: "Saved projects still have their own context." });
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
    const epochAtStart = epochRef.current;
    setLoading(true);
    setError(null);
    setProgress(0);
    try {
      const data = await streamGenerate({ ...body, project_context: projectContext, reference_file_ids: references.map((r) => r.file_id) }, setProgress, key, () => aliveRef.current);
      if (epochRef.current !== epochAtStart || (projectRef.current?.project_id || null) !== startedOn) {
        toast.message("A synthesis finished after you switched projects, so it was discarded");
        return false;
      }
      if (result) setPreviousResult(result);
      // Keep generated tests across regenerations; the Tests tab marks them out of date
      setViewingVersion(null);
      setResult({ ...data, ...(result?.tests && !body.stack_systems ? { tests: result.tests } : {}), context: { ...context, project_context: projectContext, references, notes: body.designer_notes || "", unreal_version: unrealVersion }, baseline_modules: data.modules });
      setSetupDone({});
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
      try {
        const saved = await saveAiKey(key);
        key = saved || key;
        setAiKey(key);
        toast.success(`Switched to ${switchTo}`);
      } catch (err) {
        toast.error(errorText(err));
        return;
      }
    }
    const ok = await runSynthesis(p.body, p.context, p.successLabel, { key, skipLimit: true });
    if (ok && p.body.stack_systems) { setPrompt(p.body.prompt); setExtra([]); setProject(null); setIgnores([]); }
  };

  const currentInputs = { prompt, blueprint_class: bpClass, complexity, modularity, performance_vs_flexibility: perfFlex, tick_rate: tickRate, network_replicated: replicated, unreal_version: unrealVersion };

  const generate = async (extraRequests = []) => {
    if (prompt.trim().length < 5) {
      toast.error("Describe your system in a bit more detail");
      return false;
    }
    const removed = result ? (result.modules || []).filter((m) => !m.included).map((m) => m.name) : [];
    return runSynthesis({
      ...currentInputs,
      extra_modules: extra,
      removed_modules: removed,
      parameter_overrides: result ? tunable : {},
      designer_notes: notes,
      change_requests: [...pendingChanges.map((c) => c.text), ...extraRequests].slice(0, 40),
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
    return {
      system,
      context: {
        ...(context || {}),
        references,
        project_context: projectContext,
        setup_done: setupDoneList(setupDone),
        unreal_version: unrealVersion,
      },
    };
  };

  const saveProject = async (force = false) => {
    if (!result || saving) return;
    const { system, context } = splitResult();
    const savingFor = project?.project_id || null;
    const note = saveNote.trim().slice(0, 200);
    const creating = saveRequest(savingFor, readOnly) === "create";
    setSaving(true);
    try {
      const { data } = creating
        ? await api.post("/projects", { name: result.system_name, system, context, note, fixes: fixLog })
        : await api.put(`/projects/${project.project_id}`, { system, context, note, fixes: fixLog, base_version: project.version, force });
      const { system: _s, context: _c, ...meta } = data;
      const stillHere = (projectRef.current?.project_id || null) === savingFor;
      const follow = stillHere ? afterSaveRef.current : null;
      if (!stillHere) afterSaveRef.current = null;
      if (stillHere && !follow) {
        setProject(meta);
        setConflict(null);
        if (!savingFor && ignores.length) api.put(`/projects/${data.project_id}/ignores`, { ignores }).catch(() => {});
        setBaseline(liveSnapshot({ project_id: data.project_id }));
      } else if (stillHere && follow) {
        setConflict(null);
        if (!savingFor && ignores.length) api.put(`/projects/${data.project_id}/ignores`, { ignores }).catch(() => {});
      }
      setProjRefresh((n) => n + 1);
      setSaveDialog(false);
      if (stillHere) {
        setSaveNote("");
        setFixNotes([]);
        setFixLog([]);
      }
      toast.success(creating ? "Saved as new project" : `Saved v${data.version}`, { description: note ? `${data.name}: ${note}` : data.name });
      if (follow) {
        afterSaveRef.current = null;
        follow();
      }
    } catch (e) {
      setSaveDialog(false);
      if ((projectRef.current?.project_id || null) !== savingFor) toast.error("Couldn't save the project you switched away from", { description: errorText(e) });
      else if (e.response?.status === 409) setConflict(e.response.data.detail);
      else toast.error("Couldn't save", { description: errorText(e) });
    } finally {
      setSaving(false);
    }
  };

  const openSystem = (system, context = {}, meta = null) => {
    const c = context || {};
    const version = normalizeUnrealVersion(c.unreal_version) || LEGACY_UNREAL_VERSION;
    const ticks = setupDoneMap(c.setup_done);
    const nextPrompt = c.prompt !== undefined ? c.prompt : prompt;
    const nextClass = c.prompt !== undefined ? (c.blueprint_class || "ActorComponent") : bpClass;
    const nextComplexity = c.prompt !== undefined ? (c.complexity ?? 55) : complexity;
    const nextModularity = c.prompt !== undefined ? (c.modularity ?? 75) : modularity;
    const nextPerf = c.prompt !== undefined ? (c.performance_vs_flexibility ?? 50) : perfFlex;
    const nextTick = c.prompt !== undefined ? (c.tick_rate ?? 30) : tickRate;
    const nextReplicated = c.prompt !== undefined ? !!c.network_replicated : replicated;
    const nextExtra = c.prompt !== undefined ? (c.extra_modules || []) : extra;
    const nextContext = c.project_context !== undefined ? c.project_context : projectContext;
    if (c.prompt !== undefined) {
      setPrompt(nextPrompt);
      setBpClass(nextClass);
      setComplexity(nextComplexity);
      setModularity(nextModularity);
      setPerfFlex(nextPerf);
      setTickRate(nextTick);
      setReplicated(nextReplicated);
      setExtra(nextExtra);
      if (c.project_context !== undefined) setProjectContext(c.project_context);
    }
    const params = {};
    (system?.tunable_parameters || []).forEach((p) => { params[p.key] = p.value; });
    setUnrealVersion(version);
    setSetupDone(ticks);
    setTunable(params);
    setReferences(c.references || []);
    setNewExtra("");
    setResult({ ...system, context: { ...c, unreal_version: version, setup_done: setupDoneList(ticks) }, baseline_modules: system.baseline_modules || system.modules });
    setPreviousResult(null);
    setNotes("");
    setTab("graph");
    setBaseline(workspaceSnapshot({
      prompt: nextPrompt,
      blueprint_class: nextClass,
      complexity: nextComplexity,
      modularity: nextModularity,
      performance_vs_flexibility: nextPerf,
      tick_rate: nextTick,
      network_replicated: nextReplicated,
      extra: nextExtra,
      notes: "",
      new_extra: "",
      project_context: nextContext,
      references: c.references || [],
      setup_done: ticks,
      unreal_version: version,
      result_sig: resultSignature(system, params),
      project_id: meta?.project_id || project?.project_id || null,
    }));
  };

  const openProject = async (id, opts = {}) => {
    try {
      const { data } = await api.get(`/projects/${id}`);
      const { system, context, ...meta } = data;
      epochRef.current += 1;
      setProject(meta);
      setViewingVersion(null);
      setIgnores(meta.ignored_issues || []);
      setFixNotes([]);
      setFixLog([]);
      openSystem(system, context, meta);
      if (opts.history) setHistoryOpen(true);
      toast.message(`Opened ${data.name}`, { description: meta.my_role === "viewer" ? "View only" : `Last saved by ${meta.updated_by_name}` });
    } catch (e) {
      toast.error("Couldn't open project", { description: errorText(e) });
    }
  };

  const commandNonce = shell.commandNonce;
  useEffect(() => {
    const cmd = shell.takeCommand();
    if (!cmd) return;
    if (cmd.type === "new-project") requestNewProject();
    else if (cmd.type === "open-project" && cmd.id) openProject(cmd.id, { history: !!cmd.history });
    else if (cmd.type === "template" && cmd.template) pickTemplate(cmd.template);
    // The command is consumed once. The handlers close over this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commandNonce]);

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
      toast.success(`Imported ${n} of ${migration.length} systems`);
      setProjRefresh((x) => x + 1);
    }
    localStorage.setItem(MIGRATION_KEY, doImport ? "imported" : "fresh");
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
  const exportZip = async (kind, force = false, override = null) => {
    if (!result) return;
    setZipMenu(false);
    if (!force && exportIssues.length && project?.auto_fix_export && !readOnly && aiKey) { runFix(exportIssues, kind); return; }
    if (!force && exportIssues.length) { setExportPrompt(kind); return; }
    setExportPrompt(null);
    const { context: ctx, ...system } = override || result;
    const context = { ...(ctx || {}), references };
    const build = kind === "plugin" ? buildPluginZip : buildProjectZip;
    let built;
    try {
      let checked = override ? checkSystem(override).filter((i) => !ignoreKeys.has(issueKey(i, override))) : exportIssues;
      const byKey = Object.fromEntries(ignores.map((i) => [i.key, i.by]));
      const sys = override || result;
      const sections = [reportSection(sys.system_name || "System", { issues: checked, ignored: ignoredIssues.map((i) => ({ ...i, by: byKey[i.key] })), fixes: fixLog })];
      if (sys.tests?.code) sections.push(reportSection("Automation tests", { issues: testIssues(sys) }));
      const report = compileReport(sections, aiReview?.status === "done" && !override ? aiReview.model : null);
      if (sys.tests?.code) checked = [...checked, ...testIssues(sys).map((i) => ({ ...i, file: `tests ${i.file}` }))];
      built = await build(project?.name || result.system_name, system, { ...context, references: undefined }, checked, report);
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

  const restoreSavedVersion = async (version) => {
    if (typeof version !== "number" || !project) return;
    if (pendingChanges.length && !window.confirm(`Restore v${version}? Your ${pendingChanges.length} unsynthesized change(s) will be discarded.`)) return;
    setRestoring(true);
    try {
      const pid = project.project_id;
      const { data } = await api.post(`/projects/${pid}/versions/${version}/restore`);
      if (projectRef.current?.project_id !== pid) return;
      const { system, context, ...meta } = data;
      setProject(meta);
      setViewingVersion(null);
      setHistoryOpen(false);
      openSystem(system, context, meta);
      setFixLog([]);
      setFixNotes([]);
      setSaveNote("");
      setProjRefresh((n) => n + 1);
      toast.success(`Restored v${version} as v${meta.version}`, { description: "Nothing is lost: the version you replaced is still in history." });
    } catch (e) {
      toast.error("Couldn't restore", { description: errorText(e) });
    } finally {
      setRestoring(false);
    }
  };

  const openSavedVersion = async (version) => {
    if (!project) return;
    try {
      const pid = project.project_id;
      const { data } = await api.get(`/projects/${pid}/versions/${version}`);
      if (projectRef.current?.project_id !== pid) return;
      epochRef.current += 1;
      openSystem(data.system, data.context, project);
      setViewingVersion(version === project.version ? null : version);
      setHistoryOpen(false);
      setTab("graph");
      toast.message(version === project.version ? `Opened v${version}` : `Opened v${version}`, {
        description: version === project.version ? "This is the latest save." : "Restore it to make this the current version. Older saves stay in the list.",
      });
    } catch (e) {
      toast.error("Couldn't open that version", { description: errorText(e) });
    }
  };

  const copyJson = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(JSON.stringify(exportData(), null, 2));
    toast.success("Project JSON copied");
  };

  useEffect(() => {
    if (!project?.project_id) { setVersions([]); setVersionsReady(false); return undefined; }
    const pid = project.project_id;
    let alive = true;
    setVersionsReady(false);
    api.get(`/projects/${pid}/versions`)
      .then((r) => { if (alive && projectRef.current?.project_id === pid) setVersions(r.data.versions || []); })
      .catch(() => { if (alive) setVersions([]); })
      .finally(() => { if (alive) setVersionsReady(true); });
    return () => { alive = false; };
  }, [project?.project_id, project?.version]);

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
      <button className="ue-btn !py-1 !px-2 !text-[11px] !border-[var(--cpp-green)] !text-[var(--cpp-green)]" onClick={() => restoreSavedVersion(compareBase)} disabled={restoring} data-testid="restore-version-button">
        <History size={12} /> {restoring ? "Restoring…" : `Restore v${compareBase}`}
      </button>
    )}
    </>
  ) : null;

  // Dynamic tunable params from generated output.
  // A restored session already has the slider values, so don't reset them.
  useEffect(() => {
    if (!result?.tunable_parameters) return;
    if (tunableGuard.current && tunableGuard.current === result.id) {
      tunableGuard.current = false;
      return;
    }
    const init = {};
    result.tunable_parameters.forEach((p) => { init[p.key] = p.value; });
    setTunable(init);
  }, [result?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const pendingChanges = useMemo(
    () => computeChanges(result, { ...currentInputs, params: tunable, extra, notes }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [result, prompt, bpClass, complexity, modularity, perfFlex, tickRate, replicated, unrealVersion, tunable, extra, notes]
  );

  const checkIssues = useMemo(() => (result ? checkSystem(result) : []), [result?.cpp_header, result?.cpp_source]); // eslint-disable-line react-hooks/exhaustive-deps
  const ignoreKeys = useMemo(() => new Set(ignores.map((i) => i.key)), [ignores]);
  const keyedIssues = useMemo(() => checkIssues.map((i) => ({ ...i, key: issueKey(i, result) })), [checkIssues]); // eslint-disable-line react-hooks/exhaustive-deps
  const activeIssues = keyedIssues.filter((i) => !ignoreKeys.has(i.key));
  const ignoredIssues = keyedIssues.filter((i) => ignoreKeys.has(i.key));
  const [aiReview, runAiReview] = useAiReview(result, activeIssues, aiKey, () => setKeyModal("required"), () => setUsageTick((n) => n + 1), unrealVersion);
  const headline = compileHeadline(activeIssues, aiReview);
  const exportIssues = aiReview?.status === "done" ? [...activeIssues, ...aiReview.issues.map((i) => ({ ...i, message: `AI review: ${i.message}` }))] : activeIssues;
  const exportErrors = exportIssues.filter((i) => i.severity === "error").length;

  useEffect(() => { setJump(null); }, [result?.id]);
  const copyForUnreal = async () => {
    const { text, mapped, total } = blueprintClipboard(result);
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${mapped} of ${total} nodes for Unreal`, {
        description: `Paste into a Blueprint Event Graph (Ctrl+V), e.g. the actor that owns the component. Build the plugin first; connect the component into each Target pin.${mapped < total ? " Unmapped nodes arrive as TODO comments." : ""}`,
        duration: 9000,
      });
    } catch { toast.error("Clipboard access was blocked"); }
  };
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
  const ignoreIssue = (i) => { saveIgnores([...ignores, { key: i.key, file: i.file, message: i.message.slice(0, 400), by: "You" }]); toast.message("Issue ignored", { description: "Restore it from the Ignored list." }); };
  const restoreIssue = (i) => saveIgnores(ignores.filter((x) => x.key !== i.key));
  const copyIssues = async (list) => {
    try {
      await navigator.clipboard.writeText(issuesToText(list));
      toast.success(`Copied ${list.length} issue${list.length === 1 ? "" : "s"}`);
    } catch { toast.error("Clipboard access was blocked"); }
  };
  const toggleAutoFix = async (on) => {
    try {
      await api.patch(`/projects/${project.project_id}/settings`, { auto_fix_export: on });
      setProject((p) => ({ ...p, auto_fix_export: on }));
      toast.success(on ? "Auto-fix before export is on" : "Auto-fix before export is off", { description: "Saved for everyone on this project." });
    } catch (e) { toast.error(errorText(e)); }
  };
  const fixRegenerate = async (list) => {
    setFix(null);
    const ok = await generate(list.map((i) => `Fix compile issue: ${issueText(i)}${i.fix ? ` (suggested: ${i.fix})` : ""}`));
    if (ok) setFixNotes((n) => [...n, `Regenerated to fix ${list.length} compile issue${list.length === 1 ? "" : "s"}`]);
  };
  const runFix = async (list, thenExport = null, target = "code") => {
    if (!aiKey) { setKeyModal("required"); toast.error("Add your AI key to fix issues"); return; }
    const { used, limit } = modelUsage(usage, aiKey.provider, aiKey.model);
    if (limit && used + 1 > limit * 0.85 && !window.confirm(`You've used about ${used} of ~${limit} free ${aiKey.model} requests today. Fix anyway?`)) return;
    const tests = target === "tests";
    const before = { id: result.id, h: result.cpp_header || "", c: (tests ? result.tests?.code : result.cpp_source) || "" };
    setFix({ status: "running", count: list.length, list, before, thenExport, target });
    try {
      const { data } = await api.post("/ai/fix-cpp", {
        file_base: tests ? `${baseName(result)} (header, read-only) and its automation test file` : baseName(result), cpp_header: before.h, cpp_source: before.c, project_id: project?.project_id || null,
        unreal_version: unrealVersion,
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
    if (fix.target === "tests") {
      if (result?.id !== before.id || (result.tests?.code || "") !== before.c) {
        setFix({ ...fix, status: "error", error: "The tests changed while the fix was being written, so it wasn't applied." });
        return;
      }
      const next = { ...result, tests: { ...result.tests, code: data.cpp_source } };
      setResult(next);
      setFix(null);
      const left = testIssues(next).length;
      toast.success(`Tests fixed: ${list.length - Math.min(left, list.length)} of ${list.length} cleared`, { description: `${left ? `${left} still listed. ` : ""}Press Save to keep it.` });
      return;
    }
    if (result?.id !== before.id || (result.cpp_header || "") !== before.h || (result.cpp_source || "") !== before.c) {
      setFix({ ...fix, status: "error", error: "The code changed while the fix was being written, so it wasn't applied." });
      return;
    }
    const next = { ...result, cpp_header: data.cpp_header, cpp_source: data.cpp_source };
    setResult(next);
    setFix(null);
    const entry = makeFixEntry(result, next, data);
    const note = fixNote(entry);
    setFixLog((l) => [...l, entry].slice(-20));
    setFixNotes((n) => [...n, note]);
    if (fix.thenExport) exportZip(fix.thenExport, true, next);
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
        onClick: () => {
          setResult((r) => (r?.id === before.id && r.cpp_header === data.cpp_header && r.cpp_source === data.cpp_source ? { ...r, cpp_header: before.h, cpp_source: before.c } : r));
          setFixNotes((n) => n.filter((x) => x !== note));
          setFixLog((l) => l.filter((x) => x.fix_id !== entry.fix_id));
        },
      },
    });
    setTab("cpp");
  };
  const undoFix = (entry, pending) => {
    const next = result && undoFixEntry(result, entry);
    if (!next) { toast.error("Can't undo this fix", { description: "Those lines have changed since the fix was applied." }); return; }
    setResult(next);
    setViewFix(null);
    if (pending) {
      setFixLog((l) => l.filter((x) => x.fix_id !== entry.fix_id));
      setFixNotes((n) => n.filter((x) => x !== fixNote(entry)));
    } else {
      setFixNotes((n) => [...n, fixNote(entry).replace(/^Fixed: /, "Undid fix: ")]);
    }
    toast.success("Fix undone in the workspace", { description: "Press Save to keep it." });
    setTab("cpp");
  };

  const TABS = [
    { id: "graph", label: "Event Graph", icon: Workflow, test: "tab-node-graph" },
    { id: "blueprint", label: "Blueprint Pseudocode", icon: GitBranch, test: "tab-blueprint-code" },
    { id: "cpp", label: "C++ Snippets", icon: Code2, test: "tab-cpp-code" },
    { id: "tests", label: "Tests", icon: FlaskConical, test: "tab-tests" },
    { id: "setup", label: "Setup Guide", icon: Hammer, test: "tab-setup-guide" },
    { id: "compare", label: "Compare", icon: GitCompareArrows, test: "tab-compare" },
    { id: "files", label: "Files", icon: FolderClosed, test: "tab-files" },
  ];

  return (
    <div className="App flex flex-col" data-testid="app-root">

      {/* ============ TOP HEADER BAR ============ */}
      <header className="app-header shrink-0 border-b border-[var(--border-soft)] bg-[var(--bg-secondary)] flex items-center px-3 gap-2" data-testid="workspace-header">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-8 w-8 rounded-md border border-[var(--unreal-orange)] bg-[rgba(255,107,0,0.08)] flex items-center justify-center glow-orange-soft">
            <Cpu size={16} className="text-[var(--unreal-orange)]" />
          </div>
          <div>
            <div className="font-display text-[16px] font-extrabold uppercase tracking-wider leading-none">UE5 System Architect</div>
            <div className="app-subtitle text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest mt-0.5">Modular · AI-driven · Blueprint + C++</div>
          </div>
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2 pl-3 ml-1 border-l border-[var(--border-soft)]">
          {project ? (
            <>
              <button className="font-sub font-semibold text-[14px] truncate max-w-[260px] flex items-center gap-1.5 hover:text-[var(--unreal-orange)] disabled:hover:text-inherit" onClick={renameProject} disabled={readOnly} title={readOnly ? project.name : "Rename project"} data-testid="project-name">
                {project.name} {!readOnly && <Pencil size={11} className="opacity-60" />}
              </button>
              <span className={`chip !py-0.5 !cursor-default uppercase !text-[10px] ${readOnly ? "!text-[var(--accent-cyan)] !border-[rgba(0,240,255,0.4)]" : "active"}`} data-testid="project-role-badge">
                {readOnly ? <><Eye size={10} /> View only</> : "Local"}
              </span>
              <span className="hidden lg:inline text-[10.5px] font-mono text-[var(--text-muted)] truncate" data-testid="project-last-saved">saved by {project.updated_by_name} · {new Date(project.updated_at).toLocaleString()}</span>
              <button className="ue-btn !py-1 !px-2 !text-[11px] shrink-0" onClick={() => setHistoryOpen(true)} data-testid="versions-button" title="Saved versions of this project">
                <History size={12} /> Versions{versions.length > 0 ? ` · ${versions.length}` : ""}
              </button>
            </>
          ) : (
            <span className="text-[11px] font-mono text-[var(--text-muted)]" data-testid="project-name-unsaved">Unsaved system</span>
          )}
        </div>
        <div className="header-actions">
        <span className="chip !cursor-default shrink-0" data-testid="unreal-version-badge"><Zap size={11} /> UE {unrealVersion}</span>
        <div className="hidden min-[1280px]:flex items-center gap-2">
          <span className="chip"><Network size={11} /> {replicated ? "Replicated" : "Local"}</span>
          <span className="chip"><Terminal size={11} /> {aiKey ? aiKey.model : "No AI key"}</span>
        </div>
        {appInfo.update?.version && (
          <a className="chip shrink-0" href={appInfo.update.url} target="_blank" rel="noreferrer" data-testid="update-available" title="A newer release is on GitHub">Update {appInfo.update.version}</a>
        )}
        <button className="ue-btn shrink-0" onClick={requestNewProject} data-testid="new-project-button"><FilePlus size={13} /> New</button>
        <button className="ue-btn shrink-0" onClick={copyJson} disabled={!result} data-testid="copy-json-btn"><Copy size={13} /> <span className="hide-narrow">Copy JSON</span></button>
        <button className="ue-btn shrink-0" onClick={exportAll} disabled={!result} data-testid="export-all-btn"><Download size={13} /> JSON</button>
        <div className="relative">
          <button className="ue-btn shrink-0" onClick={() => setZipMenu((v) => !v)} disabled={!result} aria-expanded={zipMenu} data-testid="export-zip-btn"><FileArchive size={13} /> <span className="hide-narrow">UE5 .zip</span> <Caret size={12} /></button>
          {zipMenu && (
            <div className="menu-pop absolute right-0 top-full mt-1 z-40 panel w-[290px] p-1.5 shadow-2xl" data-testid="export-zip-menu">
              <button className="w-full text-left px-2.5 py-2 rounded hover:bg-[var(--surface-hover)]" onClick={() => exportZip("plugin")} data-testid="export-plugin-zip">
                <div className="font-sub text-[13px] font-semibold">Unreal plugin <span className="chip active !py-0 !text-[9.5px] ml-1">RECOMMENDED</span></div>
                <div className="text-[10.5px] font-mono text-[var(--text-muted)]">Drop into Plugins/ and build. No code edits.</div>
              </button>
              <button className="w-full text-left px-2.5 py-2 rounded hover:bg-[var(--surface-hover)]" onClick={() => exportZip("source")} data-testid="export-source-zip">
                <div className="font-sub text-[13px] font-semibold">Source files only</div>
                <div className="text-[10.5px] font-mono text-[var(--text-muted)]">.h/.cpp to add to your own game module</div>
              </button>
              <label className={`flex items-start gap-2 px-2.5 py-2 mt-1 border-t border-[var(--border-soft)] ${project && !readOnly ? "cursor-pointer" : "opacity-60"}`} data-testid="auto-fix-toggle-label">
                <input type="checkbox" className="accent-[#ff6b00] mt-0.5" checked={!!project?.auto_fix_export} disabled={!project || readOnly}
                  onChange={(e) => toggleAutoFix(e.target.checked)} data-testid="auto-fix-toggle" />
                <span>
                  <span className="block font-sub text-[12.5px] font-semibold">Auto-fix before export</span>
                  <span className="block text-[10.5px] font-mono text-[var(--text-muted)]">
                    {!project ? "Save the project to turn this on." : readOnly ? "Editors can change this." : "Runs Fix these with your key and shows the review first. Saved with this project."}
                  </span>
                </span>
              </label>
            </div>
          )}
        </div>
        <button className="ue-btn ue-btn-primary shrink-0" onClick={() => { afterSaveRef.current = null; if (!saveNote.trim() && fixNotes.length) setSaveNote(fixNotes.join(" · ").slice(0, 200)); setSaveDialog(true); }} disabled={!result || readOnly || saving} data-testid="save-system-button"><Save size={13} /> {project ? "Save" : "Save project"}</button>
        <UsageChip aiKey={aiKey} usage={usage} />
        <div className="relative">
          <button className="ue-btn shrink-0" onClick={() => setFeedbackOpen((v) => !v)} aria-expanded={feedbackOpen} data-testid="feedback-button" title="Open a GitHub issue">
            <MessageSquarePlus size={13} /> <span className="hide-narrow">Feedback</span>
          </button>
          {feedbackOpen && (
            <div className="menu-pop absolute right-0 top-full mt-1 z-40 panel w-[220px] p-2 shadow-2xl" data-testid="feedback-menu">
              <div className="eyebrow mb-1.5">New GitHub issue</div>
              {FEEDBACK_CATEGORIES.map((category) => (
                <a key={category} className="block rounded px-2 py-1.5 text-[12.5px] font-sub hover:bg-[var(--surface-hover)]" target="_blank" rel="noreferrer"
                  href={feedbackUrl({ version: appInfo.version || APP_VERSION, category })} data-testid={`feedback-${category.toLowerCase()}`}
                  onClick={() => setFeedbackOpen(false)}>
                  {category}
                </a>
              ))}
              <p className="mt-1 text-[10px] font-mono text-[var(--text-muted)] leading-relaxed">Opens GitHub in your browser. Nothing is sent from this app. Version {appInfo.version || APP_VERSION}.</p>
            </div>
          )}
        </div>
        <button className={`ue-btn shrink-0 ${aiKey ? "" : "!border-[var(--unreal-orange)] !text-[var(--unreal-orange)]"}`} onClick={() => setKeyModal("edit")} data-testid="ai-key-button">
          <KeyRound size={13} /> {aiKey ? "Settings" : "Add AI key"}
        </button>
        </div>
      </header>

      {/* ============ BODY ============ */}
      <div className="flex-1 flex min-h-0">

        {/* LEFT SIDEBAR */}
        <aside className="sidebar-left shrink-0 border-r border-[var(--border-soft)] bg-[var(--bg-secondary)] overflow-y-auto overflow-x-hidden" data-testid="sidebar-left">
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
            <label className="mt-2 block">
              <span className="eyebrow">Target Unreal</span>
              <select
                value={unrealVersion}
                onChange={(e) => {
                  const next = normalizeUnrealVersion(e.target.value) || DEFAULT_UNREAL_VERSION;
                  setUnrealVersion(next);
                  localStorage.setItem(LS_UNREAL_VERSION, next);
                }}
                data-testid="unreal-version-select"
                aria-label="Target Unreal version"
                className="mt-1 w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-md px-2 py-1.5 text-[11px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--unreal-orange)]"
              >
                {UNREAL_VERSIONS.map((v) => <option key={v} value={v}>UE {v}</option>)}
              </select>
            </label>
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
              <div className="text-[10px] font-mono text-[var(--text-muted)] mt-1">Steers every synthesis. Remembered on this computer, and saved with the project.</div>
            </div>
            <button
              className="ue-btn ue-btn-primary w-full justify-center mt-3 whitespace-normal text-center"
              onClick={() => generate()}
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
        <main className="workspace-center flex-1 flex flex-col min-w-0 bg-[var(--bg-main)]" data-testid="workspace-center">
          {/* System header */}
          <div className="center-toolbar shrink-0 px-4 border-b border-[var(--border-soft)] flex items-center justify-between bg-[var(--bg-secondary)]/60">
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
              {viewingVersion && (
                <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="viewing-version-banner">
                  <span className="text-[11px] font-mono text-[var(--unreal-orange)]">Viewing v{viewingVersion}. This is not the latest save.</span>
                  <button className="ue-btn !py-1 !px-2 !text-[11px] !border-[var(--cpp-green)] !text-[var(--cpp-green)]" disabled={restoring || readOnly} onClick={() => restoreSavedVersion(viewingVersion)} data-testid="banner-restore-version">
                    Restore this version
                  </button>
                </div>
              )}
            </div>
            <div className="tab-row shrink min-w-0 ml-2">
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
                    <Icon size={13} /> <span className="hidden min-[1100px]:inline">{t.label}</span>
                    {t.id === "cpp" && !headline.clean && (headline.errors + headline.warnings) > 0 && (
                      <span className={`ml-0.5 rounded-full px-1.5 text-[9.5px] font-mono leading-[15px] ${headline.errors ? "bg-[var(--accent-red)] text-white" : "bg-[#e8c547] text-[#0b0e14]"}`} data-testid="cpp-issue-badge">{headline.errors + headline.warnings}</span>
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
                          const k = { ...aiKey, model: DEFAULT_MODEL };
                          saveAiKey(k).then((saved) => { setAiKey(saved || k); toast.success("Switched to Gemini 3.5 Flash-Lite"); }).catch((err) => toast.error(errorText(err)));
                        }}>
                        Switch to Gemini 3.5 Flash-Lite
                      </button>
                    )}
                  </div>
                  <button onClick={() => setError(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm" data-testid="dismiss-error">×</button>
                </div>
              </div>
            )}
            {tab === "graph" && (
              <div className="relative h-full">
                <NodeGraph nodes={result?.node_graph_nodes || []} edges={result?.node_graph_edges || []} />
                {result?.node_graph_nodes?.length > 0 && (
                  <button className="ue-btn ue-btn-primary !text-[12px] absolute bottom-4 right-4 z-20" onClick={copyForUnreal} title="Copies the graph in Unreal's clipboard format" data-testid="copy-for-unreal-button">
                    <ClipboardCopy size={13} /> Copy for Unreal
                  </button>
                )}
              </div>
            )}
            {tab === "tests" && result && (
              <TestsPanel system={result} projectId={project?.project_id} aiKey={aiKey} canEdit={!readOnly} fixing={fix?.status === "running"} unrealVersion={unrealVersion}
                onNeedKey={() => setKeyModal("required")} onUsed={() => setUsageTick((n) => n + 1)}
                onTests={(id, t) => setResult((r) => (r?.id === id ? { ...r, tests: t } : r))}
                onFix={(l) => runFix(l, null, "tests")} jump={jump} onJump={(i) => setJump({ file: "tests", line: i.line || 1, nonce: Date.now() })} />
            )}
            {tab === "blueprint" && (
              <div className="p-5 h-full overflow-auto">
                <AnnotatedPseudocode code={result?.blueprint_pseudocode} />
              </div>
            )}
            {tab === "cpp" && (
              <div className="p-5 h-full overflow-auto">
                {result && <CompileCheck issues={activeIssues} ignored={ignoredIssues} ai={aiReview} onReview={runAiReview} aiKey={aiKey} canEdit={!readOnly}
                  fixing={fix?.status === "running" || loading} onJump={jumpTo} onFix={(l) => runFix(l)} onRegenerate={fixRegenerate} onIgnore={ignoreIssue} onRestore={restoreIssue} onCopy={copyIssues} />}
                <div className="grid md:grid-cols-2 gap-4">
                  <CodeBox title={`${result ? baseName(result) : "System"}.h`} code={result?.cpp_header} lang="cpp" testId="cpp-header" target={jump?.file === ".h" ? jump : null} />
                  <CodeBox title={`${result ? baseName(result) : "System"}.cpp`} code={result?.cpp_source} lang="cpp" testId="cpp-source" target={jump?.file === ".cpp" ? jump : null} />
                </div>
              </div>
            )}
            {tab === "setup" && <SetupGuide steps={result?.setup_guide || []} done={setupDone} onToggle={(step) => setSetupDone((current) => ({ ...current, [step]: !current[step] }))} />}
            {tab === "compare" && <CompareView before={compareBefore} after={result} picker={versionPicker} />}
            {tab === "files" && <ProjectFiles project={project} />}
          </div>

          {/* Bottom diagnostic bar */}
          <div className="status-bar h-8 shrink-0 border-t border-[var(--border-soft)] bg-[var(--bg-secondary)] px-4 flex items-center gap-4 text-[10.5px] font-mono text-[var(--text-muted)] uppercase tracking-widest">
            <span className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${result ? "bg-[var(--cpp-green)]" : "bg-slate-600"}`}/> {result ? "Ready" : "Idle"}</span>
            <span>Class: <span className="text-[var(--text-secondary)]">{bpClass}</span></span>
            <span>Nodes: <span className="text-[var(--text-secondary)]">{result?.node_graph_nodes?.length || 0}</span></span>
            <span>Modules: <span className="text-[var(--text-secondary)]">{result?.modules?.filter(m=>m.included).length || 0}</span></span>
            <div className="flex-1" />
            <span className="status-notes">{result?.network_notes?.slice(0, 80) || "—"}</span>
          </div>
        </main>

        {/* RIGHT TUNER PANEL */}
        <aside className="sidebar-right shrink-0 border-l border-[var(--border-soft)] bg-[var(--bg-secondary)] overflow-y-auto overflow-x-hidden" data-testid="sidebar-right">
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
                className="flex-1 min-w-0 bg-[var(--bg-main)] border border-[var(--border)] rounded-md px-2 py-1.5 text-[11px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--unreal-orange)]"
              />
              <button className="ue-btn shrink-0" onClick={addExtra} data-testid="add-component-button"><Plus size={12} /></button>
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
        <AiKeyModal current={aiKey} required={keyModal === "required"} onClearProjectContext={clearRememberedContext} onClose={() => { setKeyModal(null); setUsageTick((n) => n + 1); }}
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
      {newProjectAsk && (
        <Modal title="Start a new project?" onClose={() => setNewProjectAsk(null)} testId="new-project-modal" width={480}>
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed" data-testid="new-project-text">
            {newProjectAsk.dirty
              ? "This clears the description, project context, references, the current system and graph, notes, dials, modules, and setup ticks. Cancel leaves everything as it is. Your API key and model are not changed."
              : "This clears the workspace and starts a blank project. Your API key and model are not changed."}
          </p>
          <label className="mt-3 flex items-start gap-2 text-[12.5px] text-[var(--text-secondary)]" data-testid="keep-project-context-label">
            <input type="checkbox" className="accent-[#ff6b00] mt-0.5" checked={!!newProjectAsk.keepContext} data-testid="keep-project-context"
              onChange={(e) => setNewProjectAsk((current) => ({ ...current, keepContext: e.target.checked }))} />
            <span>Keep my project context</span>
          </label>
          {!result && newProjectAsk.dirty && (
            <p className="mt-3 text-[11px] font-mono text-[var(--text-muted)]">There is no synthesized system to save yet. Discard clears the screen.</p>
          )}
          <div className="flex flex-wrap gap-2 justify-end mt-4">
            <button className="ue-btn" onClick={() => setNewProjectAsk(null)} data-testid="new-project-cancel">Cancel</button>
            <button className="ue-btn" onClick={() => { const keep = !!newProjectAsk.keepContext; setNewProjectAsk(null); applyBlank({ keepContext: keep }); }} data-testid="new-project-discard">Discard</button>
            <button className="ue-btn ue-btn-primary" disabled={!newProjectAsk.dirty || !result || readOnly || saving} data-testid="new-project-save"
              title={!result ? "Synthesize a system before it can be saved" : readOnly ? "View only" : "Save, then start a new project"}
              onClick={() => {
                const keep = !!newProjectAsk.keepContext;
                setNewProjectAsk(null);
                afterSaveRef.current = () => applyBlank({ keepContext: keep });
                if (!saveNote.trim() && fixNotes.length) setSaveNote(fixNotes.join(" · ").slice(0, 200));
                setSaveDialog(true);
              }}>
              <Save size={13} /> Save
            </button>
          </div>
        </Modal>
      )}
      {templateAsk && (
        <Modal title="A project is open" onClose={() => setTemplateAsk(null)} testId="template-replace-modal" width={500}>
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed" data-testid="template-replace-text">
            Loading “{templateAsk.template.title}” replaces the description and clears the system on screen.
            Saving afterwards would add a version to “{project?.name}” unless you start a new project.
            {isWorkspaceDirty(liveSnapshot(), baseline) ? " You also have unsaved work. Cancel if you want to save it first." : ""}
          </p>
          <div className="flex flex-wrap gap-2 justify-end mt-4">
            <button className="ue-btn" onClick={() => setTemplateAsk(null)} data-testid="template-cancel">Cancel</button>
            <button className="ue-btn" onClick={() => applyTemplate(templateAsk.template, "replace")} data-testid="template-replace">Replace this project</button>
            <button className="ue-btn ue-btn-primary" onClick={() => applyTemplate(templateAsk.template, "new")} data-testid="template-new-project">Start a new project</button>
          </div>
        </Modal>
      )}
      {saveDialog && (
        <Modal title={project && !readOnly ? `Save v${project.version + 1}` : "Save project"} onClose={() => { afterSaveRef.current = null; setSaveDialog(false); }} testId="save-modal" width={460}>
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
              <button type="button" className="ue-btn" onClick={() => { afterSaveRef.current = null; setSaveDialog(false); }} data-testid="save-cancel">Cancel</button>
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
      {bundle && <BundleModal ids={bundle.ids} preset={bundle.preset} onClose={() => setBundle(null)} onPresetsChanged={() => setProjRefresh((n) => n + 1)}
        aiKey={aiKey} usage={usage} onNeedKey={() => setKeyModal("required")} onUsed={() => { setUsageTick((n) => n + 1); setProjRefresh((n) => n + 1); }} />}
      {fix && result && (
        <FixReviewModal fix={fix} system={fix.target === "tests" ? { cpp_header: result.cpp_header, cpp_source: result.tests?.code || "" } : result} base={baseName(result)} onAccept={acceptFix} onRetry={() => runFix(fix.list, fix.thenExport, fix.target)} onCancel={() => setFix(null)}
          onRegenerate={() => fixRegenerate(fix.list)}
          onDiscard={() => { const { thenExport, status } = fix; setFix(null); if (thenExport && status !== "running") exportZip(thenExport, true); }} />
      )}
      {historyOpen && (
        <HistoryModal versions={versions} current={project?.version} pending={fixLog} restoring={restoring} loading={!versionsReady} onClose={() => setHistoryOpen(false)}
          onOpen={(v) => openSavedVersion(v)}
          onCompare={(v) => { setHistoryOpen(false); setTab("compare"); pickBase(String(v)); }}
          onRestore={(v) => restoreSavedVersion(v)}
          onViewFix={(entry, pending) => setViewFix({ entry, pending })} />
      )}
      {viewFix && (
        <FixDetailModal entry={viewFix.entry} pending={viewFix.pending} canUndo={!readOnly && !!result} onClose={() => setViewFix(null)}
          onUndo={() => { undoFix(viewFix.entry, viewFix.pending); setHistoryOpen(false); }} />
      )}
      {conflict && (
        <Modal title="Newer version saved" onClose={() => setConflict(null)} testId="conflict-modal" width={460}>
          <div className="text-[13px] text-[var(--text-secondary)] mb-4" data-testid="conflict-message">
            {conflict.updated_by_name} saved this project at {new Date(conflict.updated_at).toLocaleString()} while you were editing.
          </div>
          <div className="flex gap-2 justify-end">
            <button className="ue-btn" onClick={() => { afterSaveRef.current = null; setConflict(null); openProject(project.project_id); }} data-testid="conflict-load-theirs">Load their version</button>
            <button className="ue-btn ue-btn-primary" onClick={() => saveProject(true)} data-testid="conflict-overwrite">Overwrite with mine</button>
          </div>
        </Modal>
      )}
      {migration && (
        <Modal title="Systems found on this computer" testId="migration-modal" width={460}>
          <div className="text-[13px] text-[var(--text-secondary)] mb-3">
            You have {migration.length} system{migration.length === 1 ? "" : "s"} saved from an older version of this app. Copy them in?
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
