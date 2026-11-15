import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errorText } from "../lib/api";
import { keyDecisions, resolveConcept } from "../lib/references.mjs";
import WhyNote from "../components/WhyNote";
import NodeGraph from "../components/NodeGraph";
import { useShell } from "./ShellContext";

function Tags({ complexity, prerequisites }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {complexity && <span className={`tag tag-${complexity}`}>{complexity}</span>}
      {(prerequisites || []).map((item) => (
        <span key={item} className="tag">{item}</span>
      ))}
    </div>
  );
}

function ConceptStudy({ card, examples, onExample }) {
  const [choice, setChoice] = useState(null);
  if (!card) return null;
  const task = card.challenge || {};
  const answered = choice !== null;
  return (
    <div data-testid={`concept-card-${card.id}`}>
      <div className="eyebrow">Concept</div>
      <h1 className="font-display text-[36px] font-extrabold uppercase tracking-wider leading-none mt-1">{card.title}</h1>
      <p className="mt-3 text-[13px] text-[var(--text-secondary)] leading-relaxed max-w-2xl">{card.explanation}</p>
      {(card.learn_more || []).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3" data-testid={`concept-docs-${card.id}`}>
          <span className="text-[10.5px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Learn more</span>
          {card.learn_more.map((link) => (
            <a key={link.url} className="why-concept !mt-0" href={link.url} target="_blank" rel="noreferrer">{link.title}</a>
          ))}
        </div>
      )}
      <div className="panel p-4 mt-5" data-testid={`concept-challenge-${card.id}`}>
        <div className="eyebrow mb-2">Try this</div>
        <div className="font-sub font-semibold text-[15px]">{task.prompt}</div>
        <div className="mt-3 flex flex-col gap-2">
          {(task.choices || []).map((label, index) => (
            <button
              key={label}
              type="button"
              className="ue-btn justify-start whitespace-normal text-left"
              data-testid={`concept-choice-${card.id}-${index}`}
              onClick={() => setChoice(index)}
            >
              {label}
            </button>
          ))}
        </div>
        {answered && (
          <p className="mt-3 text-[13px] text-[var(--text-secondary)]" data-testid={`concept-result-${card.id}`}>
            {choice === task.answer ? "That's the one." : task.why}
          </p>
        )}
        <p className="mt-2 text-[10.5px] font-mono text-[var(--text-muted)]">Answering stays on this computer. It does not call the model.</p>
      </div>
      <div className="mt-5">
        <div className="eyebrow mb-2">Used in</div>
        <div className="flex flex-wrap gap-2">
          {(card.example_ids || []).map((id) => {
            const example = examples.find((item) => item.id === id);
            if (!example) return null;
            return (
              <button
                key={id}
                type="button"
                className="ue-btn"
                data-testid={`concept-example-${card.id}-${id}`}
                onClick={() => onExample(id)}
              >
                {example.title}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function References() {
  const shell = useShell();
  const [library, setLibrary] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [projects, setProjects] = useState([]);
  const [mode, setMode] = useState("bundled");
  const [saved, setSaved] = useState(null);
  const [forking, setForking] = useState(false);
  const [draft, setDraft] = useState(() => shell.session.get());
  const [localConcept, setLocalConcept] = useState("");

  useEffect(() => shell.session.subscribe(setDraft), [shell.session]);

  useEffect(() => {
    let alive = true;
    api.get("/references")
      .then((r) => { if (alive) setLibrary(r.data); })
      .catch(() => { if (alive) setLoadError("Couldn't load the library."); });
    api.get("/projects")
      .then((r) => { if (alive) setProjects(r.data?.mine || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => { setMode("bundled"); }, [shell.exampleId, shell.exampleTick]);
  useEffect(() => {
    if (shell.conceptId) setLocalConcept(shell.conceptId);
  }, [shell.conceptId]);

  const examples = library?.examples || [];
  const concepts = library?.concepts || [];
  const selected = examples.find((item) => item.id === shell.exampleId) || examples[0] || null;
  const onScreen = draft?.result || null;
  const system = mode === "screen" ? onScreen : mode === "project" ? saved?.system : selected?.starter;
  const bundled = mode === "bundled" ? selected : null;
  const decisions = keyDecisions(system);
  const notes = system?.learning?.why_notes || [];
  const card = resolveConcept(concepts, localConcept || shell.conceptId) || concepts[0] || null;
  const complexity = bundled?.complexity || system?.learning?.complexity;
  const prerequisites = bundled?.prerequisites || system?.learning?.prerequisites || [];
  const learnMore = bundled?.learn_more || [];

  const nodeLabel = (id) => system?.node_graph_nodes?.find((node) => node.id === id)?.label || id;

  const fork = async (id) => {
    setForking(true);
    try {
      await api.post(`/examples/${id}/fork`);
      toast.success("Copied into your projects", { description: "The original example is unchanged." });
      shell.focusHome("saved");
    } catch (err) {
      toast.error("Couldn't copy that example", { description: errorText(err) });
    } finally {
      setForking(false);
    }
  };

  const openSaved = async (id) => {
    setMode("project");
    try {
      const { data } = await api.get(`/projects/${id}`);
      setSaved(data);
    } catch (err) {
      toast.error("Couldn't open that project", { description: errorText(err) });
    }
  };

  return (
    <div className="home-screen" data-testid="references-screen">
      <div className="home-inner">
        <div className="eyebrow">References</div>
        <h1 className="font-display text-[40px] font-extrabold uppercase tracking-wider leading-none mt-1">References</h1>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)] max-w-xl">
          Every WHY note stays open. Fork a copy if you want to edit. The original example does not change.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={`chip ${shell.referencesView === "system" ? "active" : ""}`} data-testid="references-tab-system" onClick={() => shell.setReferencesView("system")}>This system</button>
          <button type="button" className={`chip ${shell.referencesView === "concepts" ? "active" : ""}`} data-testid="references-tab-concepts" onClick={() => shell.setReferencesView("concepts")}>Concepts</button>
        </div>
        {loadError && <p className="mt-4 text-[12px] font-mono text-[var(--accent-red)]">{loadError}</p>}

        {shell.referencesView === "concepts" && (
          <div className="ref-layout mt-6">
            <div className="flex flex-col gap-1" data-testid="concept-list">
              {concepts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`open-in-item ${card?.id === item.id ? "!text-[var(--unreal-orange)]" : ""}`}
                  data-testid={`concept-link-${item.id}`}
                  onClick={() => setLocalConcept(item.id)}
                >
                  {item.title}
                </button>
              ))}
            </div>
            <ConceptStudy
              key={card?.id || "none"}
              card={card}
              examples={examples}
              onExample={(id) => shell.openExample(id)}
            />
          </div>
        )}

        {shell.referencesView === "system" && (
          <div className="ref-layout mt-6">
            <div>
              <div className="eyebrow mb-2">Examples</div>
              <div className="flex flex-col gap-1">
                {examples.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`open-in-item ${mode === "bundled" && selected?.id === item.id ? "!text-[var(--unreal-orange)]" : ""}`}
                    data-testid={`reference-example-${item.id}`}
                    onClick={() => shell.openExample(item.id)}
                  >
                    {item.kind === "example" ? "Start here · " : ""}{item.title}
                  </button>
                ))}
              </div>
              <div className="eyebrow mt-4 mb-2">Your systems</div>
              <button
                type="button"
                className={`open-in-item ${mode === "screen" ? "!text-[var(--unreal-orange)]" : ""}`}
                data-testid="reference-on-screen"
                onClick={() => setMode("screen")}
              >
                {onScreen ? `On screen · ${onScreen.system_name}` : "Nothing open in Tools"}
              </button>
              {projects.map((project) => (
                <button
                  key={project.project_id}
                  type="button"
                  className={`open-in-item ${mode === "project" && saved?.project_id === project.project_id ? "!text-[var(--unreal-orange)]" : ""}`}
                  data-testid={`reference-project-${project.project_id}`}
                  onClick={() => openSaved(project.project_id)}
                >
                  {project.name}
                </button>
              ))}
            </div>

            <div>
              {!system && (
                <p className="text-[13px] text-[var(--text-secondary)]" data-testid="references-empty">
                  Open a system in Tools, or pick an example on the left.
                </p>
              )}
              {system && (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="font-display text-[32px] font-extrabold uppercase tracking-wider leading-none">{bundled?.title || saved?.name || system.system_name}</h2>
                      <p className="mt-2 text-[13px] text-[var(--text-secondary)] max-w-2xl">{system.summary}</p>
                      <div className="mt-3"><Tags complexity={complexity} prerequisites={prerequisites} /></div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {bundled && (
                        <button type="button" className="ue-btn ue-btn-primary" disabled={forking} data-testid={`fork-example-${bundled.id}`} onClick={() => fork(bundled.id)}>
                          Fork
                        </button>
                      )}
                      {bundled && (
                        <button
                          type="button"
                          className="ue-btn"
                          data-testid={`open-example-tools-${bundled.id}`}
                          onClick={() => shell.issue({
                            type: "template",
                            template: {
                              id: bundled.id,
                              title: bundled.title,
                              prompt: bundled.prompt,
                              default_class: bundled.default_class,
                              starter: bundled.starter,
                            },
                          })}
                        >
                          Open in Tools
                        </button>
                      )}
                      {mode === "project" && saved?.project_id && (
                        <button type="button" className="ue-btn" data-testid="reference-edit-project" onClick={() => shell.issue({ type: "open-project", id: saved.project_id })}>
                          Edit in Tools
                        </button>
                      )}
                      {mode === "screen" && onScreen && (
                        <button type="button" className="ue-btn" onClick={() => shell.go("tools")}>Back to Tools</button>
                      )}
                    </div>
                  </div>
                  {learnMore.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-3" data-testid="inspired-by">
                      <span className="text-[10.5px] font-mono uppercase tracking-widest text-[var(--text-muted)]">Inspired by / learn more</span>
                      {learnMore.map((link) => (
                        <a key={link.url} className="why-concept !mt-0" href={link.url} target="_blank" rel="noreferrer">{link.title}</a>
                      ))}
                    </div>
                  )}
                  {(system.node_graph_nodes || []).length > 0 && (
                    <div className="panel overflow-hidden mt-4 ref-graph" data-testid="references-graph">
                      <NodeGraph
                        nodes={system.node_graph_nodes || []}
                        edges={system.node_graph_edges || []}
                        whyByNode={Object.fromEntries((system.node_graph_nodes || []).map((node) => {
                          const note = notes.find((item) => item.anchor?.kind === "node" && item.anchor.node_id === node.id);
                          return [node.id, note];
                        }).filter(([, note]) => note))}
                      />
                    </div>
                  )}
                  <div className="mt-5" data-testid="key-decisions">
                    <div className="eyebrow mb-2">Key decisions</div>
                    {decisions.length === 0 && (
                      <p className="text-[13px] text-[var(--text-muted)]">This system has no WHY notes yet. Older projects still open. Notes appear after a learning pass, or on a bundled example.</p>
                    )}
                    <ol className="space-y-2">
                      {decisions.map((item, index) => (
                        <li key={item.id || index} className="panel p-3" data-testid={`key-decision-${item.id || index}`}>
                          <div className="text-[13px] text-[var(--text-primary)]">{item.decision}</div>
                          {item.tradeoff && <div className="mt-1 text-[12px] text-[var(--text-secondary)]">{item.tradeoff}</div>}
                          {item.concept_id && (
                            <button type="button" className="why-concept" onClick={() => shell.openConcept(item.concept_id)}>
                              {item.concept_title || "Related concept"}
                            </button>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="mt-5" data-testid="references-why-notes">
                    <div className="eyebrow mb-2">WHY notes</div>
                    {notes.map((note) => (
                      <div key={note.id} className="mb-2">
                        <div className="text-[10.5px] font-mono text-[var(--text-muted)] mb-1">
                          {note.anchor?.kind === "node"
                            ? `Graph · ${nodeLabel(note.anchor.node_id)}`
                            : `${note.anchor?.file || ""} line ${note.anchor?.line || ""}`}
                        </div>
                        <WhyNote note={note} level="learning" forceOpen />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
