"use strict";

// Provider calls for synthesis, review, fixes, and tests.
//
// Adding a provider later:
// 1. Add its id and model ids to ALLOWED_MODELS in logic.js.
// 2. Add a branch in requestFor() and textFrom() below.
// 3. Add the same models to PROVIDERS in frontend/src/components/AiKeyModal.jsx
//    so the Settings screen can offer them.
// Keep the function signature of complete() stable. The rest of the app only
// talks to complete(), never to a provider's HTTP shape.

const { classifyError } = require("./logic");

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OLLAMA_URL = "http://127.0.0.1:11434/api/chat";

// Stable routing key for OpenAI prompt caching on gpt-4.1 and gpt-5-mini.
// It does not add tokens. The cached prefix is the system message, which
// stays byte-stable for a given Unreal version.
const PROMPT_CACHE_KEY = "ue5-architect";

function requestFor({ provider, model, apiKey, system, user, images, maxTokens, stream, cacheSystem = true }) {
  const imageParts = images || [];
  if (provider === "gemini") {
    const parts = [{ text: user }];
    for (const img of imageParts) {
      parts.push({ inlineData: { mimeType: img.mime, data: img.base64 } });
    }
    const action = stream ? "streamGenerateContent?alt=sse" : "generateContent";
    return {
      url: `${GEMINI_URL}/${encodeURIComponent(model)}:${action}`,
      headers: {
        "Content-Type": "application/json",
        // Header, not a query string, so the key is not written into URLs or logs.
        "x-goog-api-key": apiKey,
      },
      body: {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts }],
        generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
      },
    };
  }
  if (provider === "openai") {
    const content = imageParts.length
      ? [
        { type: "text", text: user },
        ...imageParts.map((img) => ({
          type: "image_url",
          image_url: { url: `data:${img.mime};base64,${img.base64}` },
        })),
      ]
      : user;
    const tokenField = String(model).startsWith("gpt-5") ? "max_completion_tokens" : "max_tokens";
    const body = {
      model,
      stream: !!stream,
      messages: [
        { role: "system", content: system },
        { role: "user", content },
      ],
      [tokenField]: maxTokens,
    };
    // GPT-5 chat models reject a custom temperature.
    if (!String(model).startsWith("gpt-5")) body.temperature = 0.7;
    if (cacheSystem) body.prompt_cache_key = PROMPT_CACHE_KEY;
    return {
      url: OPENAI_URL,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body,
    };
  }
  if (provider === "anthropic") {
    const content = imageParts.length
      ? [
        ...imageParts.map((img) => ({
          type: "image",
          source: { type: "base64", media_type: img.mime, data: img.base64 },
        })),
        { type: "text", text: user },
      ]
      : user;
    return {
      url: ANTHROPIC_URL,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: {
        model,
        max_tokens: maxTokens,
        temperature: 0.7,
        // Breakpoint on the system text only. A top-level cache_control would
        // also cache the user message, which changes every request.
        system: cacheSystem
          ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }]
          : system,
        messages: [{ role: "user", content }],
      },
    };
  }
  if (provider === "openrouter") {
    return {
      url: OPENROUTER_URL,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://127.0.0.1",
        "X-Title": require("./displayName").DISPLAY_NAME,
      },
      body: {
        model,
        stream: !!stream,
        temperature: 0.7,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
    };
  }
  if (provider === "ollama") {
    return {
      url: OLLAMA_URL,
      headers: { "Content-Type": "application/json" },
      body: {
        model,
        stream: false,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        options: { temperature: 0.7, num_predict: maxTokens },
      },
    };
  }
  const err = new Error(`Unknown AI provider "${provider}".`);
  err.status_code = 400;
  throw err;
}

function textFromJson(provider, data) {
  if (provider === "gemini") {
    const parts = data?.candidates?.[0]?.content?.parts || [];
    return parts.map((p) => p.text || "").join("");
  }
  if (provider === "anthropic") {
    const blocks = Array.isArray(data?.content) ? data.content : [];
    return blocks.map((block) => block.text || "").join("");
  }
  if (provider === "ollama") return data?.message?.content || "";
  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((p) => p.text || p.content || "").join("");
  return "";
}

