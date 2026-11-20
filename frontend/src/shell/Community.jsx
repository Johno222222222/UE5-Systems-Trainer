import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errorText } from "../lib/api";

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

export default function Community() {
  const [info, setInfo] = useState(null);
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pending, setPending] = useState("");
  const [repo, setRepo] = useState("");
  const [folder, setFolder] = useState("packs");
  const [enabled, setEnabled] = useState(false);

  const load = () => {
    api.get("/community").then((res) => {
      setInfo(res.data);
      setRepo(res.data?.repo || "");
      setFolder(res.data?.path || "packs");
      setEnabled(!!res.data?.enabled);
    }).catch((err) => toast.error(errorText(err)));
  };

  useEffect(() => { load(); }, []);

  const saveSettings = async (nextEnabled) => {
    try {
      const { data } = await api.put("/community/settings", { enabled: nextEnabled, repo, path: folder });
      setEnabled(data.enabled);
      setRepo(data.repo);
      setFolder(data.path);
      load();
      toast.success(data.enabled ? "Community download is on" : "Community download is off");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const stage = async (data) => {
    setPending(data);
    try {
      const { data: body } = await api.post("/packs/preview", { data });
      setPreview(body);
      if (!body.ok) toast.error(body.errors?.[0] || "That pack is not valid.");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      await stage(await readFile(file));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const importListed = async (id) => {
    try {
      const { data } = await api.get(`/community/packs/${id}`);
      await stage(data.base64);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const importPack = async (mode) => {
    try {
      const { data } = await api.post("/packs/import", { data: pending, mode });
      if (data.needsChoice) {
        setPreview({ ...preview, needsChoice: true, conflicts: data.conflicts });
        return;
      }
      toast.success(`Imported ${data.preview?.name || "pack"}`);
      setPreview(null);
      setPending("");
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const packs = info?.packs || [];

  return (
    <div className="home-screen" data-testid="community-screen">
      <div className="home-inner">
        <div className="eyebrow">Community</div>
        <h1 className="font-display text-[40px] font-extrabold uppercase tracking-wider leading-none mt-1">Community</h1>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)] max-w-xl" data-testid="community-status">
          {enabled
            ? `Download is on. Packs are read from ${info?.repo || "Johno222222222/ue5-systems-training-tool-packs"}/${info?.path || "packs"}/index.json. A bad connection or a bad index leaves this list empty, and a local .bbpack still imports.`
            : "Download from the public pack repo is off. You can still import a .bbpack from this computer."}
        </p>

        <div className="panel p-4 mt-5" data-testid="community-settings">
          <div className="eyebrow mb-2">Download</div>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={enabled} data-testid="community-enabled" onChange={(event) => saveSettings(event.target.checked)} />
            List packs from GitHub
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <input className="graph-search" aria-label="GitHub repo" placeholder="owner/repo" value={repo} data-testid="community-repo" onChange={(event) => setRepo(event.target.value)} />
            <input className="graph-search" aria-label="Repo path" placeholder="packs" value={folder} data-testid="community-path" onChange={(event) => setFolder(event.target.value)} />
            <button type="button" className="ue-btn" data-testid="community-save" onClick={() => saveSettings(enabled)}>Save repo</button>
          </div>
          <p className="mt-2 text-[11px] font-mono text-[var(--text-muted)]">The list is index.json on the repo's main branch. A pack is checked before it imports.</p>
        </div>

        {(info?.problems || []).map((item) => (
          <p key={item} className="mt-3 text-[12px] font-mono text-[var(--accent-red)]" data-testid="community-problem">{item}</p>
        ))}

        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="eyebrow">{enabled ? "Repo packs" : "Bundled sample"}</div>
          <label className="ue-btn cursor-pointer" data-testid="community-import-file">
            Import a .bbpack
            <input type="file" accept=".bbpack,application/json,application/zip" className="hidden" onChange={onFile} />
          </label>
        </div>
        <div className="home-grid mt-3" data-testid="community-packs">
          {packs.map((pack) => (
            <button key={pack.id} type="button" className="panel home-card text-left" data-testid={`community-pack-${pack.id}`} onClick={() => setSelected(pack)}>
              <div className="font-sub font-semibold text-[15px]">{pack.title}</div>
              <div className="mt-1 text-[11px] font-mono text-[var(--text-muted)]">{pack.author}{pack.version ? ` · ${pack.version}` : ""}</div>
              <p className="mt-2 text-[12px] text-[var(--text-secondary)]">{pack.summary}</p>
              {(pack.tags || []).length > 0 && <div className="mt-2 text-[11px] font-mono text-[var(--text-muted)]">{pack.tags.join(" · ")}</div>}
            </button>
          ))}
          {!packs.length && <p className="text-[13px] text-[var(--text-secondary)]">No packs to show.</p>}
        </div>

        {selected && (
          <div className="panel p-4 mt-4" data-testid="community-detail">
            <div className="eyebrow">Pack</div>
            <h2 className="font-sub font-semibold text-[18px] mt-1">{selected.title}</h2>
            <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{selected.summary}</p>
            <p className="mt-1 text-[11px] font-mono text-[var(--text-muted)]">{selected.author}{selected.version ? ` · ${selected.version}` : ""} · {selected.file}</p>
            {(selected.tags || []).length > 0 && <p className="mt-1 text-[11px] font-mono text-[var(--text-muted)]">{selected.tags.join(" · ")}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="ue-btn ue-btn-primary" data-testid="community-import-listed" onClick={() => importListed(selected.id)}>Import this pack</button>
              <button type="button" className="ue-btn" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        )}

        {preview && (
          <div className="panel p-4 mt-4" data-testid="community-preview">
            <div className="eyebrow">Preview</div>
            {preview.ok ? (
              <>
                <h2 className="font-sub font-semibold text-[18px] mt-1">{preview.preview.name}</h2>
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{preview.preview.author} · {preview.preview.kind} · {preview.preview.version}</p>
                <p className="mt-2 text-[12px] font-mono text-[var(--text-muted)]" data-testid="community-preview-counts">
                  {preview.preview.counts.projects} projects · {preview.preview.counts.templates} templates · {preview.preview.counts.lessons} lessons · {preview.preview.counts.notes} notes · {preview.preview.counts.graphs} graphs
                </p>
                {(preview.conflicts || []).length > 0 && (
                  <p className="mt-2 text-[12px] text-[var(--accent-red)]" data-testid="community-conflicts">
                    Already here: {preview.conflicts.map((item) => item.name).join(", ")}. Rename keeps both. Replace overwrites.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {(preview.conflicts || []).length > 0 ? (
                    <>
                      <button type="button" className="ue-btn ue-btn-primary" data-testid="community-rename" onClick={() => importPack("rename")}>Rename</button>
                      <button type="button" className="ue-btn" data-testid="community-replace" onClick={() => importPack("replace")}>Replace</button>
                    </>
                  ) : (
                    <button type="button" className="ue-btn ue-btn-primary" data-testid="community-import-now" onClick={() => importPack("rename")}>Import</button>
                  )}
                  <button type="button" className="ue-btn" onClick={() => { setPreview(null); setPending(""); }}>Cancel</button>
                </div>
              </>
            ) : (
              <ul className="mt-2 text-[12px] text-[var(--accent-red)]">{(preview.errors || []).map((item) => <li key={item}>{item}</li>)}</ul>
            )}
          </div>
        )}

        <div className="panel p-4 mt-6" data-testid="community-submit">
          <div className="eyebrow mb-2">How to submit a pack</div>
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{info?.how_to_submit || "A pack is one .bbpack file. Add it with a pull request once a public repo exists."}</p>
        </div>
      </div>
    </div>
  );
}
