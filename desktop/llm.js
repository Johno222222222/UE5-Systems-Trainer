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

function requestFor({ provider, model, apiKey, system, user, images, maxTokens, stream }) {
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
    return {
      url: OPENAI_URL,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body,
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
  const choice = data?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((p) => p.text || p.content || "").join("");
  return "";
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
  return data?.choices?.[0]?.delta?.content || "";
}

async function readResponse(res, provider, onChars) {
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(text.slice(0, 800));
    err.status_code = res.status;
    throw err;
  }
  const ctype = res.headers.get("content-type") || "";
  if (!ctype.includes("text/event-stream")) {
    const data = await res.json();
    const text = textFromJson(provider, data);
    if (!text.trim()) {
      const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || data?.error?.message || "empty";
      const err = new Error(`The model returned no text (${reason}).`);
      err.status_code = 502;
      throw err;
    }
    if (onChars) onChars(text.length);
    return text;
  }
  if (!res.body || typeof res.body.getReader !== "function") {
    const raw = await res.text();
    let full = "";
    for (const line of raw.split("\n")) full = consumeSseLine(provider, line, full, onChars);
    return full;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) full = consumeSseLine(provider, line, full, onChars);
  }
  if (buf.trim()) full = consumeSseLine(provider, buf, full, onChars);
  if (!full.trim()) {
    const err = new Error("The model returned no text.");
    err.status_code = 502;
    throw err;
  }
  return full;
}

function consumeSseLine(provider, line, full, onChars) {
  const trimmed = String(line).trim();
  if (!trimmed.startsWith("data:")) return full;
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === "[DONE]") return full;
  let json;
  try {
    json = JSON.parse(payload);
  } catch {
    return full;
  }
  const piece = deltaFromEvent(provider, json);
  if (!piece) return full;
  const next = full + piece;
  if (onChars) onChars(next.length);
  return next;
}

/**
 * Send one prompt and return the full reply text.
 * onChars(n) is called with the number of characters received so far.
 * fetchImpl is injectable for tests.
 */
async function complete({ provider, model, apiKey, system, user, images, maxTokens, onChars, timeoutMs, fetchImpl, signal }) {
  const stream = typeof onChars === "function";
  const req = requestFor({ provider, model, apiKey, system, user, images, maxTokens, stream });
  const fetchFn = fetchImpl || globalThis.fetch;
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
    return await readResponse(res, provider, onChars);
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

function maxTokensFor(provider, { stack }) {
  if (provider === "gemini") return 24000;
  return stack ? 12000 : 8000;
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
  textFromJson,
  maxTokensFor,
  classifyError,
  stubFetch,
  GEMINI_URL,
  OPENAI_URL,
};