// Gemini uses finishReason MAX_TOKENS. OpenAI uses finish_reason "length".
function finishReasonFrom(provider, data) {
  if (!data || typeof data !== "object") return "";
  if (provider === "gemini") return String(data.candidates?.[0]?.finishReason || "");
  if (provider === "anthropic") return String(data.stop_reason || data.delta?.stop_reason || "");
  if (provider === "ollama") return String(data.done_reason || "");
  return String(data.choices?.[0]?.finish_reason || "");
}

function isTruncatedFinish(reason) {
  const value = String(reason || "").toUpperCase().replace(/[\s-]+/g, "_");
  return value === "MAX_TOKENS" || value === "LENGTH" || value === "MAX_COMPLETION_TOKENS";
}

// Output caps for the models this app offers. These are the provider maximums,
// not a smaller budget. A stacked system needs the whole allowance.
const OUTPUT_TOKEN_LIMITS = {
  gemini: {
    "gemini-3.5-flash-lite": 65536,
    "gemini-3.1-flash-lite": 65536,
    "gemini-3.8-flash": 65536,
    "gemini-3.1-pro-preview": 65536,
  },
  openai: {
    "gpt-4.1-mini": 32768,
    "gpt-4.1": 32768,
    "gpt-5-mini": 128000,
  },
  anthropic: {
    "claude-sonnet-4-5": 64000,
    "claude-haiku-4-5": 64000,
  },
  openrouter: {
    "anthropic/claude-sonnet-4.5": 32768,
    "openai/gpt-4.1-mini": 32768,
    "google/gemini-2.5-flash": 32768,
  },
  ollama: {
    "llama3.2": 8192,
    "qwen2.5-coder": 8192,
    "mistral": 8192,
  },
};

function outputTokenLimit(provider, model) {
  return OUTPUT_TOKEN_LIMITS[provider]?.[model] || (provider === "gemini" ? 65536 : 32768);
}

function maxTokensFor(provider, modelOrOpts) {
  const model = modelOrOpts && typeof modelOrOpts === "object" ? modelOrOpts.model : modelOrOpts;
  return outputTokenLimit(provider, model);
}

// Join a continuation onto a cut-off reply. If the model repeats the tail, keep it once.
function joinModelText(soFar, next) {
  const base = String(soFar || "");
  const addition = String(next || "");
  if (!addition) return base;
  if (!base) return addition;
  const max = Math.min(base.length, addition.length, 4000);
  for (let n = max; n >= 32; n -= 1) {
    if (base.slice(-n) === addition.slice(0, n)) return base + addition.slice(n);
  }
  return base + addition;
}

function deltaFromEvent(provider, data) {
  if (data?.error) {
    const err = new Error(typeof data.error === "string" ? data.error : JSON.stringify(data.error).slice(0, 800));
    err.status_code = data.error.code || data.error.status || 500;
    throw err;
  }
  if (provider === "gemini") {
    const parts = data?.candidates?.[0]?.content?.parts || [];
    return parts.map((p) => p.text || "").join("");
  }
  if (provider === "anthropic") return data?.delta?.text || "";
  if (provider === "ollama") return data?.message?.content || "";
  return data?.choices?.[0]?.delta?.content || "";
}

async function readResponse(res, provider, onChars) {
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text.slice(0, 800));
    err.status_code = res.status;
    throw err;
  }
  const state = { text: "", finishReason: "" };
  const ctype = res.headers.get("content-type") || "";
  if (!ctype.includes("text/event-stream")) {
    const data = await res.json();
    state.text = textFromJson(provider, data);
    state.finishReason = finishReasonFrom(provider, data);
    if (!state.text.trim()) {
      const reason = state.finishReason || data?.promptFeedback?.blockReason || data?.error?.message || "empty";
      const err = new Error(`The model returned no text (${reason}).`);
      err.status_code = 502;
      throw err;
    }
    if (onChars) onChars(state.text.length);
    return state;
  }
  if (!res.body || typeof res.body.getReader !== "function") {
    const raw = await res.text();
    for (const line of raw.split("\n")) consumeSseLine(provider, line, state, onChars);
  } else {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) consumeSseLine(provider, line, state, onChars);
    }
    if (buf.trim()) consumeSseLine(provider, buf, state, onChars);
  }
  if (!state.text.trim()) {
    const err = new Error("The model returned no text.");
    err.status_code = 502;
    throw err;
  }
  return state;
}

