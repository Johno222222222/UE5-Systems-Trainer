import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookmarkPlus, FileArchive, Loader2 } from "lucide-react";
import Modal from "./Modal";
import { IssueList } from "./CompileCheck";
import { api, errorText, downloadBlob } from "../lib/api";
import { buildBundleZip, bundleIssues, planBundle } from "../lib/zipExport";
import { checkSystem } from "../lib/compileCheck";

const NAME_RE = /^[A-Za-z][A-Za-z0-9]{2,39}$/;

export default function BundleModal({ ids, preset, onClose, onPresetsChanged }) {
  const [items, setItems] = useState(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [skipped, setSkipped] = useState([]);
  const [loadedIds, setLoadedIds] = useState([]);

  useEffect(() => {
    // One missing or no-longer-shared project shouldn't block the rest
    Promise.all(ids.map((id) => api.get(`/projects/${id}`).then((r) => r.data).catch(() => ({ missing: true, project_id: id }))))
      .then((list) => {
        const valid = list.filter((p) => !p.missing && p.system?.cpp_header?.trim() && p.system?.cpp_source?.trim());
        const missing = list.filter((p) => p.missing).length;
        setSkipped([
          ...list.filter((p) => !p.missing && !valid.includes(p)).map((p) => `${p.name} (no C++ yet)`),
          ...(missing ? [`${missing} project${missing === 1 ? "" : "s"} you can no longer open`] : []),
        ]);
        setLoadedIds(valid.map((p) => p.project_id));
        setItems(valid.map((p) => ({ name: p.name, system: p.system, context: { ...(p.context || {}), references: undefined } })));
        setName(preset?.plugin_name || `${[...new Set(valid.map((p) => (p.system.system_name || "").split(/\s+/)[0].replace(/[^A-Za-z0-9]/g, "")))].join("")}Pack`.slice(0, 40));
      });
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const savePreset = async () => {
    const label = window.prompt("Preset name (e.g. Survival Kit)", preset?.name || name)?.trim();
    if (!label) return;
    try {
      await api.post("/bundle-presets", { name: label.slice(0, 60), plugin_name: name, project_ids: loadedIds });
      toast.success(`Saved preset "${label}"`, { description: "Open it any time from Bundle presets in the Projects panel." });
      onPresetsChanged();
    } catch (e) { toast.error("Couldn't save the preset", { description: errorText(e) }); }
  };

  const plan = useMemo(() => (items ? planBundle(items) : []), [items]);
  const checks = useMemo(() => plan.map((p) => checkSystem(p.system)), [plan]);
  const shared = useMemo(() => bundleIssues(plan), [plan]);
  const clash = plan.some((p) => p.module === name);
  const nameError = !NAME_RE.test(name) ? "Letters and numbers only, 3–40 characters, starting with a letter." : clash ? "The plugin name can't match one of its module names." : "";

  const download = async () => {
    setBusy(true);
    try {
      const { blob, filename } = await buildBundleZip(name, plan);
      downloadBlob(blob, filename);
      toast.success(`Downloaded ${filename}`, { description: `${plan.length} modules in one plugin. Copy the folder into YourProject/Plugins and build.` });
      onClose();
    } catch (e) {
      toast.error("Couldn't build the plugin", { description: e.message });
    } finally { setBusy(false); }
  };

  return (
    <Modal title={preset ? `Bundle preset: ${preset.name}` : "Bundle into one plugin"} onClose={onClose} testId="bundle-modal" width={640}>
      {!items ? (
        <div className="flex items-center gap-2 text-[12px] font-mono text-[var(--text-muted)]"><Loader2 size={13} className="animate-spin" /> Loading projects…</div>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="eyebrow">Plugin name</span>
            <input value={name} onChange={(e) => setName(e.target.value.replace(/\s+/g, ""))} maxLength={40} data-testid="bundle-name-input"
              className="w-full mt-1 bg-[var(--bg-main)] border border-[var(--border)] rounded-md px-2.5 py-2 text-[12px] font-mono text-[var(--text-primary)] outline-none focus:border-[var(--unreal-orange)]" />
            {nameError && <span className="block mt-1 text-[10.5px] font-mono text-[var(--accent-red)]" data-testid="bundle-name-error">{nameError}</span>}
          </label>
          <div>
            <div className="eyebrow mb-1.5">Modules ({plan.length})</div>
            <ul className="space-y-1.5" data-testid="bundle-module-list">
              {plan.map((p, i) => {
                const e = checks[i].filter((x) => x.severity === "error").length;
                const w = checks[i].length - e;
                return (
                  <li key={p.module} className="panel p-2.5 text-[11.5px] font-mono" data-testid={`bundle-module-${i}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--text-primary)] font-semibold truncate flex-1">{p.name}</span>
                      <span className="chip !py-0 !text-[10px] !cursor-default">Source/{p.module}</span>
                      <span className={e ? "text-[var(--accent-red)]" : w ? "text-[#e8c547]" : "text-[var(--cpp-green)]"} data-testid={`bundle-module-check-${i}`}>
                        {e || w ? `${e}E · ${w}W` : "✓ clean"}
                      </span>
                    </div>
                    {p.uses.length > 0 && <div className="text-[var(--text-muted)] mt-1">Uses {p.uses.join(", ")} (added to its Build.cs)</div>}
                    {checks[i].length > 0 && <details className="mt-1.5"><summary className="cursor-pointer text-[var(--text-muted)]">Show issues</summary><div className="mt-1.5"><IssueList issues={checks[i]} testId={`bundle-issues-${i}`} /></div></details>}
                  </li>
                );
              })}
            </ul>
          </div>
          {skipped.length > 0 && (
            <div className="panel p-3 border-[#e8c547] text-[11.5px] font-mono text-[var(--text-secondary)]" data-testid="bundle-skipped">
              Skipped: {skipped.join(", ")}.
            </div>
          )}
          {plan.length < 2 && <div className="text-[11.5px] font-mono text-[var(--accent-red)]" data-testid="bundle-too-few">A bundle needs at least 2 projects with C++.</div>}
          {shared.length > 0 && (
            <div className="panel p-3 border-[var(--accent-red)]">
              <div className="eyebrow mb-2">Conflicts between systems</div>
              <IssueList issues={shared} testId="bundle-conflicts" />
            </div>
          )}
          <div className="flex items-center gap-2 justify-end">
            {(shared.length > 0 || checks.some((c) => c.length)) && <span className="text-[10.5px] font-mono text-[var(--text-muted)] mr-auto">Issues are warnings; you can still export.</span>}
            <button className="ue-btn" onClick={onClose} data-testid="bundle-cancel">Cancel</button>
            <button className="ue-btn" onClick={savePreset} disabled={!!nameError || plan.length < 2} data-testid="bundle-save-preset"><BookmarkPlus size={13} /> Save as preset</button>
            <button className="ue-btn ue-btn-primary" onClick={download} disabled={!!nameError || busy || plan.length < 2} data-testid="bundle-download">
              <FileArchive size={13} /> Download {name || "plugin"}.zip
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
