import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, FolderOpen, KeyRound, Loader2, Trash2, XCircle, Zap } from "lucide-react";
import Modal from "./Modal";
import { api, errorText } from "../lib/api";
import { APP_VERSION } from "../lib/shell.mjs";
import { INTRO } from "../lib/references.mjs";

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
  anthropic: {
    label: "Anthropic",
    models: [
      ["claude-sonnet-4-5", "Claude Sonnet 4.5 · paid", "paid"],
      ["claude-haiku-4-5", "Claude Haiku 4.5 · paid", "paid"],
    ],
    getKey: "https://console.anthropic.com/settings/keys",
    hint: "Paid key from the Anthropic console",
  },
  openrouter: {
    label: "OpenRouter",
    models: [
      ["anthropic/claude-sonnet-4.5", "Claude Sonnet via OpenRouter · paid", "paid"],
      ["openai/gpt-4.1-mini", "GPT-4.1 mini via OpenRouter · paid", "paid"],
      ["google/gemini-2.5-flash", "Gemini Flash via OpenRouter · paid", "paid"],
    ],
    getKey: "https://openrouter.ai/keys",
    hint: "Paid key from OpenRouter",
  },
  ollama: {
    label: "Ollama",
    local: true,
    models: [
      ["llama3.2", "Llama 3.2 · on this computer", "local"],
      ["qwen2.5-coder", "Qwen 2.5 Coder · on this computer", "local"],
      ["mistral", "Mistral · on this computer", "local"],
    ],
    getKey: "https://ollama.com/download",
    hint: "Install Ollama on this computer. No key, and it works with the internet off",
  },
};

export const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const isPaid = (provider, model) => PROVIDERS[provider]?.models.find((m) => m[0] === model)?.[2] === "paid";

export function settingsToKey(settings) {
  if (!settings?.provider) return null;
  if (settings.provider === "ollama") return { provider: "ollama", model: settings.model, hasKey: true };
  if (!settings.keys?.[settings.provider]) return null;
  return { provider: settings.provider, model: settings.model, hasKey: true };
}

export async function saveAiKey(value) {
  const { data } = await api.put("/settings", {
    provider: value.provider,
    model: value.model,
    ...(value.key ? { key: value.key } : {}),
  });
  return settingsToKey(data);
}

export const aiHeaders = (k) => {
  const headers = { "X-LLM-Provider": k.provider, "X-LLM-Model": k.model };
  if (k.key) headers["X-LLM-Key"] = k.key;
  return headers;
};

const field = "w-full bg-[var(--bg-main)] border border-[var(--border)] rounded-md px-2.5 py-2 text-[12px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--unreal-orange)]";

