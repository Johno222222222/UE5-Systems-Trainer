import React, { useEffect, useState } from "react";
import GlossaryText from "../components/GlossaryText";
import ChoiceButton from "../components/ChoiceButton";
import { presentQuiz } from "../lib/quizShuffle.js";
import { api, errorText } from "../lib/api";

function Figure({ svg, testId }) {
  if (!svg) return null;
  return <img className="w-full" alt="" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} data-testid={testId} />;
}

function CppLines({ notes, blanks, revealed }) {
  const hidden = new Set((blanks || []).map((row) => row.line));
  const [picked, setPicked] = useState(null);
  const [more, setMore] = useState("");
  const [moreError, setMoreError] = useState("");
  const [canExplain, setCanExplain] = useState(false);
  useEffect(() => {
    api.get("/settings").then((response) => {
      const keys = response.data?.keys || {};
      setCanExplain(Object.values(keys).some(Boolean));
    }).catch(() => setCanExplain(false));
  }, []);
  const rows = notes || [];
  const active = rows.find((row) => row.line === picked) || null;
  const copy = () => {
    const text = rows.map((row) => {
      const body = !revealed && hidden.has(row.line) ? "________" : row.text;
      return `${String(row.line).padStart(3, " ")}  ${body}`;
    }).join("\n");
    navigator.clipboard?.writeText(text).catch(() => {});
  };
  const explainMore = async () => {
    if (!active) return;
    setMoreError("");
    try {
      const { data } = await api.post("/explain-line", { line: active.text, note: active.note });
      setMore(data.text || "");
    } catch (err) {
      setMoreError(errorText(err));
    }
  };
  return (
    <div className="lesson-cpp" data-testid="lesson-cpp">
      <div className="lesson-cpp-code" data-testid="track-cpp">
        <button type="button" className="ue-btn !py-1 !px-2 !text-[11px]" data-testid="lesson-cpp-copy" onClick={copy}>Copy</button>
        <div className="mt-2">
          {rows.map((row) => {
            const body = !revealed && hidden.has(row.line) ? "________" : row.text;
            return (
              <button
                key={row.line}
                type="button"
                className={`lesson-line ${picked === row.line ? "active" : ""}`}
                data-testid={`lesson-line-${row.line}`}
                onClick={() => { setPicked(row.line); setMore(""); setMoreError(""); }}
              >
                <span className="lesson-line-no">{row.line}</span>
                <span className="lesson-line-text">{body}</span>
              </button>
            );
          })}
        </div>
      </div>
      <aside className="lesson-cpp-note" data-testid="lesson-line-note">
        {active ? (
          <>
            <div className="eyebrow">Line {active.line}</div>
            <p className="mt-2 text-[13px]">{active.note}</p>
            {canExplain && (
              <button type="button" className="ue-btn mt-3" data-testid="explain-more" onClick={explainMore}>Explain more</button>
            )}
            {!canExplain && <p className="mt-3 text-[12px] text-[var(--text-muted)]" data-testid="explain-more-off">Explain more needs an API key in Settings.</p>}
            {more && <p className="mt-2 text-[13px]" data-testid="explain-more-text">{more}</p>}
            {moreError && <p className="mt-2 text-[12px] text-[var(--accent-red)]">{moreError}</p>}
          </>
        ) : (
          <p className="text-[13px] text-[var(--text-secondary)]">Click a line. The note on the right says what that line does, in plain words.</p>
        )}
      </aside>
    </div>
  );
}

function TaskList({ tasks, blanks }) {
  const [revealed, setRevealed] = useState({});
  const [checked, setChecked] = useState({});
  return (
    <div className="mt-4" data-testid="lesson-tasks">
      {(tasks || []).map((task) => (
        <div key={task.id} className="mt-3 panel p-3" data-testid={`lesson-task-${task.kind}`}>
          <div className="text-[13px]"><GlossaryText text={task.prompt} /></div>
          {task.kind === "cpp-blank" && (
            <pre className="mt-2 text-[12px] font-mono overflow-auto" data-testid="cpp-blanks">
              {(blanks?.cpp || []).map((row) => `${row.line}: ${revealed[task.id] ? row.text : "________"}`).join("\n")}
            </pre>
          )}
          {task.kind === "graph-blank" && (
            <ul className="mt-2 text-[13px]" data-testid="graph-blanks">
              {(blanks?.nodes || []).map((node) => (
                <li key={node.key || node.label}>{revealed[task.id] ? node.label : "Blank node"}</li>
              ))}
            </ul>
          )}
          <label className="mt-2 flex items-center gap-2 text-[12px]">
            <input type="checkbox" checked={!!checked[task.id]} onChange={(event) => setChecked((current) => ({ ...current, [task.id]: event.target.checked }))} />
            I checked this myself
          </label>
          <button type="button" className="ue-btn mt-2" data-testid={`reveal-${task.kind}`} onClick={() => setRevealed((current) => ({ ...current, [task.id]: !current[task.id] }))}>
            {revealed[task.id] ? "Hide answers" : "Reveal answers"}
          </button>
          {revealed[task.id] && task.model && <p className="mt-2 text-[13px] text-[var(--text-secondary)]" data-testid={`model-${task.kind}`}>{task.model}</p>}
        </div>
      ))}
    </div>
  );
}

