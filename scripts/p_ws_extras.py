p='/app/frontend/src/pages/Workspace.jsx'; s=open(p).read()
def r(a,b):
    global s
    assert a in s, a[:70]; s=s.replace(a,b,1)
r('''  Cpu, Code2, Layers,''','''  Cpu, Code2, Layers, FlaskConical, ClipboardCopy,''')
r('''import { CodeBox } from "../components/CodeBox";''','''import { CodeBox } from "../components/CodeBox";
import TestsPanel, { testIssues } from "../components/TestsPanel";
import { blueprintClipboard, compileReport, reportSection } from "../lib/unrealExtras";''')
r('''  const ignoreIssue = (i) => { saveIgnores([...ignores, { key: i.key, file: i.file, message: i.message.slice(0, 400) }]);''','''  const ignoreIssue = (i) => { saveIgnores([...ignores, { key: i.key, file: i.file, message: i.message.slice(0, 400), by: (user?.name || "").slice(0, 120) }]);''')
r('''  const runFix = async (list, thenExport = null) => {
    if (!aiKey) { setKeyModal("required"); toast.error("Add your AI key to fix issues"); return; }
    const { used, limit } = modelUsage(usage, aiKey.provider, aiKey.model);
    if (limit && used + 1 > limit * 0.85 && !window.confirm(`You've used about ${used} of ~${limit} free ${aiKey.model} requests today. Fix anyway?`)) return;
    const before = { id: result.id, h: result.cpp_header || "", c: result.cpp_source || "" };
    setFix({ status: "running", count: list.length, list, before, thenExport });
    try {
      const { data } = await api.post("/ai/fix-cpp", {
        file_base: baseName(result),''','''  const runFix = async (list, thenExport = null, target = "code") => {
    if (!aiKey) { setKeyModal("required"); toast.error("Add your AI key to fix issues"); return; }
    const { used, limit } = modelUsage(usage, aiKey.provider, aiKey.model);
    if (limit && used + 1 > limit * 0.85 && !window.confirm(`You've used about ${used} of ~${limit} free ${aiKey.model} requests today. Fix anyway?`)) return;
    const tests = target === "tests";
    const before = { id: result.id, h: result.cpp_header || "", c: (tests ? result.tests?.code : result.cpp_source) || "" };
    setFix({ status: "running", count: list.length, list, before, thenExport, target });
    try {
      const { data } = await api.post("/ai/fix-cpp", {
        file_base: tests ? `${baseName(result)} (header, read-only) and its automation test file` : baseName(result),''')
r('''  const acceptFix = () => {
    const { data, list, before } = fix;''','''  const acceptFix = () => {
    const { data, list, before } = fix;
    if (fix.target === "tests") {
      if (result?.id !== before.id || (result.tests?.code || "") !== before.c) {
        setFix({ ...fix, status: "error", error: "The tests changed while the fix was being written, so it wasn't applied." });
        return;
      }
      const next = { ...result, tests: { ...result.tests, code: data.cpp_source } };
      setResult(next);
      setFix(null);
      const left = testIssues(next).length;
      toast.success(`Tests fixed: ${list.length - Math.min(left, list.length)} of ${list.length} cleared`, { description: `${left ? `${left} still listed. ` : ""}Press Save to keep it.` });
      return;
    }''')
r('''      built = await build(project?.name || result.system_name, system, { ...context, references: undefined }, checked);''','''      const byKey = Object.fromEntries(ignores.map((i) => [i.key, i.by]));
      const sys = override || result;
      const sections = [reportSection(sys.system_name || "System", { issues: checked, ignored: ignoredIssues.map((i) => ({ ...i, by: byKey[i.key] })), fixes: fixLog })];
      if (sys.tests?.code) sections.push(reportSection("Automation tests", { issues: testIssues(sys) }));
      const report = compileReport(sections, aiReview?.status === "done" && !override ? aiReview.model : null);
      built = await build(project?.name || result.system_name, system, { ...context, references: undefined }, checked, report);''')
r('''    { id: "cpp", label: "C++ Snippets", icon: Code2, test: "tab-cpp-code" },''','''    { id: "cpp", label: "C++ Snippets", icon: Code2, test: "tab-cpp-code" },
    { id: "tests", label: "Tests", icon: FlaskConical, test: "tab-tests" },''')
r('''            {tab === "graph" && <NodeGraph nodes={result?.node_graph_nodes || []} edges={result?.node_graph_edges || []} />}''','''            {tab === "graph" && (
              <div className="relative h-full">
                <NodeGraph nodes={result?.node_graph_nodes || []} edges={result?.node_graph_edges || []} />
                {result?.node_graph_nodes?.length > 0 && (
                  <button className="ue-btn ue-btn-primary !text-[12px] absolute top-3 right-3 z-20" onClick={copyForUnreal} title="Copies the graph in Unreal's clipboard format" data-testid="copy-for-unreal-button">
                    <ClipboardCopy size={13} /> Copy for Unreal
                  </button>
                )}
              </div>
            )}
            {tab === "tests" && result && (
              <TestsPanel system={result} projectId={project?.project_id} aiKey={aiKey} canEdit={!readOnly} fixing={fix?.status === "running"}
                onNeedKey={() => setKeyModal("required")} onUsed={() => setUsageTick((n) => n + 1)}
                onTests={(id, t) => setResult((r) => (r?.id === id ? { ...r, tests: t } : r))}
                onFix={(l) => runFix(l, null, "tests")} jump={jump} onJump={(i) => setJump({ file: "tests", line: i.line || 1, nonce: Date.now() })} />
            )}''')
r('''  const jumpTo = (issue) => {''','''  const copyForUnreal = async () => {
    const { text, mapped, total } = blueprintClipboard(result);
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${mapped} of ${total} nodes for Unreal`, {
        description: `Paste into a Blueprint Event Graph (Ctrl+V), e.g. the actor that owns the component. Build the plugin first; connect the component into each Target pin.${mapped < total ? " Unmapped nodes arrive as TODO comments." : ""}`,
        duration: 9000,
      });
    } catch { toast.error("Your browser blocked the clipboard"); }
  };
  const jumpTo = (issue) => {''')
r('''<FixReviewModal fix={fix} system={result}''','''<FixReviewModal fix={fix} system={fix.target === "tests" ? { cpp_header: result.cpp_header, cpp_source: result.tests?.code || "" } : result}''')
open(p,'w').write(s)
print("ok")
