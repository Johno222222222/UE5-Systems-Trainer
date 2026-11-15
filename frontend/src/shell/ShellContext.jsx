import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { APP_VERSION, SECTION_REGISTRY, rememberOpen } from "../lib/shell.mjs";
import { createHelpLevelStore } from "../lib/learning.mjs";
import { loadWorkspace, saveWorkspace } from "../lib/practice.mjs";
import { createWorkspaceSession, openItemFromDraft, systemChip } from "../lib/workspaceSession.mjs";

const ShellContext = createContext(null);

export function ShellProvider({ children }) {
  const sessionRef = useRef(null);
  if (!sessionRef.current) sessionRef.current = createWorkspaceSession(loadWorkspace(window.localStorage)?.draft || null);
  const session = sessionRef.current;

  const [section, setSection] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("project") ? "tools" : "home";
    } catch {
      return "home";
    }
  });
  const [memory, setMemory] = useState({});
  const [homeFocus, setHomeFocus] = useState(null);
  const [draftTick, setDraftTick] = useState(0);
  const [reveal, setReveal] = useState(() => loadWorkspace(window.localStorage)?.reveal || null);
  const [learnIndex, setLearnIndex] = useState(() => Number(loadWorkspace(window.localStorage)?.learnIndex) || 0);
  const [libraryFocus, setLibraryFocus] = useState({ view: "reading", exampleId: "start-here", conceptId: null });
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  const learnIndexRef = useRef(learnIndex);
  learnIndexRef.current = learnIndex;
  const [helpLevel, setHelpLevelState] = useState(() => {
    try { return createHelpLevelStore(window.localStorage).get(); }
    catch { return "learning"; }
  });
  const setHelpLevel = (value) => {
    try { setHelpLevelState(createHelpLevelStore(window.localStorage).set(value)); }
    catch { setHelpLevelState(value); }
  };
  const [appInfo, setAppInfo] = useState({ version: APP_VERSION, update: null });
  const commandRef = useRef(null);
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const [commandNonce, setCommandNonce] = useState(0);

  useEffect(() => session.subscribe((draft) => {
    setDraftTick((n) => n + 1);
    try {
      saveWorkspace(localStorage, draft, revealRef.current, learnIndexRef.current);
    } catch { /* a full disk should not break the workspace */ }
  }), [session]);
  useEffect(() => {
    const draft = session.get();
    if (!draft) return;
    try {
      saveWorkspace(localStorage, draft, reveal, learnIndex);
    } catch { /* ignore */ }
  }, [reveal, learnIndex, session]);

  useEffect(() => {
    api.get("/app").then((r) => {
      if (r.data?.version) setAppInfo(r.data);
    }).catch(() => {});
  }, []);

  // An older browser library still needs the Tools migration question.
  useEffect(() => {
    try {
      const pending = JSON.parse(localStorage.getItem("ue5_architect_library_v1") || "[]");
      if (Array.isArray(pending) && pending.length && !localStorage.getItem("ue5_architect_migrated_local")) {
        setSection("tools");
      }
    } catch { /* the workspace reads the same key */ }
  }, []);

  const draft = session.get();
  const chip = systemChip(draft);
  const toolsOpen = openItemFromDraft(draft);

  const go = useCallback((id) => {
    if (sectionRef.current === "tools" && id !== "tools") {
      const item = openItemFromDraft(session.get());
      if (item) setMemory((prev) => rememberOpen(prev, "tools", item));
    }
    setSection(id);
  }, [session]);

  const issue = useCallback((cmd) => {
    commandRef.current = { ...cmd, nonce: `${Date.now()}-${Math.random()}` };
    setCommandNonce(commandRef.current.nonce);
    setSection("tools");
  }, []);

  const takeCommand = useCallback(() => {
    const current = commandRef.current;
    commandRef.current = null;
    return current;
  }, []);

  const openReference = useCallback((exampleId = "start-here") => {
    setLibraryFocus((current) => ({ ...current, view: "reading", exampleId: exampleId || "start-here" }));
    setSection("references");
  }, []);

  const openConcept = useCallback((conceptId) => {
    setLibraryFocus((current) => ({ ...current, view: "concepts", conceptId: conceptId || current.conceptId }));
    setSection("references");
  }, []);

  const sendToSection = useCallback((sectionId) => {
    const item = openItemFromDraft(session.get());
    if (item) setMemory((prev) => rememberOpen(prev, sectionId, item));
    if (sectionId === "tools") {
      const projectId = session.get()?.project?.project_id;
      if (projectId) issue({ type: "open-project", id: projectId });
      else setSection("tools");
      return;
    }
    if (sectionId === "references") {
      const hasSystem = !!session.get()?.result;
      setLibraryFocus((current) => ({
        ...current,
        view: "reading",
        exampleId: hasSystem ? "workspace" : (current.exampleId || "start-here"),
      }));
    }
    setSection(sectionId);
  }, [issue, session]);

  const value = useMemo(() => ({
    session,
    section,
    memory: toolsOpen ? { ...memory, tools: toolsOpen } : memory,
    homeFocus,
    clearHomeFocus: () => setHomeFocus(null),
    appInfo,
    version: appInfo.version || APP_VERSION,
    chip,
    commandNonce,
    registry: SECTION_REGISTRY,
    go,
    issue,
    takeCommand,
    sendToSection,
    focusHome: (target) => {
      setHomeFocus(target);
      setSection("home");
    },
    draftTick,
    helpLevel,
    setHelpLevel,
    reveal,
    setReveal,
    learnIndex,
    setLearnIndex,
    libraryFocus,
    openReference,
    openConcept,
  }), [session, section, memory, toolsOpen, homeFocus, appInfo, chip, commandNonce, go, issue, takeCommand, sendToSection, draftTick, helpLevel, reveal, learnIndex, libraryFocus, openReference, openConcept]);

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const value = useContext(ShellContext);
  if (!value) throw new Error("useShell must be used inside ShellProvider");
  return value;
}
