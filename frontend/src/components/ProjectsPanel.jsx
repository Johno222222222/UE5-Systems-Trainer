import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Combine, Download, FileArchive, FileUp, FolderOpen, PackageSearch, Trash2 } from "lucide-react";
import { api, downloadBlob, errorText } from "../lib/api";
import PresetsList from "./PresetsList";

const ago = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
};

export default function ProjectsPanel({ refreshKey, currentId, onOpen, onDeleted, onStack, onBundle, busy }) {
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState([]);
  const fileRef = useRef(null);

  const load = useCallback(() => {
    api.get("/projects").then((r) => setItems(r.data.mine || [])).catch((e) => toast.error(errorText(e)));
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  const remove = async (p) => {
    if (!window.confirm(`Delete "${p.name}" from this computer? This cannot be undone.`)) return;
    try {
      await api.delete(`/projects/${p.project_id}`);
      toast.success("Project deleted");
      setSel((s) => s.filter((x) => x !== p.project_id));
      onDeleted(p.project_id);
      load();
    } catch (e) { toast.error(errorText(e)); }
  };

  const importFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data?.format === "ue5-architect-library") {
        const { data: result } = await api.post("/library/import", { data });
        toast.success(`Imported ${result.imported} project${result.imported === 1 ? "" : "s"}`);
        load();
        return;
      }
      const { data: proj } = await api.post("/projects/import", { data });
      toast.success(`Imported "${proj.name}"`);
      load();
      onOpen(proj.project_id);
    } catch (err) {
      toast.error("Import failed", { description: err instanceof SyntaxError ? "That file isn't valid JSON" : errorText(err) });
    }
  };

  const exportLibrary = async () => {
    try {
      const { data } = await api.get("/library/export");
      downloadBlob(JSON.stringify(data, null, 2), "ue5-architect-library.json");
      toast.success("Library backup downloaded", { description: "It includes projects, version history, and bundle presets. Uploaded files stay in the data folder." });
    } catch (e) { toast.error(errorText(e)); }
  };

  const toggle = (id) => {
    if (sel.includes(id)) setSel(sel.filter((x) => x !== id));
    else if (sel.length >= 6) toast.message("You can tick up to 6 projects", { description: "Untick one first." });
    else setSel([...sel, id]);
  };
  const stack = async () => {
    if (await onStack(sel)) setSel([]);
  };

  return (
    <div className="p-4" data-testid="projects-panel">
      <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <PackageSearch size={14} className="text-[var(--unreal-orange)]" />
          <span className="eyebrow">Projects</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={exportLibrary} data-testid="export-library-button"><Download size={12} /> Backup</button>
          <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={() => fileRef.current?.click()} data-testid="import-project-button"><FileUp size={12} /> Import</button>
        </div>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={importFile} data-testid="import-project-input" />
      </div>
      {items.length >= 2 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          <button className="ue-btn flex-1 min-w-[8rem] justify-center whitespace-normal text-center !border-[var(--accent-purple)] !text-[var(--accent-purple)]" onClick={stack} disabled={busy || sel.length < 2 || sel.length > 4} title="Merge into one integrated system with AI" data-testid="stack-systems-button">
            <Combine size={13} /> {sel.length < 2 ? "Tick 2+ to stack" : sel.length > 4 ? "Stack up to 4" : `Stack ${sel.length}`}
          </button>
          <button className="ue-btn flex-1 min-w-[8rem] justify-center whitespace-normal text-center" onClick={() => onBundle(sel)} disabled={sel.length < 2} title="Export the ticked projects as one Unreal plugin, one module each" data-testid="bundle-plugin-button">
            <FileArchive size={13} /> {sel.length < 2 ? "Tick 2+ to bundle" : `Bundle ${sel.length} as plugin`}
          </button>
        </div>
      )}
      {items.length === 0 && (
        <div className="text-[11px] font-mono text-[var(--text-muted)] p-2" data-testid="projects-empty">
          No projects yet. Synthesize a system and press Save.
        </div>
      )}
      <div className="space-y-1.5">
        {items.map((p) => (
          <div key={p.project_id} data-testid={`project-item-${p.project_id}`}
            className={`panel p-2 flex items-center gap-2 ${currentId === p.project_id ? "!border-[var(--unreal-orange)]" : sel.includes(p.project_id) ? "!border-[var(--accent-purple)]" : ""}`}>
            <input type="checkbox" checked={sel.includes(p.project_id)} onChange={() => toggle(p.project_id)} aria-label={`Select ${p.name} for stacking or bundling`} className="accent-[#a855f7]" data-testid={`stack-select-${p.project_id}`} />
            <button onClick={() => onOpen(p.project_id)} className="flex-1 text-left min-w-0" data-testid={`project-open-${p.project_id}`}>
              <div className="font-sub text-[12px] font-semibold truncate flex items-center gap-1.5">
                <FolderOpen size={11} className="shrink-0 text-[var(--text-muted)]" /> {p.name}
              </div>
              <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">
                saved {ago(p.updated_at)} · v{p.version}
              </div>
            </button>
            <button onClick={() => remove(p)} aria-label={`Delete ${p.name}`} className="text-[var(--text-muted)] hover:text-[var(--accent-red)]" data-testid={`project-delete-${p.project_id}`}><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <PresetsList refreshKey={refreshKey} onOpen={(pr) => { setSel(pr.project_ids.slice(0, 6)); onBundle(pr.project_ids, pr); }} />
    </div>
  );
}