export default function AiKeyModal({ current, onSave, onClose, required, onClearProjectContext }) {
  const [provider, setProvider] = useState(current?.provider || "gemini");
  const [model, setModel] = useState(current?.model || DEFAULT_MODEL);
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState({ gemini: false, openai: false, anthropic: false, openrouter: false, ollama: false, data_dir: "", key_storage: "file", engine_path: "" });
  const [enginePath, setEnginePath] = useState("");
  const [engineNote, setEngineNote] = useState("");
  const [test, setTest] = useState(null);
  const [aboutVersion, setAboutVersion] = useState(APP_VERSION);
  const p = PROVIDERS[provider];
  const localModel = !!p.local;

  useEffect(() => {
    api.get("/settings").then((r) => {
      if (!r.data?.keys) return;
      setSaved({ ...r.data.keys, data_dir: r.data.data_dir, key_storage: r.data.key_storage, engine_path: r.data.engine_path || "" });
      setEnginePath(r.data.engine_path || "");
    }).catch(() => {});
    api.get("/engine").then((r) => setEngineNote(r.data?.message || "")).catch(() => {});
    api.get("/app").then((r) => { if (r.data?.version) setAboutVersion(r.data.version); }).catch(() => {});
    // Load once when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const testSeq = useRef(0);
  const runTest = async (m = model, prov = provider) => {
    const k = key.trim();
    if (!k && !saved[prov] && !PROVIDERS[prov]?.local) return null;
    const seq = ++testSeq.current;
    setTest("running");
    let r;
    try {
      r = (await api.post("/ai/test-key", {}, { headers: aiHeaders({ provider: prov, model: m, key: k || undefined }) })).data;
    } catch (e) {
      r = { ok: false, message: errorText(e) };
    }
    if (seq !== testSeq.current) return null;
    setTest(r);
    return r;
  };
  const resetTest = () => { testSeq.current += 1; setTest(null); };
  const chooseModel = (m) => {
    setModel(m);
    resetTest();
    if (isPaid(provider, m) && (key.trim() || saved[provider])) runTest(m);
  };
  const switchToFree = () => {
    setProvider("gemini");
    setModel(DEFAULT_MODEL);
    resetTest();
  };
  const pickProvider = (id) => {
    setProvider(id);
    const m = id === "gemini" ? DEFAULT_MODEL : PROVIDERS[id].models[0][0];
    setModel(m);
    setKey("");
    resetTest();
    if (isPaid(id, m) && saved[id]) runTest(m, id);
  };
  const save = async (e) => {
    e.preventDefault();
    const k = key.trim();
    if (!k && !saved[provider] && !localModel) {
      toast.error("Paste an API key first");
      return;
    }
    if (isPaid(provider, model)) {
      const r = test && test !== "running" ? test : await runTest();
      if (!r || r.code === "paid_model_required") return;
    }
    try {
      const value = await saveAiKey({ provider, model, key: k });
      onSave(value);
      toast.success(`${p.label} saved on this computer`);
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const remove = async () => {
    try {
      const { data } = await api.put("/settings", { provider, model, clear_key: true });
      onSave(settingsToKey(data));
      setSaved((s) => ({ ...s, [provider]: false }));
      setKey("");
      toast.message("API key removed from this computer");
    } catch (err) {
      toast.error(errorText(err));
    }
  };
  const openFolder = async () => {
    try {
      await api.post("/app/open-data-dir");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const storageNote = saved.key_storage === "os"
    ? "Keys are locked with this computer's sign-in (Windows data protection, macOS Keychain, or the Linux keyring). They are not written into projects."
    : "Keys are encrypted in the app data folder. This computer has no OS key store, so keep that folder private.";

  return (
    <Modal title="Settings" onClose={onClose} testId="ai-key-modal" width={560}>
      {required && (
        <div className="panel p-3 mb-4 border-[var(--unreal-orange)] text-[12px] text-[var(--text-secondary)]" data-testid="ai-key-required">
          Synthesis runs on your own AI key. Add one to start. A free Gemini key works.
        </div>
      )}
      <form onSubmit={save} className="space-y-3">
        <div className="flex flex-wrap gap-2">
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
          <span className="eyebrow">API key {saved[provider] ? "· saved" : ""}</span>
          <input type="password" autoComplete="off" value={key} onChange={(e) => { setKey(e.target.value); resetTest(); }}
            placeholder={saved[provider] ? "Saved on this computer — type a new key to replace it" : (provider === "gemini" ? "AIza…" : "sk-…")}
            className={`${field} mt-1`} data-testid="ai-key-input" />
          <span className="block mt-1 text-[10.5px] font-mono text-[#e8c547]" data-testid="ai-key-free-note">
            {localModel ? "Ollama runs on this computer. Leave the key blank. It still works with the internet off." : "Free Gemini keys work best. OpenAI, Anthropic, and OpenRouter models are paid."}
          </span>
        </label>
        <div className="flex items-center gap-2">
          <button type="button" className="ue-btn !py-1 !px-2 !text-[11px] whitespace-nowrap shrink-0" onClick={() => runTest()} disabled={(!key.trim() && !saved[provider] && !localModel) || test === "running"} data-testid="ai-key-test">
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
        <div className="text-[10.5px] font-mono text-[var(--text-muted)] leading-relaxed" data-testid="ai-key-storage-note">
          {storageNote} Paid models are billed to your own account. Ollama stays on this computer.
        </div>
        {saved.data_dir && (
          <div className="panel p-2.5" data-testid="data-folder">
            <div className="eyebrow mb-1">Projects and keys live here</div>
            <div className="text-[10.5px] font-mono text-[var(--text-secondary)] break-all">{saved.data_dir}</div>
            <button type="button" className="ue-btn !py-1 !px-2 !text-[11px] mt-2" onClick={openFolder} data-testid="open-data-folder"><FolderOpen size={12} /> Open folder</button>
          </div>
        )}
        <div className="panel p-2.5" data-testid="clear-project-context-row">
          <div className="eyebrow mb-1">Project context</div>
          <p className="text-[10.5px] font-mono text-[var(--text-muted)] leading-relaxed">
            Clears the Project Context remembered on this computer. Projects you already saved keep their own context.
          </p>
          <button type="button" className="ue-btn !py-1 !px-2 !text-[11px] mt-2" data-testid="clear-project-context"
            onClick={() => {
              if (!window.confirm("Clear the Project Context remembered on this computer? Saved projects keep their own context.")) return;
              onClearProjectContext?.();
            }}>
            Clear remembered project context
          </button>
        </div>
        <div className="panel p-2.5" data-testid="engine-path-row">
          <div className="eyebrow mb-1">Unreal engine</div>
          <p className="text-[10.5px] font-mono text-[var(--text-muted)] leading-relaxed">
            Used by the real compile check. UE 5.8 is preferred, then 5.7. Leave this blank to search the usual install folder. The folder should contain Engine/Build/BatchFiles.
          </p>
          <input value={enginePath} onChange={(e) => setEnginePath(e.target.value)} placeholder="Engine folder, or blank to search" className={`${field} mt-2`} data-testid="engine-path-input" />
          <button type="button" className="ue-btn !py-1 !px-2 !text-[11px] mt-2" data-testid="engine-path-save" onClick={async () => {
            try {
              const { data } = await api.put("/settings", { provider, model, engine_path: enginePath.trim() });
              setSaved((s) => ({ ...s, ...data.keys, engine_path: data.engine_path || "", data_dir: data.data_dir, key_storage: data.key_storage }));
              const engine = await api.get("/engine");
              setEngineNote(engine.data?.message || "");
              toast.success("Engine folder saved");
            } catch (err) {
              toast.error(errorText(err));
            }
          }}>Save engine path</button>
          {engineNote && <p className="mt-2 text-[12px] text-[var(--text-secondary)]" data-testid="engine-status">{engineNote}</p>}
        </div>
        <div className="panel p-2.5" data-testid="about-scope">
          <div className="eyebrow mb-1">About</div>
          <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed" data-testid="about-is">{INTRO.is}</p>
          <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed mt-1" data-testid="about-isnt">{INTRO.isnt}</p>
          <p className="text-[10.5px] font-mono text-[var(--text-muted)] mt-2" data-testid="settings-about">
            UE5 System Architect {aboutVersion}
          </p>
        </div>
        <div className="flex gap-2 justify-end pt-1">
          {saved[provider] && <button type="button" className="ue-btn !text-[var(--accent-red)]" onClick={remove} data-testid="ai-key-remove"><Trash2 size={13} /> Remove</button>}
          <button className="ue-btn ue-btn-primary" disabled={test === "running"} data-testid="ai-key-save"><KeyRound size={13} /> Save</button>
        </div>
      </form>
    </Modal>
  );
}
