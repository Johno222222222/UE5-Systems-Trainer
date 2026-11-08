import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bookmark, Pencil, Trash2 } from "lucide-react";
import { api, errorText } from "../lib/api";

export default function PresetsList({ refreshKey, onOpen }) {
  const [presets, setPresets] = useState([]);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    api.get("/bundle-presets").then((r) => { setPresets(r.data.presets); setFailed(false); }).catch(() => setFailed(true));
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const rename = async (p) => {
    const name = window.prompt("Preset name", p.name)?.trim();
    if (!name || name === p.name) return;
    try { await api.patch(`/bundle-presets/${p.preset_id}`, { name: name.slice(0, 60) }); load(); }
    catch (e) { toast.error(errorText(e)); }
  };
  const remove = async (p) => {
    if (!window.confirm(`Delete the preset "${p.name}"? The projects themselves aren't touched.`)) return;
    try { await api.delete(`/bundle-presets/${p.preset_id}`); toast.success("Preset deleted"); load(); }
    catch (e) { toast.error(errorText(e)); }
  };

  if (failed) return <button className="mt-4 text-[11px] font-mono text-[var(--accent-red)] hover:underline" onClick={load} data-testid="presets-retry">Couldn't load bundle presets. Retry</button>;
  if (!presets.length) return null;
  return (
    <div className="mt-4" data-testid="bundle-presets">
      <div className="eyebrow mb-2 flex items-center gap-1.5"><Bookmark size={11} /> Bundle presets</div>
      <div className="text-[10px] font-mono text-[var(--text-muted)] mb-2">Teammates see a preset when they can open all of its projects. Only its creator can rename or delete it.</div>
      <div className="space-y-1.5">
        {presets.map((p) => (
          <div key={p.preset_id} className="panel p-2 flex items-center gap-2" data-testid={`preset-item-${p.preset_id}`}>
            <button className="flex-1 min-w-0 text-left" onClick={() => onOpen(p)} data-testid={`preset-open-${p.preset_id}`}>
              <div className="font-sub text-[12px] font-semibold truncate">{p.name}</div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">{p.mine === false ? <span className="text-[var(--accent-cyan)]">from {p.owner_name} · </span> : null}{p.plugin_name} · {p.project_ids.length} projects</div>
            </button>
            {p.mine !== false && <button onClick={() => rename(p)} aria-label={`Rename ${p.name}`} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]" data-testid={`preset-rename-${p.preset_id}`}><Pencil size={12} /></button>}
            {p.mine !== false && <button onClick={() => remove(p)} aria-label={`Delete ${p.name}`} className="text-[var(--text-muted)] hover:text-[var(--accent-red)]" data-testid={`preset-delete-${p.preset_id}`}><Trash2 size={12} /></button>}
          </div>
        ))}
      </div>
    </div>
  );
}
