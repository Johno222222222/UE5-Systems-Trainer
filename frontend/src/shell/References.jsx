import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { resolveConcept } from "../lib/content.mjs";
import { challengesOf, impactLines, readyChallenge } from "../lib/practice.mjs";
import NodeGraph from "../components/NodeGraph";
import { CodeBox } from "../components/CodeBox";
import WhyNote from "../components/WhyNote";
import { useShell } from "./ShellContext";

function Docs({ links, testId }) {
  if (!links?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2" data-testid={testId}>
      <span className="text-[11px] font-mono text-[var(--text-muted)]">Inspired by</span>
      {links.map((link) => (
        <a key={link.url} className="text-[11px] font-mono text-[var(--unreal-orange)] hover:underline" href={link.url} target="_blank" rel="noreferrer">
          {link.title}
        </a>
      ))}
    </div>
  );
}

function Tags({ complexity, prerequisites }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {complexity && <span className="chip !cursor-default" data-testid="complexity-tag">{complexity}</span>}
      {(prerequisites || []).map((item) => (
        <span key={item} className="chip !cursor-default" data-testid={`prereq-${item}`}>{item}</span>
      ))}
    </div>
  );
}

export default function References() {
  const shell = useShell();
  const focus = shell.libraryFocus;
  const [examples, setExamples] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [tab, setTab] = useState("graph");
  const [impactKey, setImpactKey] = useState(null);
  const [answerNote, setAnswerNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setAnswerNote(""); }, [focus.view, focus.conceptId, focus.exampleId]);

  useEffect(() => {
    let alive = true;
    api.get("/examples").then((r) => { if (alive) setExamples(r.data?.examples || []); }).catch(() => {});
    api.get("/concepts").then((r) => { if (alive) setConcepts(r.data?.concepts || []); }).catch(() => {});
    api.get("/templates").then((r) => { if (alive) setTemplates(r.data?.templates || []); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const workspace = shell.session.get()?.result || null;
  const bundled = examples.find((item) => item.id === focus.exampleId) || null;
  const templateHit = templates.find((item) => item.id === focus.exampleId) || null;
  const reading = focus.exampleId === "workspace" && workspace
    ? {
      id: "workspace",
      title: workspace.system_name || "Open system",
      summary: workspace.summary || "",
      complexity: workspace.learning?.complexity || "",
      prerequisites: workspace.learning?.prerequisites || [],
      key_decisions: [],
      learn_more: [],
      system: workspace,
      forkSource: null,
    }
    : templateHit?.starter
      ? {
        id: templateHit.id,
        title: templateHit.title,
        summary: templateHit.tagline || templateHit.starter.summary || "",
        complexity: templateHit.complexity || templateHit.starter.learning?.complexity || "",
        prerequisites: templateHit.prerequisites || templateHit.starter.learning?.prerequisites || [],
        key_decisions: [],
        learn_more: templateHit.learn_more || [],
        system: templateHit.starter,
        forkSource: "template",
      }
      : (bundled || examples[0])
        ? { ...(bundled || examples[0]), forkSource: "example" }
        : null;
  const system = reading?.system || null;
  const challenge = readyChallenge(challengesOf(system)[0], system);
  const card = resolveConcept(concepts, focus.conceptId) || null;
  const view = focus.view === "concepts" ? "concepts" : "reading";

  const fork = async (source, id, title) => {
    setBusy(true);
    try {
      const { data } = await api.post("/library/fork", { source, id });
      toast.success(`Forked ${data.name || title}`, { description: "It is in your projects. The original example is unchanged." });
      shell.go("home");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Couldn't fork that example");
    } finally {
      setBusy(false);
    }
  };

  const answer = async (choiceIndex) => {
    if (!challenge || !system) return;
    const correct = choiceIndex === challenge.answer;
    setAnswerNote(correct ? "That's the one this system uses." : (challenge.why_people_pick || "That choice is tempting, but it is not what this system does."));
    try {
      await api.post("/progress/answer", {
        system_name: system.system_name,
        challenge_index: 0,
        correct,
      });
    } catch { /* the answer still shows */ }
  };

  return (
    <div className="home-screen" data-testid="references-screen">
      <div className="home-inner">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={`ue-btn ${view === "reading" ? "ue-btn-primary" : ""}`} data-testid="references-reading" onClick={() => shell.openReference(focus.exampleId === "workspace" ? "workspace" : (bundled?.id || "start-here"))}>Reading</button>
          <button type="button" className={`ue-btn ${view === "concepts" ? "ue-btn-primary" : ""}`} data-testid="references-concepts" onClick={() => shell.openConcept(focus.conceptId || concepts[0]?.id)}>Concepts</button>
        </div>

        {view === "concepts" && (
          <div className="mt-6" data-testid="concepts-library">
            <div className="eyebrow">Concepts</div>
            <h1 className="font-display text-[36px] font-extrabold uppercase tracking-wider leading-none mt-1">Concept library</h1>
            <p className="mt-2 text-[13px] text-[var(--text-secondary)] max-w-xl">Short notes that ship with the app. A challenge here does not call the model.</p>
            <div className="home-grid mt-4">
              {concepts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`panel home-card text-left ${card?.id === item.id ? "!border-[var(--unreal-orange)]" : ""}`}
                  data-testid={`concept-card-${item.id}`}
                  onClick={() => shell.openConcept(item.id)}
                >
                  <div className="font-sub font-semibold text-[14px]">{item.title}</div>
                  <div className="mt-1 text-[11px] font-mono text-[var(--text-muted)]">{item.examples?.[0]?.title || "Example"}</div>
                </button>
              ))}
            </div>
            {card && (
              <div className="panel p-4 mt-4" data-testid="concept-detail">
                <h2 className="font-display text-[28px] font-extrabold uppercase tracking-wider">{card.title}</h2>
                <p className="mt-2 text-[13px] text-[var(--text-secondary)] leading-relaxed">{card.explanation}</p>
                <Docs links={card.learn_more} testId="concept-docs" />
                <div className="mt-4" data-testid="concept-challenge">
                  <div className="eyebrow mb-2">Challenge</div>
                  <div className="text-[14px]">{card.challenge?.prompt}</div>
                  <div className="mt-2 flex flex-col gap-2">
                    {(card.challenge?.choices || []).map((choice, index) => (
                      <button key={choice} type="button" className="ue-btn justify-start whitespace-normal text-left" data-testid={`concept-choice-${index}`} onClick={() => setAnswerNote(index === card.challenge.answer ? "That's the one." : card.challenge.why_people_pick)}>
                        {choice}
                      </button>
                    ))}
                  </div>
                  {answerNote && <p className="mt-3 text-[13px] text-[var(--text-secondary)]" data-testid="concept-answer">{answerNote}</p>}
                </div>
                <div className="mt-4 flex flex-wrap gap-2" data-testid="concept-examples">
                  {(card.examples || []).map((link) => (
                    <button
                      key={`${link.kind}-${link.id}`}
                      type="button"
                      className="ue-btn"
                      data-testid={`concept-example-${link.id}`}
                      onClick={() => shell.openReference(link.id)}
                    >
                      {link.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {view === "reading" && reading && system && (
          <div className="mt-6" data-testid="reference-reading">
            <div className="flex flex-wrap gap-2 mb-3">
              {examples.map((item) => (
                <button key={item.id} type="button" className={`ue-btn !py-1 !px-2 !text-[11px] ${reading.id === item.id ? "ue-btn-primary" : ""}`} data-testid={`reference-example-${item.id}`} onClick={() => { setAnswerNote(""); setImpactKey(null); shell.openReference(item.id); }}>
                  {item.title}
                </button>
              ))}
              {workspace && (
                <button type="button" className={`ue-btn !py-1 !px-2 !text-[11px] ${reading.id === "workspace" ? "ue-btn-primary" : ""}`} data-testid="reference-open-workspace" onClick={() => shell.openReference("workspace")}>
                  System open in Tools
                </button>
              )}
            </div>
            <div className="eyebrow">References</div>
            <h1 className="font-display text-[36px] font-extrabold uppercase tracking-wider leading-none mt-1">{reading.title}</h1>
            <p className="mt-2 text-[13px] text-[var(--text-secondary)] max-w-xl">{reading.summary || system.summary}</p>
            <Tags complexity={reading.complexity} prerequisites={reading.prerequisites} />
            <Docs links={reading.learn_more} testId="reference-docs" />
            {reading.forkSource && (
              <button type="button" className="ue-btn ue-btn-primary mt-4" data-testid="reference-fork" disabled={busy} onClick={() => fork(reading.forkSource, reading.id, reading.title)}>
                Fork into my projects
              </button>
            )}
            {(reading.key_decisions || []).length > 0 && (
              <div className="panel p-4 mt-4" data-testid="key-decisions">
                <div className="eyebrow mb-2">Key decisions</div>
                <ul className="space-y-1">
                  {reading.key_decisions.map((line) => (
                    <li key={line} className="text-[13px] text-[var(--text-secondary)]">{line}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="tab-row mt-4">
              {[
                ["graph", "Event Graph", "reference-tab-graph"],
                ["blueprint", "Pseudocode", "reference-tab-blueprint"],
                ["cpp", "C++", "reference-tab-cpp"],
              ].map(([id, label, testId]) => (
                <button key={id} type="button" className={`ue-btn !py-1.5 ${tab === id ? "!border-[var(--unreal-orange)] !text-[var(--unreal-orange)]" : ""}`} data-testid={testId} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </div>
            {tab === "graph" && (
              <div className="relative mt-3 h-[420px] border border-[var(--border-soft)] rounded-md overflow-hidden" data-testid="reference-graph">
                <NodeGraph
                  nodes={system.node_graph_nodes || []}
                  edges={system.node_graph_edges || []}
                  whyByNode={Object.fromEntries((system.node_graph_nodes || []).map((node) => {
                    const notes = (system.learning?.why_notes || []).filter((item) => item.anchor?.kind === "node" && item.anchor.node_id === node.id);
                    return [node.id, notes[0]];
                  }).filter(([, item]) => item))}
                />
              </div>
            )}
            {tab === "blueprint" && (
              <pre className="panel p-4 mt-3 text-[12px] font-mono whitespace-pre-wrap text-[var(--text-secondary)]" data-testid="reference-pseudocode">{system.blueprint_pseudocode}</pre>
            )}
            {tab === "cpp" && (
              <div className="grid md:grid-cols-2 gap-4 mt-3" data-testid="reference-cpp">
                <CodeBox title={`${(system.system_name || "System").replace(/\s+/g, "")}.h`} code={system.cpp_header} lang="cpp" testId="reference-header" callouts={system.learning?.why_notes?.filter((item) => item.anchor?.file === ".h") || []} renderCallout={(item) => <WhyNote note={item} level="learning" forceOpen />} highlightLines={(impactKey ? impactLines(system, impactKey) : []).filter((line) => line.file === ".h").map((line) => line.line)} />
                <CodeBox title={`${(system.system_name || "System").replace(/\s+/g, "")}.cpp`} code={system.cpp_source} lang="cpp" testId="reference-source" callouts={system.learning?.why_notes?.filter((item) => item.anchor?.file === ".cpp") || []} renderCallout={(item) => <WhyNote note={item} level="learning" forceOpen />} highlightLines={(impactKey ? impactLines(system, impactKey) : []).filter((line) => line.file === ".cpp").map((line) => line.line)} />
              </div>
            )}
            <div className="mt-4 space-y-2" data-testid="reference-why-notes">
              {(system.learning?.why_notes || []).map((item) => (
                <WhyNote key={item.id} note={item} level="learning" forceOpen />
              ))}
            </div>
            {challenge && (
              <div className="panel p-4 mt-4" data-testid="reference-challenge">
                <div className="eyebrow mb-2">Challenge</div>
                <div className="text-[14px]">{challenge.prompt}</div>
                <div className="mt-2 flex flex-col gap-2">
                  {challenge.choices.map((choice, index) => (
                    <button key={choice} type="button" className="ue-btn justify-start whitespace-normal text-left" data-testid={`reference-choice-${index}`} onClick={() => answer(index)}>
                      {choice}
                    </button>
                  ))}
                </div>
                {answerNote && <p className="mt-3 text-[13px] text-[var(--text-secondary)]" data-testid="reference-answer">{answerNote}</p>}
              </div>
            )}
            {(system.tunable_parameters || []).length > 0 && (
              <div className="panel p-4 mt-4" data-testid="reference-parameters">
                <div className="eyebrow mb-2">Parameters</div>
                {system.tunable_parameters.map((param) => (
                  <label key={param.key} className="block mt-2">
                    <span className="text-[12px] font-mono text-[var(--text-secondary)]">{param.label || param.key}</span>
                    <input
                      type="range"
                      min={param.min ?? 0}
                      max={param.max ?? 100}
                      step={param.step ?? 1}
                      defaultValue={param.value}
                      data-testid={`reference-param-${param.key}`}
                      className="w-full accent-[#ff6b00]"
                      onChange={() => { setImpactKey(param.key); setTab("cpp"); }}
                    />
                    {impactKey === param.key && (
                      <div className="text-[10.5px] font-mono text-[var(--unreal-orange)]" data-testid={`reference-impact-${param.key}`}>
                        Highlights {impactLines(system, param.key).map((line) => `${line.file} line ${line.line}`).join(", ")}
                      </div>
                    )}
                  </label>
                ))}
              </div>
            )}
            {templates.length > 0 && (
              <div className="mt-6" data-testid="reference-templates">
                <div className="eyebrow mb-2">Fork a template</div>
                <div className="flex flex-wrap gap-2">
                  {templates.map((tpl) => (
                    <button key={tpl.id} type="button" className="ue-btn !py-1 !px-2 !text-[11px]" data-testid={`reference-fork-${tpl.id}`} disabled={busy} onClick={() => fork("template", tpl.id, tpl.title)}>
                      {tpl.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
