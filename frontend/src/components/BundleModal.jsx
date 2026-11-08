import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileArchive, Loader2 } from "lucide-react";
import Modal from "./Modal";
import { IssueList } from "./CompileCheck";
import { api, errorText, downloadBlob } from "../lib/api";
import { buildBundleZip, bundleIssues, planBundle } from "../lib/zipExport";
import { checkSystem } from "../lib/compileCheck";

const NAME_RE = /^[A-Za-z][A-Za-z0-9]{2,39}$/;

export default function BundleModal({ ids, onClose }) {
  const [items, setItems] = useState(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all(ids.map((id) => api.get(`/projects/${id}`).then((r) => r.data)))
      .then((list) => {
        const valid = list.filter((p) => p.system?.cpp_header);
        setItems(valid.map((p) => ({ name: p.name, system: p.system, context: { ...(p.context || {}), references: undefined } })));
        setName(`${valid.map((p) => (p.system.system_name || "").split(/\s+/)[0].replace(/[^A-Za-z0-9]/g, "")).join("")}Pack`.slice(0, 40));
      })
      .catch((e) => { toast.error("Couldn't load projects", { description: errorText(e) }); onClose(); });
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps

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
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Bundle into one plugin" onClose={onClose} testId="bundle-modal" width={600}>
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
          {shared.length > 0 && (
            <div className="panel p-3 border-[var(--accent-red)]">
              <div className="eyebrow mb-2">Conflicts between systems</div>
              <IssueList issues={shared} testId="bundle-conflicts" />
            </div>
          )}
          <div className="flex items-center gap-2 justify-end">
            {(shared.length > 0 || checks.some((c) => c.length)) && <span className="text-[10.5px] font-mono text-[var(--text-muted)] mr-auto">Issues are warnings; you can still export.</span>}
            <button className="ue-btn" onClick={onClose} data-testid="bundle-cancel">Cancel</button>
            <button className="ue-btn ue-btn-primary" onClick={download} disabled={!!nameError || busy || plan.length < 2} data-testid="bundle-download">
              <FileArchive size={13} /> Download {name || "plugin"}.zip
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
