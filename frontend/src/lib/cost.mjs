// Same table as desktop/cost.js. The chip shows it before a paid request leaves.

export const REQUEST_USD = {
  "gemini-3.1-pro-preview": 0.04,
  "gpt-4.1-mini": 0.02,
  "gpt-4.1": 0.08,
  "gpt-5-mini": 0.03,
  "claude-sonnet-4-5": 0.06,
  "claude-haiku-4-5": 0.02,
  "anthropic/claude-sonnet-4.5": 0.07,
  "openai/gpt-4.1-mini": 0.02,
  "google/gemini-2.5-flash": 0.01,
};

const KIND_FACTOR = {
  synthesis: 1,
  learning: 0.5,
  review: 0.25,
  fix: 0.35,
  tests: 0.4,
  key_test: 0.05,
};

export function estimateCost(model, kind) {
  const base = REQUEST_USD[model];
  if (!base) return null;
  const factor = KIND_FACTOR[kind] || 1;
  const usd = Math.round(base * factor * 100) / 100;
  const label = String(kind || "request").replaceAll("_", " ");
  return {
    model,
    kind: kind || "request",
    usd,
    text: `About $${usd.toFixed(2)} for this ${label}. This is an estimate, not a bill.`,
  };
}