export default function LessonStudio({
  eyebrow,
  title,
  summary,
  map,
  sections,
  sectionIndex,
  onSection,
  examQuestions,
  examMode,
  onExam,
  onClose,
  onScore,
  result,
  nextLabel,
  onNext,
}) {
  const section = sections[sectionIndex];
  const [phase, setPhase] = useState("lesson");
  const [seed, setSeed] = useState(1);
  const [picked, setPicked] = useState({});
  const [headerOpen, setHeaderOpen] = useState("");
  const source = examMode ? (examQuestions || []) : (section?.quiz || []);
  const shown = presentQuiz(source, seed);

  useEffect(() => {
    setPhase("lesson");
    setPicked({});
  }, [sectionIndex, examMode]);

  const openQuiz = () => {
    setSeed(Date.now());
    setPicked({});
    setPhase("quiz");
  };

  const reading = section?.reading || [];
  const notes = section?.lineNotes?.length ? section.lineNotes : (section?.cpp || []).map((row) => ({ ...row, note: "" }));

  return (
    <div className="home-screen" data-testid="track-screen">
      <div className="home-inner">
        <button type="button" className="why-concept !mt-0" onClick={onClose}>All {eyebrow || "lessons"}</button>
        <div className="eyebrow mt-3">{summary}</div>
        <h1 className="font-display text-[32px] font-extrabold uppercase tracking-wider leading-none mt-1">{title}</h1>
        <Figure svg={map} testId="track-map" />
        <div className="mt-3 flex flex-wrap gap-2">
          {sections.map((item, index) => (
            <button key={item.id} type="button" className={`chip ${!examMode && index === sectionIndex ? "active" : ""}`} data-testid={`track-section-${item.id}`} onClick={() => onSection(index)}>{item.order || index + 1}. {item.title}</button>
          ))}
          {!!examQuestions?.length && (
            <button type="button" className={`chip ${examMode ? "active" : ""}`} data-testid="track-exam" onClick={onExam}>Final exam</button>
          )}
        </div>

        {!examMode && phase === "lesson" && section && (
          <div className="panel p-4 mt-4" data-testid="track-lesson">
            <Figure svg={section.image} testId="track-lesson-image" />
            <Figure svg={section.flow} testId="track-lesson-flow" />
            {section.whyLayman && <p className="mt-3 text-[13px]" data-testid="track-why-layman"><GlossaryText text={section.whyLayman} /></p>}
            {(section.nodeNotes || []).length > 0 && (
              <div className="mt-3" data-testid="track-node-notes">
                {section.nodeNotes.map((node) => (
                  <p key={node.key || node.label} className="mt-2 text-[13px] text-[var(--text-secondary)]"><GlossaryText text={node.layman} /></p>
                ))}
              </div>
            )}
            {reading.map((line, index) => {
              const heading = typeof line === "string" ? "" : line.heading;
              const body = typeof line === "string" ? line : line.body;
              return (
                <div key={`${section.id}-${index}`} className="mt-3">
                  {heading && <h2 className="text-[14px] font-semibold">{heading}</h2>}
                  <p className="mt-1 text-[13px] text-[var(--text-secondary)]"><GlossaryText text={body} /></p>
                </div>
              );
            })}
            {(section.headerNotes || []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2" data-testid="lesson-headers">
                {section.headerNotes.map((item) => (
                  <button key={item.header} type="button" className="chip" data-testid={`header-${item.header}`} onClick={() => setHeaderOpen(headerOpen === item.header ? "" : item.header)}>
                    {item.header}
                  </button>
                ))}
              </div>
            )}
            {headerOpen && <p className="mt-2 text-[13px]" data-testid="header-note">{(section.headerNotes || []).find((item) => item.header === headerOpen)?.note}</p>}
            {(section.expansionExamples || []).length > 0 && (
              <div className="mt-3" data-testid="lesson-expansion-examples">
                <div className="eyebrow">If you extend this</div>
                {section.expansionExamples.map((item) => (
                  <p key={item.title} className="mt-1 text-[13px]"><strong>{item.title}.</strong> {item.detail}</p>
                ))}
              </div>
            )}
            <CppLines notes={notes} blanks={[]} revealed />
            <TaskList tasks={section.tasks} blanks={section.blanks} />
            <button type="button" className="ue-btn ue-btn-primary mt-4" data-testid="next-quiz" onClick={openQuiz}>NEXT: QUIZ</button>
          </div>
        )}

        {(examMode || phase === "quiz") && (
          <div className="panel p-4 mt-4" data-testid="track-questions">
            <div className="eyebrow mb-2">{examMode ? "Final exam" : `${section?.title || ""} quiz`}</div>
            {shown.map((question) => (
              <div key={question.id} className="mt-3 choice-card">
                <div className="text-[13px]" data-testid={`track-q-${question.id}`}><GlossaryText text={question.prompt} /></div>
                {question.figure && <Figure svg={question.figure} testId={`track-figure-${question.id}`} />}
                {question.sample && <pre className="mt-2 text-[12px] font-mono overflow-auto" data-testid={`track-sample-${question.id}`}>{question.sample}</pre>}
                <div className="mt-2 flex flex-col gap-2">
                  {question.choices.map((choice, choiceIndex) => (
                    <ChoiceButton
                      key={`${question.id}-${choiceIndex}`}
                      id={choiceIndex}
                      label={choice}
                      picked={picked[question.id] ?? null}
                      correct={result ? question.answer : null}
                      revealed={!!result}
                      onPick={(choiceId) => setPicked((current) => ({ ...current, [question.id]: choiceId }))}
                      testId={`track-choice-${question.id}-${choiceIndex}`}
                    />
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              className="ue-btn ue-btn-primary mt-3"
              data-testid="track-submit"
              onClick={() => onScore(Object.fromEntries(shown.map((question) => [question.id, question.choices[picked[question.id]]])))}
            >
            Score
            </button>
            {result && <p className="mt-2 text-[13px]" data-testid="track-score">{result.percent}% · {result.passed ? "Passed" : "Not yet"}</p>}
            {!examMode && nextLabel && (
              <button type="button" className="ue-btn mt-3" data-testid="next-lesson" onClick={onNext}>NEXT: {nextLabel}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
