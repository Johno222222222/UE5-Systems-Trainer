import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { challengesOf, readyChallenge } from "../lib/practice.mjs";
import ChoiceButton from "../components/ChoiceButton";
import { useShell } from "./ShellContext";

export default function Learn() {
  const shell = useShell();
  const [draft, setDraft] = useState(() => shell.session.get());
  const [picked, setPicked] = useState(null);
  const [note, setNote] = useState("");
  useEffect(() => shell.session.subscribe(setDraft), [shell.session]);
  const system = draft?.result;
  const challenges = challengesOf(system);
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
        <p className="mt-2 text-[13px] text-[var(--text-secondary)]">Question {challenges.length ? index + 1 : 0} of {challenges.length}. Answering these does not call the model.</p>
        {!challenge && <p className="mt-6 text-[13px] font-mono text-[var(--text-muted)]" data-testid="learn-no-challenges">This system has no practice questions yet.</p>}
        {challenge && (
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
