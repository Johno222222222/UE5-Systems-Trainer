import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bookmark, Pencil, Trash2 } from "lucide-react";
import { api, errorText } from "../lib/api";

export default function PresetsList({ refreshKey, onOpen }) {
  const [presets, setPresets] = useState([]);
  const load = useCallback(() => {
    api.get("/bundle-presets").then((r) => setPresets(r.data.presets)).catch(() => setPresets([]));
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

  if (!presets.length) return null;
  return (
    <div className="mt-4" data-testid="bundle-presets">
      <div className="eyebrow mb-2 flex items-center gap-1.5"><Bookmark size={11} /> Bundle presets</div>
      <div className="space-y-1.5">
        {presets.map((p) => (
          <div key={p.preset_id} className="panel p-2 flex items-center gap-2" data-testid={`preset-item-${p.preset_id}`}>
            <button className="flex-1 min-w-0 text-left" onClick={() => onOpen(p)} data-testid={`preset-open-${p.preset_id}`}>
              <div className="font-sub text-[12px] font-semibold truncate">{p.name}</div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">{p.plugin_name} · {p.project_ids.length} projects</div>
            </button>
            <button onClick={() => rename(p)} aria-label={`Rename ${p.name}`} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]" data-testid={`preset-rename-${p.preset_id}`}><Pencil size={12} /></button>
            <button onClick={() => remove(p)} aria-label={`Delete ${p.name}`} className="text-[var(--text-muted)] hover:text-[var(--accent-red)]" data-testid={`preset-delete-${p.preset_id}`}><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