function consumeSseLine(provider, line, state, onChars) {
  const trimmed = String(line).trim();
  if (!trimmed.startsWith("data:")) return;
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === "[DONE]") return;
  let json;
  try {
    json = JSON.parse(payload);
  } catch {
    return;
  }
  const reason = finishReasonFrom(provider, json);
  if (reason) state.finishReason = reason;
  const piece = deltaFromEvent(provider, json);
  if (!piece) return;
  state.text += piece;
  if (onChars) onChars(state.text.length);
}

/**
 * Send one prompt and return the full reply text.
 * onChars(n) is called with the number of characters received so far.
 * fetchImpl is injectable for tests.
 */
function cacheRejected(exc) {
  const msg = String(exc?.message || "").toLowerCase();
  return (exc?.status_code === 400 || exc?.statusCode === 400)
    && /cache_control|prompt_cache_key/.test(msg);
}

async function complete({ provider, model, apiKey, system, user, images, maxTokens, onChars, timeoutMs, fetchImpl, signal, cacheSystem = true }) {
  const stream = typeof onChars === "function";
  const fetchFn = fetchImpl || globalThis.fetch;
  async function once(useCache) {
    const req = requestFor({
      provider, model, apiKey, system, user, images, maxTokens, stream, cacheSystem: useCache,
    });
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs || 120000);
    if (signal) {
      if (signal.aborted) ac.abort();
      else signal.addEventListener("abort", () => ac.abort(), { once: true });
    }
    try {
      const res = await fetchFn(req.url, {
        method: "POST",
        headers: req.headers,
        body: JSON.stringify(req.body),
        signal: ac.signal,
      });
      const read = await readResponse(res, provider, onChars);
      return {
        text: read.text,
        finishReason: read.finishReason,
        truncated: isTruncatedFinish(read.finishReason),
      };
    } catch (exc) {
      if (exc?.name === "AbortError" || ac.signal.aborted) {
        const err = new Error("timeout");
        err.name = "AbortError";
        err.status_code = 504;
        throw err;
      }
      throw exc;
    } finally {
      clearTimeout(timer);
    }
  }
  try {
    return await once(cacheSystem !== false);
  } catch (exc) {
    // A provider that does not know the cache field would fail the whole
    // request. Drop the field and send the same prompt once more.
    if (cacheSystem !== false && cacheRejected(exc)) return once(false);
    throw exc;
  }
}


// Offline stand-in for development checks. Enabled only with UE5_STUB_LLM=1.
function stubFetch() {
  const sample = {
    system_name: "Stub Health Component",
    summary: "A local stand-in system used when the model is stubbed.",
    tunable_parameters: [{ key: "max_health", label: "Max Health", value: 100, min: 1, max: 1000, step: 1, unit: "HP" }],
    modules: [{ name: "Regen", included: true, description: "restores health" }],
    blueprint_pseudocode: "Event BeginPlay\n  WHY: start full so the designer sees a WHY note",
    cpp_header: "UCLASS()\nclass UStubHealth : public UActorComponent {\n  GENERATED_BODY()\npublic:\n  UPROPERTY(EditAnywhere) int32 MaxHealth;\n};\n",
    cpp_source: "void UStubHealth::BeginPlay() { MaxHealth = 100; }\n",
    setup_guide: [{ step: 1, title: "Add the component", detail: "Drop it on the character", why: "keeps the system reusable" }],
    node_graph_nodes: [
      { id: "n1", label: "Event BeginPlay", node_type: "event", x: 80, y: 120, inputs: [], outputs: ["exec"] },
      { id: "n2", label: "Set Max Health", node_type: "function", x: 320, y: 120, inputs: ["exec"], outputs: ["exec"] },
    ],
    node_graph_edges: [{ from_node: "n1", to_node: "n2", kind: "exec" }],
    network_notes: "Local only.",
    applied_changes: [],
    shared_attributes: [],
  };
  return Promise.resolve(new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(sample) }] } }],
    choices: [{ message: { content: "OK" } }],
  }), { status: 200, headers: { "content-type": "application/json" } }));
}

module.exports = {
  complete,
  requestFor,
  PROMPT_CACHE_KEY,
  textFromJson,
  finishReasonFrom,
  isTruncatedFinish,
  outputTokenLimit,
  maxTokensFor,
  joinModelText,
  classifyError,
  stubFetch,
  GEMINI_URL,
  OPENAI_URL,
  ANTHROPIC_URL,
  OPENROUTER_URL,
  OLLAMA_URL,
};
