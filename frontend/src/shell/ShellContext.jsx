import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { APP_VERSION, SECTION_REGISTRY, rememberOpen } from "../lib/shell.mjs";
import { createWorkspaceSession, openItemFromDraft, systemChip } from "../lib/workspaceSession.mjs";

const ShellContext = createContext(null);

export function ShellProvider({ children }) {
  const sessionRef = useRef(null);
  if (!sessionRef.current) sessionRef.current = createWorkspaceSession();
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
  const [appInfo, setAppInfo] = useState({ version: APP_VERSION, update: null });
  const commandRef = useRef(null);
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const [commandNonce, setCommandNonce] = useState(0);

  useEffect(() => session.subscribe(() => setDraftTick((n) => n + 1)), [session]);

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

  const sendToSection = useCallback((sectionId) => {
    const item = openItemFromDraft(session.get());
    if (item) setMemory((prev) => rememberOpen(prev, sectionId, item));
    if (sectionId === "tools") {
      const projectId = session.get()?.project?.project_id;
      if (projectId) issue({ type: "open-project", id: projectId });
      else setSection("tools");
      return;
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
  }), [session, section, memory, toolsOpen, homeFocus, appInfo, chip, commandNonce, go, issue, takeCommand, sendToSection, draftTick]);

  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const value = useContext(ShellContext);
  if (!value) throw new Error("useShell must be used inside ShellProvider");
  return value;
}
