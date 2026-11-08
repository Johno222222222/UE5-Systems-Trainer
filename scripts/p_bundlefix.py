p='/app/frontend/src/components/BundleModal.jsx'; s=open(p).read()
def r(a,b):
    global s
    assert a in s, a[:70]; s=s.replace(a,b,1)
r('''import { BookmarkPlus, FileArchive, Loader2 } from "lucide-react";
import Modal from "./Modal";
import { IssueList } from "./CompileCheck";
import { api, errorText, downloadBlob } from "../lib/api";
import { buildBundleZip, bundleIssues, planBundle } from "../lib/zipExport";
import { checkSystem } from "../lib/compileCheck";''','''import { BookmarkPlus, FileArchive, Loader2, Wand2 } from "lucide-react";
import Modal from "./Modal";
import { IssueList } from "./CompileCheck";
import FixReviewModal from "./FixReviewModal";
import { aiHeaders } from "./AiKeyModal";
import { modelUsage } from "./UsageChip";
import { api, errorText, downloadBlob } from "../lib/api";
import { baseName, buildBundleZip, bundleIssues, planBundle } from "../lib/zipExport";
import { checkSystem, issueKey, issueText } from "../lib/compileCheck";
import { fixNote, makeFixEntry } from "../lib/fixLog";

const activeIssues = (item) => {
  const ignored = new Set((item.raw.ignored_issues || []).map((i) => i.key));
  return checkSystem(item.system).filter((i) => !ignored.has(issueKey(i, item.system)));
};''')
r('''export default function BundleModal({ ids, preset, onClose, onPresetsChanged }) {''','''export default function BundleModal({ ids, preset, onClose, onPresetsChanged, aiKey, usage, onNeedKey, onUsed }) {''')
r('''  const [skipped, setSkipped] = useState([]);
''','''  const [skipped, setSkipped] = useState([]);
  const [batch, setBatch] = useState(null); // {queue: [item index], pos, fix, fixed, saved}
''')
r('''        setItems(valid.map((p) => ({ name: p.name, system: p.system, context: { ...(p.context || {}), references: undefined } })));''','''        setItems(valid.map((p) => ({
          name: p.name, system: p.system, context: { ...(p.context || {}), references: undefined },
          raw: { project_id: p.project_id, version: p.version, my_role: p.my_role, context: p.context || {}, ignored_issues: p.ignored_issues || [] },
        })));''')
r('''  const checks = useMemo(() => plan.map((p) => checkSystem(p.system)), [plan]);''','''  const checks = useMemo(() => plan.map(activeIssues), [plan]);
  const canEdit = (item) => ["owner", "editor"].includes(item.raw.my_role);

  const requestFix = async (queue, pos, done) => {
    const idx = queue[pos];
    const item = items[idx];
    const list = activeIssues(item);
    setBatch({ queue, pos, ...done, fix: { status: "running", count: list.length } });
    try {
      const { data } = await api.post("/ai/fix-cpp", {
        file_base: baseName(item.system), cpp_header: item.system.cpp_header, cpp_source: item.system.cpp_source,
        project_id: canEdit(item) ? item.raw.project_id : null,
        issues: list.slice(0, 40).map((i) => `${issueText(i)}${i.fix ? ` (suggested fix: ${i.fix})` : ""}`),
      }, { headers: aiHeaders(aiKey) });
      setBatch((b) => (b && b.pos === pos ? { ...b, fix: { status: "review", count: list.length, data } } : b));
    } catch (e) {
      setBatch((b) => (b && b.pos === pos ? { ...b, fix: { status: "error", count: list.length, error: e.response?.data?.detail?.message || errorText(e) } } : b));
    } finally { onUsed(); }
  };

  const advance = (b, done) => {
    if (b.pos + 1 < b.queue.length) requestFix(b.queue, b.pos + 1, done);
    else {
      setBatch(null);
      toast.success(`Batch fix done: ${done.fixed} of ${b.queue.length} project${b.queue.length === 1 ? "" : "s"} fixed`, {
        description: `${done.saved} saved as a new version${done.fixed > done.saved ? `; ${done.fixed - done.saved} fixed in this download only` : ""}. The compile check below is updated.`,
      });
    }
  };

  const startBatch = () => {
    if (!aiKey) { onNeedKey(); return; }
    const queue = items.map((it, i) => (activeIssues(it).length ? i : -1)).filter((i) => i >= 0);
    if (!queue.length) { toast.message("Nothing to fix", { description: "No project in this bundle has compile-check issues." }); return; }
    const { used, limit } = modelUsage(usage, aiKey.provider, aiKey.model);
    if (limit && used + queue.length > limit * 0.85 && !window.confirm(`This uses ${queue.length} request${queue.length === 1 ? "" : "s"}; you've used about ${used} of ~${limit} free ${aiKey.model} requests today. Continue?`)) return;
    requestFix(queue, 0, { fixed: 0, saved: 0 });
  };

  const acceptBatchFix = async () => {
    const b = batch;
    const idx = b.queue[b.pos];
    const item = items[idx];
    const next = { ...item.system, cpp_header: b.fix.data.cpp_header, cpp_source: b.fix.data.cpp_source };
    const entry = makeFixEntry(item.system, next, b.fix.data);
    const done = { fixed: b.fixed + 1, saved: b.saved };
    let raw = item.raw;
    if (canEdit(item)) {
      try {
        const { data } = await api.put(`/projects/${raw.project_id}`, { system: next, context: raw.context, note: fixNote(entry).slice(0, 200), fixes: [entry], base_version: raw.version });
        raw = { ...raw, version: data.version };
        done.saved += 1;
      } catch (e) {
        toast.error(`Couldn't save ${item.name}`, { description: e.response?.status === 409 ? "Someone saved it meanwhile. The fix is used in this download only." : errorText(e) });
      }
    }
    setItems((list) => list.map((it, i) => (i === idx ? { ...it, system: next, raw } : it)));
    advance(b, done);
  };''')
r('''      const { blob, filename } = await buildBundleZip(name, plan);''','''      const { blob, filename } = await buildBundleZip(name, plan, checks);''')
r('''            <button className="ue-btn" onClick={savePreset}''','''            <button className="ue-btn" onClick={startBatch} disabled={!!batch || !checks.some((c) => c.length)} title="Runs Fix these on every project with issues, one review at a time (1 request each)" data-testid="bundle-batch-fix">
              <Wand2 size={13} /> Fix all projects
            </button>
            <button className="ue-btn" onClick={savePreset}''')
r('''      )}
    </Modal>
  );
}''','''      )}
    </Modal>
      {batch && items && (
        <FixReviewModal fix={batch.fix} system={items[batch.queue[batch.pos]].system} base={baseName(items[batch.queue[batch.pos]].system)}
          progress={`Project ${batch.pos + 1} of ${batch.queue.length}: ${items[batch.queue[batch.pos]].name}`}
          acceptLabel={canEdit(items[batch.queue[batch.pos]]) ? "Accept and save new version" : "Accept (this download only)"}
          discardLabel="Skip this project"
          onAccept={acceptBatchFix}
          onRetry={() => requestFix(batch.queue, batch.pos, { fixed: batch.fixed, saved: batch.saved })}
          onDiscard={() => { if (batch.fix.status === "running") setBatch(null); else advance(batch, { fixed: batch.fixed, saved: batch.saved }); }} />
      )}
    </>
  );
}''')
r('''  return (
    <Modal title={preset''','''  return (
    <>
    <Modal title={preset''')
open(p,'w').write(s)
print("ok")
