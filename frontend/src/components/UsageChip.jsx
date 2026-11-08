import React, { useEffect, useState } from "react";
import { Gauge } from "lucide-react";
import { api } from "../lib/api";

async function fingerprint(key) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

export default function UsageChip({ aiKey, refreshKey }) {
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    if (!aiKey) { setUsage(null); return; }
    let live = true;
    fingerprint(aiKey.key)
      .then((fp) => api.get("/usage/today", { params: { fp } }))
      .then((r) => live && setUsage(r.data))
      .catch(() => live && setUsage(null));
    return () => { live = false; };
  }, [aiKey, refreshKey]);

  if (!aiKey || !usage) return null;
  const used = usage.models[aiKey.model]?.used || 0;
  const limit = aiKey.provider === "gemini" ? usage.free_limits[aiKey.model] : null;
  const ratio = limit ? used / limit : 0;
  const tone = !limit ? "" : ratio >= 0.9 ? "!border-[var(--accent-red)] !text-[var(--accent-red)]" : ratio >= 0.7 ? "!border-[#e8c547] !text-[#e8c547]" : "";
  const title = limit
    ? `${used} of about ${limit} free ${aiKey.model} requests used today with this key in this app (key tests and retries count). Resets at ${usage.resets}. Use of the same key elsewhere isn't counted.`
    : `${used} ${aiKey.model} requests today with this key in this app.`;
  return (
    <span className={`chip !cursor-default ${tone}`} title={title} data-testid="usage-chip">
      <Gauge size={11} /> {limit ? `${used} / ~${limit} today` : `${used} today`}
    </span>
  );
}
