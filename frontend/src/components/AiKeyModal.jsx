import React, { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, KeyRound, Loader2, Trash2, XCircle, Zap } from "lucide-react";
import Modal from "./Modal";
import { api, errorText } from "../lib/api";

const LS = "ue5_architect_ai_key";
export const PROVIDERS = {
  gemini: {
    label: "Google Gemini",
    models: [
      ["gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite · free, recommended", "free"],
      ["gemini-3.1-flash-lite", "Gemini 3.1 Flash-Lite · free", "free"],
      ["gemini-3.8-flash", "Gemini 3.8 Flash · free, often busy", "free"],
      ["gemini-3.1-pro-preview", "Gemini 3.1 Pro · needs paid key", "paid"],
    ],
    getKey: "https://aistudio.google.com/app/apikey",
    hint: "Free key from Google AI Studio",
  },
  openai: {
    label: "OpenAI",
    models: [
      ["gpt-4.1-mini", "GPT-4.1 mini · needs paid key or credits", "paid"],
      ["gpt-4.1", "GPT-4.1 · needs paid key or credits", "paid"],
      ["gpt-5-mini", "GPT-5 mini · needs paid key or credits", "paid"],
    ],
    getKey: "https://platform.openai.com/api-keys",
    hint: "Paid key from the OpenAI platform",
  },
};

export const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const isPaid = (provider, model) => PROVIDERS[provider]?.models.find((m) => m[0] === model)?.[2] === "paid";

export function loadAiKey() {
  try {
    const v = JSON.parse(localStorage.getItem(LS) || "null");
    if (!v?.key || !PROVIDERS[v.provider]) return null;
    // Retired models (e.g. Gemini 2.5) move to the free default
    if (!PROVIDERS[v.provider].models.some((m) => m[0] === v.model)) {
      const fixed = { ...v, model: v.provider === "gemini" ? DEFAULT_MODEL : PROVIDERS[v.provider].models[0][0] };
      localStorage.setItem(LS, JSON.stringify(fixed));
      return fixed;
    }
    return v;
  } catch {
    return null;
  }
}

export function saveAiKey(value) {
  localStorage.setItem(LS, JSON.stringify(value));
}

export const aiHeaders = (k) => ({ "X-LLM-Provider": k.provider, "X-LLM-Model": k.model, "X-LLM-Key": k.key });

const field = "w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-md px-2.5 py-2 text-[12px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--unreal-orange)]";

