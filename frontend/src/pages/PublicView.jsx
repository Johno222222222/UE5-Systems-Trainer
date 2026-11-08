import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { Code2, Copy, Cpu, Download, Eye, GitBranch, Hammer, Workflow } from "lucide-react";
import NodeGraph from "../components/NodeGraph";
import AnnotatedPseudocode from "../components/AnnotatedPseudocode";
import SetupGuide from "../components/SetupGuide";
import { CodeBox } from "./Workspace";
import { api, downloadBlob, errorText, exportPayload } from "../lib/api";

const TABS = [
  ["graph", "Event Graph", Workflow],
  ["blueprint", "Blueprint Pseudocode", GitBranch],
  ["cpp", "C++ Snippets", Code2],
  ["setup", "Setup Guide", Hammer],
];

export default function PublicView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("graph");

  useEffect(() => {
    api.get(`/public/${token}`).then((r) => setData(r.data)).catch((e) => setError(errorText(e)));
  }, [token]);

  if (error) return <div className="bp-grid h-full flex items-center justify-center font-mono text-sm text-[var(--text-secondary)]" data-testid="public-error">{error}</div>;
  if (!data) return <div className="bp-grid h-full flex items-center justify-center font-mono text-sm text-[var(--text-muted)]">Loading…</div>;
  const s = data.system;
  const payload = () => JSON.stringify(exportPayload(data.name, s, data.context), null, 2);

  return (
    <div className="h-full flex flex-col" data-testid="public-view">
      <header className="h-14 shrink-0 border-b border-[var(--border-soft)] bg-[var(--bg-secondary)] flex items-center px-4 gap-3">
        <Cpu size={16} className="text-[var(--unreal-orange)]" />
        <div className="min-w-0 flex-1">
          <div className="font-display text-[17px] font-extrabold uppercase tracking-wider leading-none truncate" data-testid="public-project-name">{data.name}</div>
          <div className="text-[10.5px] font-mono text-[var(--text-muted)] mt-0.5 truncate">by {data.owner_name} · last saved by {data.updated_by_name} · {new Date(data.updated_at).toLocaleString()}</div>
        </div>
        <span className="chip !cursor-default !text-[var(--accent-cyan)]"><Eye size={11} /> View only</span>
        <button className="ue-btn" onClick={() => navigator.clipboard.writeText(payload()).then(() => toast.success("Project JSON copied"))} data-testid="public-copy-json"><Copy size={13} /> Copy JSON</button>
        <button className="ue-btn" onClick={() => downloadBlob(payload(), `${data.name.replace(/\s+/g, "_")}.json`)} data-testid="public-export-json"><Download size={13} /> Export JSON</button>
        <a href="/" className="ue-btn ue-btn-primary" data-testid="public-open-app">Open the app</a>
      </header>
      <div className="px-5 py-2 border-b border-[var(--border-soft)] flex items-center gap-3">
        <div className="text-[12px] font-mono text-[var(--text-secondary)] truncate flex-1">{s.summary}</div>
        {TABS.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id} data-testid={`public-tab-${id}`}
            className={`ue-btn !py-1.5 ${tab === id ? "!border-[var(--unreal-orange)] !text-[var(--unreal-orange)]" : ""}`}><Icon size={13} /> {label}</button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {tab === "graph" && <NodeGraph nodes={s.node_graph_nodes || []} edges={s.node_graph_edges || []} />}
        {tab === "blueprint" && <div className="p-5 h-full overflow-auto"><AnnotatedPseudocode code={s.blueprint_pseudocode} /></div>}
        {tab === "cpp" && (
          <div className="p-5 h-full overflow-auto grid md:grid-cols-2 gap-4">
            <CodeBox title={`${s.system_name}.h`} code={s.cpp_header} lang="cpp" testId="cpp-header" />
            <CodeBox title={`${s.system_name}.cpp`} code={s.cpp_source} lang="cpp" testId="cpp-source" />
          </div>
        )}
        {tab === "setup" && <SetupGuide steps={s.setup_guide || []} />}
      </div>
    </div>
  );
}
