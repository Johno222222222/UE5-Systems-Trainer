import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { readyChallenge } from "../lib/practice.mjs";
import { learnQuestions, pictureOf } from "../lib/learnQuiz.mjs";
import ChoiceButton from "../components/ChoiceButton";
import { useShell } from "./ShellContext";

function GraphThumb({ nodes, wires }) {
  const list = Array.isArray(nodes) ? nodes : [];
  if (!list.length) {
    return <p className="text-[13px] text-[var(--text-secondary)]" data-testid="learn-graph-image">This system has no event graph yet.</p>;
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
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" data-testid="learn-graph-image" role="img" aria-label="Event graph">
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
  const system = draft?.result;
  const [mode, setMode] = useState("picture");
  const [level, setLevel] = useState("beginner");
  const [pane, setPane] = useState("graph");
  const picture = pictureOf(system || {});
  const challenges = learnQuestions(system, level);
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
          <button type="button" className={`chip ${mode === "quiz" ? "active" : ""}`} data-testid="learn-mode-quiz" onClick={() => setMode("quiz")}>Quiz</button>
        </div>
        {mode === "picture" && (
          <div className="mt-4" data-testid="learn-picture">
            <div className="panel p-3">
              {pane === "graph" && <GraphThumb nodes={picture.nodes} wires={picture.wires} />}
              {pane === "cpp" && (
                <pre className="text-[12px] font-mono text-[var(--text-secondary)] overflow-auto" data-testid="learn-cpp">
                  {picture.lines.map((row) => `${String(row.line).padStart(3, " ")}  ${row.text}`).join("\n") || "No C++ yet."}
                </pre>
              )}
              {pane === "dependencies" && (
                <ul data-testid="learn-dependencies">{picture.dependencies.map((item) => <li key={item} className="text-[13px]">{item}</li>)}</ul>
              )}
              {pane === "expansions" && (
                <ul data-testid="learn-expansions">{picture.expansions.map((item) => <li key={item} className="text-[13px]">{item}</li>)}</ul>
              )}
              {pane === "properties" && (
                <ul data-testid="learn-properties">{(picture.properties.length ? picture.properties : ["No UPROPERTY yet."]).map((item) => <li key={item} className="text-[13px]">{item}</li>)}</ul>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                ["graph", "Event graph"],
                ["cpp", "C++"],
                ["dependencies", "Dependencies"],
                ["expansions", "Expansions"],
                ["properties", "Properties"],
              ].map(([id, label]) => (
                <button key={id} type="button" className={`chip ${pane === id ? "active" : ""}`} data-testid={`learn-pane-${id}`} onClick={() => setPane(id)}>{label}</button>
              ))}
            </div>
          </div>
        )}
        {mode === "quiz" && (
          <>
            <div className="mt-3 flex flex-wrap gap-2" data-testid="learn-levels">
              <button type="button" className={`chip ${level === "beginner" ? "active" : ""}`} data-testid="learn-level-beginner" onClick={() => { setLevel("beginner"); setPicked(null); }}>Beginner</button>
              <button type="button" className={`chip ${level === "intermediate" ? "active" : ""}`} data-testid="learn-level-intermediate" onClick={() => { setLevel("intermediate"); setPicked(null); }}>Intermediate</button>
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