export default function AiKeyModal({ current, onSave, onClose, required }) {
  const [provider, setProvider] = useState(current?.provider || "gemini");
  const [model, setModel] = useState(current?.model || DEFAULT_MODEL);
  const [key, setKey] = useState(current?.key || "");
  const [test, setTest] = useState(null); // null | "running" | {ok, message}
  const p = PROVIDERS[provider];

  const runTest = async (m = model, prov = provider) => {
    const k = key.trim();
    if (!k) return null;
    setTest("running");
    try {
      const { data } = await api.post("/ai/test-key", {}, { headers: aiHeaders({ provider: prov, model: m, key: k }) });
      setTest(data);
      return data;
    } catch (e) {
      const r = { ok: false, message: errorText(e) };
      setTest(r);
      return r;
    }
  };
  const chooseModel = (m) => {
    setModel(m);
    setTest(null);
    if (isPaid(provider, m) && key.trim()) runTest(m);
  };
  const switchToFree = () => {
    setProvider("gemini");
    setModel(DEFAULT_MODEL);
    setTest(null);
  };

  const pickProvider = (id) => {
    setProvider(id);
    const m = id === "gemini" ? DEFAULT_MODEL : PROVIDERS[id].models[0][0];
    setModel(m);
    setTest(null);
    if (isPaid(id, m) && key.trim()) runTest(m, id);
  };
  const save = async (e) => {
    e.preventDefault();
    const k = key.trim();
    if (k.startsWith("sk-emergent-")) {
      toast.error("Use your own Gemini or OpenAI key");
      return;
    }
    if (isPaid(provider, model)) {
      const r = test && test !== "running" ? test : await runTest();
      if (r?.code === "paid_model_required") return;
    }
    const value = { provider, model, key: k };
    saveAiKey(value);
    onSave(value);
    toast.success(`${p.label} key saved in this browser`);
  };
  const remove = () => {
    localStorage.removeItem(LS);
    onSave(null);
    setKey("");
    toast.message("AI key removed from this browser");
  };

  return (
    <Modal title="Your AI key" onClose={onClose} testId="ai-key-modal" width={480}>
      {required && (
        <div className="panel p-3 mb-4 border-[var(--unreal-orange)] text-[12px] text-[var(--text-secondary)]" data-testid="ai-key-required">
          Synthesis runs on your own AI key. Add one to start. A free Gemini key works.
        </div>
      )}
      <form onSubmit={save} className="space-y-3">
        <div className="flex gap-2">
          {Object.entries(PROVIDERS).map(([id, v]) => (
            <button key={id} type="button" onClick={() => pickProvider(id)} aria-pressed={provider === id} data-testid={`ai-provider-${id}`}
              className={`chip flex-1 justify-center !py-2 ${provider === id ? "active" : ""}`}>{v.label}</button>
          ))}
        </div>
        <label className="block">
          <span className="eyebrow">Model</span>
          <select value={model} onChange={(e) => chooseModel(e.target.value)} className={`${field} mt-1`} data-testid="ai-model-select">
            {p.models.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow">API key</span>
          <input type="password" required autoComplete="off" value={key} onChange={(e) => { setKey(e.target.value); setTest(null); }}
            placeholder={provider === "gemini" ? "AIza…" : "sk-…"} className={`${field} mt-1`} data-testid="ai-key-input" />
          <span className="block mt-1 text-[10.5px] font-mono text-[#e8c547]" data-testid="ai-key-free-note">Free Gemini keys work best. OpenAI free credits expire after 30 days.</span>
        </label>
        <div className="flex items-center gap-2">
          <button type="button" className="ue-btn !py-1 !px-2 !text-[11px] whitespace-nowrap shrink-0" onClick={() => runTest()} disabled={!key.trim() || test === "running"} data-testid="ai-key-test">
            {test === "running" ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />} Test key
          </button>
          {test && test !== "running" && test.code !== "paid_model_required" && (
            <span className={`flex items-center gap-1 text-[11.5px] font-mono ${test.ok ? "text-[var(--cpp-green)]" : "text-[var(--accent-red)]"}`} data-testid="ai-key-test-result">
              {test.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />} {test.message}
            </span>
          )}
        </div>
        {test?.code === "paid_model_required" && (
          <div className="panel p-3 border-[var(--accent-red)] bg-[rgba(239,68,68,0.08)] text-[12px] text-[var(--text-secondary)]" data-testid="ai-paid-model-error">
            <div className="font-semibold text-[var(--accent-red)] mb-1">This model needs a paid API key</div>
            Your key is on the free tier, which can't use {model}. Gemini 3.5 Flash-Lite works free, with roughly 500+ generations a day.
            <button type="button" className="ue-btn !py-1 !px-2 !text-[11px] mt-2" onClick={switchToFree} data-testid="ai-switch-free-model">Switch to Gemini 3.5 Flash-Lite</button>
          </div>
        )}
        <a href={p.getKey} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11.5px] font-mono text-[var(--unreal-orange)] hover:underline" data-testid="ai-get-key-link">
          {p.hint} <ExternalLink size={11} />
        </a>
        <div className="text-[10.5px] font-mono text-[var(--text-muted)] leading-relaxed">
          Stored only in this browser. It's sent with each synthesis straight to {p.label} through this app's server and is never saved there. Usage is billed to your own account.
        </div>
        <div className="flex gap-2 justify-end pt-1">
          {current && <button type="button" className="ue-btn !text-[var(--accent-red)]" onClick={remove} data-testid="ai-key-remove"><Trash2 size={13} /> Remove</button>}
          <button className="ue-btn ue-btn-primary" data-testid="ai-key-save"><KeyRound size={13} /> Save key</button>
        </div>
      </form>
    </Modal>
  );
}
