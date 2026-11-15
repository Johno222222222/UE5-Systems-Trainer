import React, { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { api } from "../lib/api";
import { estimateCost } from "../lib/cost.mjs";

export function useUsage(aiKey, refreshKey) {
  const [usage, setUsage] = useState(null);
  useEffect(() => {
    if (!aiKey) { setUsage(null); return; }
    let live = true;
    api.get("/usage/today")
      .then((r) => live && setUsage(r.data))
      .catch(() => live && setUsage(null));
    return () => { live = false; };
  }, [aiKey, refreshKey]);
  return usage;
}

// {used, limit} for a Gemini model; limit is null when unknown (e.g. OpenAI)
export function modelUsage(usage, provider, model) {
  const used = usage?.models[model]?.used || 0;
  const limit = provider === "gemini" ? usage?.free_limits[model] ?? null : null;
  return { used, limit };
}

export default function UsageChip({ aiKey, usage }) {
  if (!aiKey || !usage) return null;
  const { used, limit } = modelUsage(usage, aiKey.provider, aiKey.model);
  const estimate = estimateCost(aiKey.model, "synthesis");
  const ratio = limit ? used / limit : 0;
  const tone = !limit ? "" : ratio >= 0.9 ? "!border-[var(--accent-red)] !text-[var(--accent-red)]" : ratio >= 0.7 ? "!border-[#e8c547] !text-[#e8c547]" : "";
  const title = limit
    ? `${used} of about ${limit} free ${aiKey.model} requests used today with this key on this computer (key tests and retries count). Resets at ${usage.resets}. Use of the same key in other apps isn't counted.`
    : `${used} ${aiKey.model} requests today with this key on this computer.`;
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`chip !cursor-default ${tone}`} title={title} data-testid="usage-chip">
        <Gauge size={11} /> {limit ? `${used} / ~${limit} today` : `${used} today`}
      </span>
      {estimate && (
        <span className="chip !cursor-default" title={estimate.text} data-testid="cost-estimate">
          about ${estimate.usd.toFixed(2)}
        </span>
      )}
    </span>
  );
}
