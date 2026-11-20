import React, { useEffect, useState } from "react";
import { api, errorText } from "../lib/api";
import { readyChallenge } from "../lib/practice.mjs";
import { learnQuestions, pictureOf } from "../lib/learnQuiz.mjs";
import { presentQuiz } from "../lib/quizShuffle.js";
import { expansionExamples } from "../lib/lineExplain.js";
import ChoiceButton from "../components/ChoiceButton";
import GlossaryText from "../components/GlossaryText";
import { useShell } from "./ShellContext";

function GraphThumb({ nodes, wires, testId }) {
  const list = Array.isArray(nodes) ? nodes : [];
  if (!list.length) {
    return <p className="text-[13px] text-[var(--text-secondary)]" data-testid={testId || undefined}>This system has no event graph yet.</p>;
  }
  const placed = list.map((node, index) => ({
    id: node.id || `n${index}`,
    label: String(node.label || "Node"),
    x: node.x || 24 + (index % 4) * 180,
    y: node.y || 24 + Math.floor(index / 4) * 96,
  }));
  const minX = Math.min(...placed.map((node) => node.x));
  const minY = Math.min(...placed.map((node) => node.y));
  const maxX = Math.max(...placed.map((node) => node.x + 160));
  const maxY = Math.max(...placed.map((node) => node.y + 56));
  const width = Math.max(640, maxX - minX + 48);
  const height = Math.max(160, maxY - minY + 48);
  const at = (node) => ({ x: node.x - minX + 24, y: node.y - minY + 24 });
  const byId = new Map(placed.map((node) => [node.id, node]));
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" data-testid={testId || undefined} role="img" aria-label="Event graph">
      <rect width={width} height={height} fill="#0c1018" />
      {(wires || []).map((wire, index) => {
        const from = byId.get(wire.from);
        const to = byId.get(wire.to);
        if (!from || !to) return null;
        const a = at(from);
        const b = at(to);
        return <path key={`w${index}`} d={`M ${a.x + 150} ${a.y + 28} C ${a.x + 190} ${a.y + 28}, ${b.x - 30} ${b.y + 28}, ${b.x} ${b.y + 28}`} fill="none" stroke="#ff7a1a" strokeWidth="2" />;
      })}
      {placed.map((node) => {
        const p = at(node);
        return (
          <g key={node.id}>
            <rect x={p.x} y={p.y} width="150" height="52" rx="6" fill="#121826" stroke="#0099ff" />
            <text x={p.x + 75} y={p.y + 30} fill="#e8eef8" fontSize="11" textAnchor="middle">{node.label.slice(0, 22)}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Learn() {
  const shell = useShell();
  const [draft, setDraft] = useState(() => shell.session.get());
  const [picked, setPicked] = useState(null);
  const [note, setNote] = useState("");
  useEffect(() => shell.session.subscribe(setDraft), [shell.session]);
  useEffect(() => {
    api.get("/settings").then((response) => {
      setCanExplain(Object.values(response.data?.keys || {}).some(Boolean));
    }).catch(() => setCanExplain(false));
  }, []);
  const system = draft?.result;
  const [mode, setMode] = useState("picture");
  const [level, setLevel] = useState("beginner");
  const [pane, setPane] = useState("graph");
  const [quizSeed, setQuizSeed] = useState(1);
  const [linePick, setLinePick] = useState(null);
  const [depPick, setDepPick] = useState("");
  const [expPick, setExpPick] = useState("");
  const [more, setMore] = useState("");
  const [canExplain, setCanExplain] = useState(false);
  const picture = pictureOf(system || {});
  const challenges = presentQuiz(learnQuestions(system, level), quizSeed);
  const index = Math.min(shell.learnIndex || 0, Math.max(challenges.length - 1, 0));
  const challenge = readyChallenge(challenges[index], system);

  const answer = async (choice) => {
    if (!challenge) return;
    const correct = choice === challenge.answer;
    setPicked(choice);
    setNote(correct ? "That's the one this system uses." : challenge.why_people_pick || "That choice is tempting, but it is not what this system does.");
    const reveal = challenge.reveal || {};
    shell.setReveal({
      node_ids: reveal.node_ids || [],
      lines: reveal.lines || [],
      why_id: reveal.why_id || "",
    });
    try {
      await api.post("/progress/answer", {
        system_name: system.system_name,
        project_id: draft?.project?.project_id || null,
        challenge_index: index,
        correct,
      });
    } catch { /* progress is best-effort; the answer still shows */ }
  };

  if (!system) {
    return (
      <div className="empty-section" data-testid="learn-empty">
        <div className="empty-section-card">
          <div className="eyebrow">Learn</div>
          <h1 className="font-display text-[32px] font-extrabold uppercase tracking-wider leading-none mt-2">Nothing to practice</h1>
          <p className="mt-3 text-[13px] text-[var(--text-secondary)]">Open a system in Tools, or start from a template. The questions are already on the system.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="ue-btn ue-btn-primary" data-testid="learn-start-new" onClick={() => shell.issue({ type: "new-project" })}>Start new</button>
            <button type="button" className="ue-btn" data-testid="learn-load-saved" onClick={() => shell.focusHome("saved")}>Load saved</button>
            <button type="button" className="ue-btn" data-testid="learn-browse" onClick={() => shell.focusHome("templates")}>Browse</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-screen" data-testid="learn-screen">
      <div className="home-inner">
        <div className="eyebrow">Learn</div>
        <h1 className="font-display text-[36px] font-extrabold uppercase tracking-wider leading-none mt-1">{system.system_name || "This system"}</h1>
        <div className="mt-3 flex flex-wrap gap-2" data-testid="learn-modes">
          <button type="button" className={`chip ${mode === "picture" ? "active" : ""}`} data-testid="learn-mode-picture" onClick={() => setMode("picture")}>Big Picture</button>
          <button type="button" className={`chip ${mode === "quiz" ? "active" : ""}`} data-testid="learn-mode-quiz" onClick={() => { setQuizSeed(Date.now()); setMode("quiz"); setPicked(null); }}>Quiz</button>
        </div>
        {mode === "picture" && (
          <div className="mt-4" data-testid="learn-picture">
            <div className="panel p-3">
              {pane === "graph" && <GraphThumb nodes={picture.nodes} wires={picture.wires} testId="learn-graph-image" />}
              {pane === "graph" && (
                <div className="mt-3" data-testid="learn-why-notes">
                  {(picture.whyNotes || []).map((item) => (
                    <p key={item.id || item.label} className="mt-2 text-[13px] text-[var(--text-secondary)]"><GlossaryText text={item.layman} /></p>
                  ))}
                  {!picture.whyNotes?.length && <p className="text-[13px] text-[var(--text-secondary)]">This system has no event graph yet, so there are no node notes.</p>}
                </div>
              )}
              {pane === "cpp" && (
                <div className="lesson-cpp" data-testid="learn-cpp">
                  <div className="lesson-cpp-code">
                    {picture.lines.map((row) => (
                      <button key={row.line} type="button" className={`lesson-line ${linePick === row.line ? "active" : ""}`} data-testid={`learn-line-${row.line}`} onClick={() => { setLinePick(row.line); setMore(""); }}>
                        <span className="lesson-line-no">{row.line}</span>
                        <span className="lesson-line-text">{row.text}</span>
                      </button>
                    ))}
                    {!picture.lines.length && <p className="text-[13px]">No C++ yet.</p>}
                  </div>
                  <aside className="lesson-cpp-note" data-testid="learn-line-note">
                    {picture.lines.find((row) => row.line === linePick) ? (
                      <>
                        <p className="text-[13px]">{picture.lines.find((row) => row.line === linePick).note}</p>
                        {canExplain && (
                          <button type="button" className="ue-btn mt-3" data-testid="learn-explain-more" onClick={async () => {
                            const row = picture.lines.find((item) => item.line === linePick);
                            try {
                              const { data } = await api.post("/explain-line", { line: row.text, note: row.note });
                              setMore(data.text || "");
                            } catch (err) { setMore(errorText(err)); }
                          }}>Explain more</button>
                        )}
                        {!canExplain && <p className="mt-3 text-[12px] text-[var(--text-muted)]" data-testid="learn-explain-off">Explain more needs an API key in Settings.</p>}
                        {more && <p className="mt-2 text-[13px]" data-testid="learn-explain-text">{more}</p>}
                      </>
                    ) : <p className="text-[13px] text-[var(--text-secondary)]">Click a line.</p>}
                  </aside>
                </div>
              )}
              {pane === "dependencies" && (
                <div data-testid="learn-dependencies">
                  {(picture.dependencyNotes || []).map((item) => (
                    <button key={item.name} type="button" className="block text-left text-[13px] underline decoration-dotted mt-1" data-testid={`learn-dep-${item.name}`} onClick={() => setDepPick(depPick === item.name ? "" : item.name)}>{item.name}</button>
                  ))}
                  {depPick && <p className="mt-2 text-[13px]" data-testid="learn-dep-note">{(picture.dependencyNotes || []).find((item) => item.name === depPick)?.note}</p>}
                </div>
              )}
              {pane === "expansions" && (
                <div data-testid="learn-expansions">
                  {picture.expansions.map((item) => (
                    <button key={item} type="button" className="block text-left text-[13px] mt-2" onClick={() => setExpPick(expPick === item ? "" : item)}>{item}</button>
                  ))}
                  {expPick && (
                    <div className="mt-2" data-testid="learn-expansion-examples">
                      {expansionExamples(expPick).map((example) => (
                        <p key={example.title} className="mt-1 text-[13px]"><strong>{example.title}.</strong> {example.detail}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {pane === "properties" && (
                <ul data-testid="learn-properties">{(picture.properties.length ? picture.properties : ["No UPROPERTY yet."]).map((item) => <li key={item} className="text-[13px]"><GlossaryText text={item} /></li>)}</ul>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2" data-testid="learn-thumbs">
              {[
                ["graph", "Event graph"],
                ["cpp", "C++"],
                ["dependencies", "Dependencies"],
                ["expansions", "Expansions"],
                ["properties", "Properties"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`panel p-2 text-left ${pane === id ? "outline outline-1 outline-[var(--unreal-orange)]" : ""}`}
                  data-testid={`learn-pane-${id}`}
                  onClick={() => setPane(id)}
                >
                  <div className="h-16 overflow-hidden rounded bg-[var(--bg-main)] pointer-events-none">
                    {id === "graph" && <GraphThumb nodes={picture.nodes} wires={picture.wires} />}
                    {id === "cpp" && (
                      <pre className="text-[9px] leading-tight font-mono text-[var(--text-secondary)] p-1 whitespace-pre">
                        {picture.lines.slice(0, 5).map((row) => `${row.line} ${row.text}`).join("\n") || "No C++ yet."}
                      </pre>
                    )}
                    {id !== "graph" && id !== "cpp" && (
                      <div className="p-1 text-[9px] leading-tight text-[var(--text-secondary)]">
                        {(id === "dependencies" ? picture.dependencies : id === "expansions" ? picture.expansions : (picture.properties.length ? picture.properties : ["No UPROPERTY yet."])).slice(0, 3).map((item) => (
                          <div key={item}>{item}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-[var(--text-secondary)]">{label}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        {mode === "quiz" && (
          <>
            <div className="mt-3 flex flex-wrap gap-2" data-testid="learn-levels">
              <button type="button" className={`chip ${level === "beginner" ? "active" : ""}`} data-testid="learn-level-beginner" onClick={() => { setLevel("beginner"); setQuizSeed(Date.now()); setPicked(null); }}>Beginner</button>
              <button type="button" className={`chip ${level === "intermediate" ? "active" : ""}`} data-testid="learn-level-intermediate" onClick={() => { setLevel("intermediate"); setQuizSeed(Date.now()); setPicked(null); }}>Intermediate</button>
            </div>
            <p className="mt-2 text-[13px] text-[var(--text-secondary)]">Question {challenges.length ? index + 1 : 0} of {challenges.length}. Answering these does not call the model.</p>
          </>
        )}
        {mode === "quiz" && !challenge && (
          <div className="mt-6" data-testid="learn-no-challenges">
            <p className="text-[13px] font-mono text-[var(--text-muted)]">This system has no practice questions yet.</p>
            <button type="button" className="ue-btn mt-3" data-testid="learn-open-courses" onClick={() => shell.go("courses")}>Open courses</button>
          </div>
        )}
        {mode === "quiz" && challenge && (
          <div className="panel p-4 mt-6" data-testid="learn-challenge">
            <div className="font-sub font-semibold text-[16px]">{challenge.prompt || challenge.title}</div>
            <div className="mt-3 flex flex-col gap-2">
              {(challenge.choices || []).map((choice, choiceIndex) => (
                <ChoiceButton
                  key={`${index}-${choiceIndex}`}
                  id={choiceIndex}
                  label={choice}
                  picked={picked}
                  correct={challenge.answer}
                  revealed={picked !== null}
                  onPick={answer}
                  testId={`learn-choice-${choiceIndex}`}
                />
              ))}
            </div>
            {picked !== null && (
              <div className="mt-4 text-[13px] text-[var(--text-secondary)]" data-testid="learn-result">
                <div>{note}</div>
                {challenge.related?.kind === "parameter" && (
                  <div className="mt-2 font-mono text-[12px]" data-testid="learn-related">Related slider: {challenge.related.label || challenge.related.key}</div>
                )}
                {challenge.related?.kind === "module" && (
                  <div className="mt-2 font-mono text-[12px]" data-testid="learn-related">Related module: {challenge.related.name}</div>
                )}
                {index < challenges.length - 1 && (
                  <button type="button" className="ue-btn ue-btn-primary mt-3" data-testid="learn-next" onClick={() => { setPicked(null); setNote(""); shell.setLearnIndex(index + 1); }}>
                    Next question
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        <button type="button" className="ue-btn mt-6" data-testid="learn-back-to-tools" onClick={() => shell.go("tools")}>Back to Tools</button>
      </div>
    </div>
  );
}
