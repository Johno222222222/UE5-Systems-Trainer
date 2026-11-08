import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, File as FileIcon, Image, Paperclip, Trash2, Upload, X } from "lucide-react";
import { api, downloadBlob, errorText } from "../lib/api";

const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

async function upload(file, kind, projectId) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", kind);
  if (projectId) fd.append("project_id", projectId);
  const { data } = await api.post("/files", fd);
  return data;
}

async function download(f) {
  try {
    const { data } = await api.get(`/files/${f.file_id}`, { responseType: "blob" });
    downloadBlob(data, f.filename);
  } catch (e) {
    toast.error("Download failed", { description: errorText(e) });
  }
}

export function ReferencesBar({ references, onChange, projectId, disabled }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 5 - references.length);
    e.target.value = "";
    setBusy(true);
    const added = [];
    for (const f of files) {
      try {
        const r = await upload(f, "reference", projectId);
        added.push({ file_id: r.file_id, filename: r.filename, content_type: r.content_type });
      } catch (err) {
        toast.error(`Couldn't attach ${f.name}`, { description: errorText(err) });
      }
    }
    setBusy(false);
    if (added.length) onChange([...references, ...added]);
  };
  return (
    <div className="mt-1" data-testid="references-bar">
      <div className="flex items-center justify-between">
        <button type="button" className="ue-btn !py-1 !px-2 !text-[11px]" onClick={() => ref.current?.click()} disabled={disabled || busy || references.length >= 5} data-testid="attach-reference-button" title="Images, PDFs, .h .cpp .txt .md .json · up to 5 files, 10 MB each">
          <Paperclip size={12} /> {busy ? "Uploading…" : "Attach reference"}
        </button>
        <span className="text-[10px] font-mono text-[var(--text-muted)]">{references.length}/5 files</span>
      </div>
      <input ref={ref} type="file" multiple className="hidden" accept="image/*,.pdf,.h,.hpp,.cpp,.c,.txt,.md,.json,.ini,.cs,.py" onChange={pick} data-testid="attach-reference-input" />
      {references.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {references.map((r) => (
            <span key={r.file_id} className="chip active max-w-full" data-testid={`reference-chip-${r.file_id}`}>
              {r.content_type?.startsWith("image/") ? <Image size={11} /> : <FileIcon size={11} />}
              <span className="truncate max-w-[160px]">{r.filename}</span>
              {!disabled && (
                <button type="button" onClick={() => onChange(references.filter((x) => x.file_id !== r.file_id))} aria-label={`Remove ${r.filename}`} data-testid={`reference-remove-${r.file_id}`}><X size={11} /></button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectFiles({ project }) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const canEdit = project && project.my_role !== "viewer";

  useEffect(() => {
    if (!project) return;
    api.get(`/projects/${project.project_id}/files`).then((r) => setFiles(r.data.files)).catch((e) => toast.error(errorText(e)));
  }, [project]);

  if (!project) {
    return <div className="h-full flex items-center justify-center text-slate-500 font-mono text-sm" data-testid="files-no-project">Save this system as a project to keep files with it.</div>;
  }
  const pick = async (e) => {
    const list = [...(e.target.files || [])];
    e.target.value = "";
    setBusy(true);
    for (const f of list) {
      try {
        const r = await upload(f, "project", project.project_id);
        setFiles((fs) => [r, ...fs]);
      } catch (err) {
        toast.error(`Couldn't upload ${f.name}`, { description: errorText(err) });
      }
    }
    setBusy(false);
  };
  const remove = async (f) => {
    if (!window.confirm(`Delete ${f.filename}? Teammates will lose access too.`)) return;
    try {
      await api.delete(`/files/${f.file_id}`);
      setFiles((fs) => fs.filter((x) => x.file_id !== f.file_id));
    } catch (e) { toast.error(errorText(e)); }
  };

  return (
    <div className="p-5 h-full overflow-auto" data-testid="project-files">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="font-sub font-semibold">Project files</div>
          <div className="text-[11px] font-mono text-[var(--text-muted)]">Concept art, specs, exported code · up to 25 MB each</div>
        </div>
        {canEdit && <button className="ue-btn ue-btn-primary" onClick={() => ref.current?.click()} disabled={busy} data-testid="upload-project-file-button"><Upload size={13} /> {busy ? "Uploading…" : "Upload"}</button>}
        <input ref={ref} type="file" multiple className="hidden" onChange={pick} data-testid="upload-project-file-input" />
      </div>
      {files.length === 0 && <div className="text-[12px] font-mono text-[var(--text-muted)]" data-testid="files-empty">No files yet.</div>}
      <div className="space-y-1.5">
        {files.map((f) => (
          <div key={f.file_id} className="panel p-2.5 flex items-center gap-3" data-testid={`file-row-${f.file_id}`}>
            {f.content_type?.startsWith("image/") ? <Image size={15} className="text-[var(--accent-cyan)]" /> : <FileIcon size={15} className="text-[var(--text-muted)]" />}
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-mono truncate">{f.filename}</div>
              <div className="text-[10px] font-mono text-[var(--text-muted)]">{kb(f.size)} · {f.uploaded_by_name} · {new Date(f.created_at).toLocaleString()}</div>
            </div>
            <button className="ue-btn !py-1 !px-2 !text-[11px]" onClick={() => download(f)} data-testid={`file-download-${f.file_id}`}><Download size={12} /> Download</button>
            {canEdit && <button onClick={() => remove(f)} aria-label={`Delete ${f.filename}`} className="text-[var(--text-muted)] hover:text-[var(--accent-red)]" data-testid={`file-delete-${f.file_id}`}><Trash2 size={13} /></button>}
          </div>
        ))}
      </div>
    </div>
  );
}
