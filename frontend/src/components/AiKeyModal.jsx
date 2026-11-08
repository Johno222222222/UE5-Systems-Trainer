import React, { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, KeyRound, Trash2 } from "lucide-react";
import Modal from "./Modal";

const LS = "ue5_architect_ai_key";
export const PROVIDERS = {
  gemini: {
    label: "Google Gemini",
    models: [["gemini-2.5-flash", "Gemini 2.5 Flash · free tier, recommended"], ["gemini-2.5-flash-lite", "Gemini 2.5 Flash-Lite · free tier, fastest"], ["gemini-2.5-pro", "Gemini 2.5 Pro · strongest, small free quota"]],
    getKey: "https://aistudio.google.com/app/apikey",
    hint: "Free key from Google AI Studio",
  },
  openai: {
    label: "OpenAI",
    models: [["gpt-4.1-mini", "GPT-4.1 mini · cheap, recommended"], ["gpt-4.1", "GPT-4.1 · stronger"], ["gpt-5-mini", "GPT-5 mini"]],
    getKey: "https://platform.openai.com/api-keys",
    hint: "Paid key from the OpenAI platform",
  },
};

export function loadAiKey() {
  try {
    const v = JSON.parse(localStorage.getItem(LS) || "null");
    return v && v.key && PROVIDERS[v.provider] ? v : null;
  } catch {
    return null;
  }
}

export const aiHeaders = (k) => ({ "X-LLM-Provider": k.provider, "X-LLM-Model": k.model, "X-LLM-Key": k.key });

const field = "w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-md px-2.5 py-2 text-[12px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--unreal-orange)]";

export default function AiKeyModal({ current, onSave, onClose, required }) {
  const [provider, setProvider] = useState(current?.provider || "gemini");
  const [model, setModel] = useState(current?.model || PROVIDERS.gemini.models[0][0]);
  const [key, setKey] = useState(current?.key || "");
  const p = PROVIDERS[provider];

  const pickProvider = (id) => {
    setProvider(id);
    setModel(PROVIDERS[id].models[0][0]);
  };
  const save = (e) => {
    e.preventDefault();
    const k = key.trim();
    if (k.startsWith("sk-emergent-")) {
      toast.error("Use your own Gemini or OpenAI key");
      return;
    }
    const value = { provider, model, key: k };
    localStorage.setItem(LS, JSON.stringify(value));
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
          <select value={model} onChange={(e) => setModel(e.target.value)} className={`${field} mt-1`} data-testid="ai-model-select">
            {p.models.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="eyebrow">API key</span>
          <input type="password" required autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)}
            placeholder={provider === "gemini" ? "AIza…" : "sk-…"} className={`${field} mt-1`} data-testid="ai-key-input" />
        </label>
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
