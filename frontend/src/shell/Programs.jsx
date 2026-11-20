import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errorText } from "../lib/api";
import ChoiceButton from "../components/ChoiceButton";
import GlossaryText, { GlossaryTags } from "../components/GlossaryText";
import { useShell } from "./ShellContext";
import { loadWorkspace } from "../lib/practice.mjs";
import { refactorCheck } from "../lib/graph.mjs";

const VIEWS = [
  ["steps", "Steps"],
  ["modify", "Modify"],
  ["compare", "Compare"],
  ["map", "Map"],
  ["finish", "Finish"],
];

function Field({ field, value, onChange }) {
  if (field.kind === "bool") {
    return (
      <label className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
        <input type="checkbox" checked={!!value} onChange={(event) => onChange(event.target.checked)} />
        {field.label}
      </label>
    );
  }
  if (field.kind === "choice") {
    return (
      <div>
        <div className="eyebrow mb-1">{field.label}</div>
        <div className="flex flex-wrap gap-2">
          {(field.options || []).map((option) => (
            <button
              key={option.value}
              type="button"
              className={`chip ${value === option.value ? "active" : ""}`}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <label className="block text-[13px] text-[var(--text-secondary)]">
      <span className="eyebrow">{field.label}</span>
      <input
        className="mt-1 w-full bg-[var(--bg-main)] border border-[var(--border)] rounded px-2 py-1 text-[var(--text-primary)]"
        type="number"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? "" : Number(event.target.value))}
      />
      {field.unit ? <span className="ml-2 font-mono text-[11px]">{field.unit}</span> : null}
    </label>
  );
}

export default function Programs() {
  const shell = useShell();
  const [cards, setCards] = useState([]);
  const [openId, setOpenId] = useState("");
  const [program, setProgram] = useState(null);
  const [state, setState] = useState(null);
  const [view, setView] = useState("steps");
  const [moduleIndex, setModuleIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [taskText, setTaskText] = useState("");
  const [taskNote, setTaskNote] = useState("");
  const [modifyId, setModifyId] = useState("");
  const [settings, setSettings] = useState({});
  const [modifyNote, setModifyNote] = useState(null);
  const [mapId, setMapId] = useState("interaction");
  const [error, setError] = useState("");
  const [packProblems, setPackProblems] = useState([]);
  const [courses, setCourses] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [genre, setGenre] = useState("fps");
  const [trackLevel, setTrackLevel] = useState("beginner");
  const [track, setTrack] = useState(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [trackAnswers, setTrackAnswers] = useState({});
  const [assignmentText, setAssignmentText] = useState("");
  const [trackResult, setTrackResult] = useState(null);
  const [examMode, setExamMode] = useState(false);

  const refreshCards = () => api.get("/study").then((r) => {
    setCards(r.data?.programs || []);
    setCourses(r.data?.courses || []);
    setPackProblems(r.data?.problems || []);
  }).catch((err) => setError(errorText(err)));

  useEffect(() => {
    refreshCards();
    api.get("/tracks").then((response) => setTracks(response.data?.tracks || [])).catch(() => {});
  }, []);

  const openTrack = (id) => {
    api.get(`/tracks/${id}`).then((response) => {
      setTrack(response.data.track);
      setSectionIndex(0);
      setTrackAnswers({});
      setAssignmentText("");
      setTrackResult(null);
      setExamMode(false);
    }).catch((err) => toast.error(errorText(err)));
  };

  const submitSection = async () => {
    const section = track?.sections?.[sectionIndex];
    if (!track || !section) return;
    try {
      const { data } = await api.post(`/tracks/${track.id}/sections/${section.id}/attempt`, {
        answers: trackAnswers,
        assignment: assignmentText,
      });
      setTrackResult(data);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const submitExam = async () => {
    if (!track) return;
    try {
      const { data } = await api.post(`/tracks/${track.id}/exam`, { answers: trackAnswers });
      setTrackResult(data);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const openProgram = (id) => {
    setOpenId(id);
    setView("steps");
    setModuleIndex(0);
    setStepIndex(0);
    setPicked(null);
    setTaskNote("");
    api.get(`/programs/${id}`)
      .then((r) => {
        setProgram(r.data.program);
        setState(r.data.state);
        const first = r.data.program?.modify_tasks?.[0]?.id || "";
        setModifyId(first);
        setMapId(r.data.program?.map?.nodes?.find((node) => node.id === "interaction")?.id || r.data.program?.map?.nodes?.[0]?.id || "");
      })
      .catch((err) => setError(errorText(err)));
  };

  const mod = program?.modules?.[moduleIndex];
  const step = mod?.steps?.[stepIndex];
  const modify = (program?.modify_tasks || []).find((item) => item.id === modifyId) || program?.modify_tasks?.[0];
  const mapNode = (program?.map?.nodes || []).find((node) => node.id === mapId);

  const submitStep = async () => {
    if (!step) return;
    try {
      let graphOk = false;
      if (step.graph_check) {
        const saved = loadWorkspace(window.localStorage);
        const checked = refactorCheck(saved?.draft?.result);
        graphOk = checked.pass;
        if (!checked.pass) {
          setTaskNote(checked.detail);
          return;
        }
      }
      const { data } = await api.post(`/programs/${program.id}/step`, { step_id: step.id, answer: taskText, graph_ok: graphOk });
      setTaskNote(data.detail);
      setState((current) => ({ ...(current || {}), steps_done: data.steps_done }));
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const checkModify = async () => {
    if (!modify) return;
    try {
      const { data } = await api.post(`/programs/${program.id}/tasks/${modify.id}/check`, { settings });
      setModifyNote(data);
      setState((current) => ({ ...(current || {}), tasks_passed: data.tasks_passed }));
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const finish = async () => {
    try {
      const { data } = await api.post(`/programs/${program.id}/complete`);
      toast.success("Starter project loaded", { description: "The program is marked complete on Home." });
      shell.issue({ type: "open-project", id: data.project_id });
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  if (track) {
    const section = track.sections[sectionIndex];
    const questions = examMode ? track.exam.questions : section.quiz;
    return (
      <div className="home-screen" data-testid="track-screen">
        <div className="home-inner">
          <button type="button" className="why-concept !mt-0" onClick={() => { setTrack(null); setTrackResult(null); }}>All programs</button>
          <div className="eyebrow mt-3">{track.genre} · {track.level}</div>
          <h1 className="font-display text-[32px] font-extrabold uppercase tracking-wider leading-none mt-1">{track.title}</h1>
          <img className="mt-4 w-full" alt="" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(track.map)}`} data-testid="track-map" />
          <div className="mt-3 flex flex-wrap gap-2">
            {track.sections.map((item, index) => (
              <button key={item.id} type="button" className={`chip ${!examMode && index === sectionIndex ? "active" : ""}`} data-testid={`track-section-${item.id}`} onClick={() => { setExamMode(false); setSectionIndex(index); setTrackAnswers({}); setTrackResult(null); setAssignmentText(""); }}>{item.order}. {item.title}</button>
            ))}
            <button type="button" className={`chip ${examMode ? "active" : ""}`} data-testid="track-exam" onClick={() => { setExamMode(true); setTrackAnswers({}); setTrackResult(null); }}>Final exam</button>
          </div>
          {!examMode && section && (
            <div className="panel p-4 mt-4" data-testid="track-lesson">
              <img className="w-full" alt="" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(section.image)}`} data-testid="track-lesson-image" />
              {section.flow && <img className="w-full mt-3" alt="" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(section.flow)}`} data-testid="track-lesson-flow" />}
              {section.reading.map((line, index) => {
                const heading = typeof line === "string" ? "" : line.heading;
                const body = typeof line === "string" ? line : line.body;
                return (
                  <div key={`${section.id}-${index}`} className="mt-3">
                    {heading && <h2 className="text-[14px] font-semibold">{heading}</h2>}
                    <p className="mt-1 text-[13px] text-[var(--text-secondary)]"><GlossaryText text={body} /></p>
                  </div>
                );
              })}
              {section.cpp?.length > 0 && (
                <pre className="mt-3 text-[12px] font-mono text-[var(--text-secondary)] overflow-auto" data-testid="track-cpp">
                  {section.cpp.map((row) => `${String(row.line).padStart(3, " ")}  ${row.text}`).join("\n")}
                </pre>
              )}
              <label className="block mt-3">
                <span className="eyebrow">Assignment</span>
                <div className="mt-1 text-[13px]"><GlossaryText text={section.assignment.prompt} /></div>
                <input className="mt-2 w-full bg-[var(--bg-main)] border border-[var(--border)] rounded px-2 py-1" data-testid="track-assignment" value={assignmentText} onChange={(event) => setAssignmentText(event.target.value)} />
              </label>
              {trackResult?.model && <p className="mt-2 text-[13px] text-[var(--text-secondary)]" data-testid="track-model">{trackResult.model}</p>}
            </div>
          )}
          <div className="panel p-4 mt-4" data-testid="track-questions">
            {(questions || []).map((question) => (
              <div key={question.id} className="mt-3">
                <div className="text-[13px]" data-testid={`track-q-${question.id}`}><GlossaryText text={question.prompt} /></div>
                {question.figure && <img className="mt-2 w-full" alt="" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(question.figure)}`} data-testid={`track-figure-${question.id}`} />}
                {question.sample && <pre className="mt-2 text-[12px] font-mono text-[var(--text-secondary)] overflow-auto" data-testid={`track-sample-${question.id}`}>{question.sample}</pre>}
                <div className="mt-2 flex flex-col gap-2">
                  {question.choices.map((choice, choiceIndex) => (
                    <ChoiceButton
                      key={`${question.id}-${choiceIndex}`}
                      id={choiceIndex}
                      label={choice}
                      picked={trackAnswers[question.id] ?? null}
                      correct={trackResult ? question.answer : null}
                      revealed={!!trackResult}
                      onPick={(choiceId) => setTrackAnswers((current) => ({ ...current, [question.id]: choiceId }))}
                      testId={`track-choice-${question.id}-${choiceIndex}`}
                    />
                  ))}
                </div>
              </div>
            ))}
            <button type="button" className="ue-btn ue-btn-primary mt-3" data-testid="track-submit" onClick={examMode ? submitExam : submitSection}>{examMode ? "Score exam" : "Score section"}</button>
            {trackResult && <p className="mt-2 text-[13px]" data-testid="track-score">{trackResult.percent}% · {trackResult.passed ? "Passed" : "Not yet"}{trackResult.assignment_ok === false ? " · assignment needs another look" : ""}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="home-screen" data-testid="programs-screen">
        <div className="home-inner">
          <div className="eyebrow">Programs</div>
          <h1 className="font-display text-[40px] font-extrabold uppercase tracking-wider leading-none mt-1">Programs</h1>
          <p className="mt-2 text-[13px] text-[var(--text-secondary)] max-w-xl">
            A program walks a genre from the first trace to a starter project in Tools. Nothing here calls the model.
          </p>
          {error && <p className="mt-3 text-[12px] font-mono text-[var(--accent-red)]" data-testid="programs-load-error">{error}</p>}
          {!cards.length && (
            <div className="panel p-4 mt-5" data-testid="programs-empty">
              <div className="eyebrow mb-2">No programs loaded</div>
              <p className="text-[13px] text-[var(--text-secondary)]">
                The lesson packs did not load, so there is nothing to open. The install should include them. You can also add a JSON pack in the packs folder next to your projects, then restart.
              </p>
              {packProblems.map((problem) => (
                <p key={problem} className="mt-2 text-[12px] font-mono text-[var(--accent-red)]">{problem}</p>
              ))}
            </div>
          )}
          {cards.length > 0 && packProblems.length > 0 && (
            <div className="panel p-3 mt-4" data-testid="programs-pack-problems">
              <div className="eyebrow mb-1">A pack could not be read</div>
              {packProblems.map((problem) => (
                <p key={problem} className="text-[12px] font-mono text-[var(--accent-red)]">{problem}</p>
              ))}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2" data-testid="track-filters">
            {["fps", "tps", "horror", "strategy"].map((id) => (
              <button key={id} type="button" className={`chip ${genre === id ? "active" : ""}`} data-testid={`track-genre-${id}`} onClick={() => setGenre(id)}>{id.toUpperCase()}</button>
            ))}
            <button type="button" className={`chip ${trackLevel === "beginner" ? "active" : ""}`} data-testid="track-level-beginner" onClick={() => setTrackLevel("beginner")}>Beginner</button>
            <button type="button" className={`chip ${trackLevel === "intermediate" ? "active" : ""}`} data-testid="track-level-intermediate" onClick={() => setTrackLevel("intermediate")}>Intermediate</button>
          </div>
          <div className="home-grid mt-3">
            {tracks.filter((item) => item.genre === genre && item.level === trackLevel).map((item) => (
              <button key={item.id} type="button" className="panel home-card text-left" data-testid={`track-card-${item.id}`} onClick={() => openTrack(item.id)}>
                <div className="font-sub font-semibold text-[15px]">{item.title}</div>
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{item.summary}</p>
                <div className="mt-2 text-[11px] font-mono text-[var(--text-muted)]">{item.sections.length} sections · final exam</div>
              </button>
            ))}
          </div>
          <div className="eyebrow mt-8">Saved lesson packs</div>
          <div className="home-grid mt-3">
            {cards.map((card) => (
              <button key={card.id} type="button" className="panel home-card text-left" data-testid={`program-card-${card.id}`} onClick={() => openProgram(card.id)}>
                <div className="font-sub font-semibold text-[15px]">{card.title}</div>
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{card.summary}</p>
                <div className="mt-2 text-[11px] font-mono text-[var(--text-muted)]">
                  {card.complete ? "Complete" : `${(card.steps_done || []).length} steps saved`}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <GlossaryTags.Provider value={program.glossary_tags || null}>
    <div className="home-screen" data-testid="program-screen">
      <div className="home-inner">
        <button type="button" className="why-concept !mt-0" onClick={() => { setProgram(null); refreshCards(); }}>All programs</button>
        <div className="eyebrow mt-3">Program</div>
        <h1 className="font-display text-[36px] font-extrabold uppercase tracking-wider leading-none mt-1">{program.title}</h1>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)] max-w-2xl">{program.summary}</p>
        {(program.related_courses || []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2" data-testid="program-related-courses">
            {(program.related_courses || []).map((id) => {
              const course = courses.find((item) => item.id === id);
              return (
                <button key={id} type="button" className="chip" data-testid={`program-course-${id}`} onClick={() => shell.go("courses")}>
                  {course?.title || id}
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {VIEWS.map(([id, label]) => (
            <button key={id} type="button" className={`chip ${view === id ? "active" : ""}`} data-testid={`program-view-${id}`} onClick={() => setView(id)}>{label}</button>
          ))}
        </div>

        {view === "steps" && mod && step && (
          <div className="panel p-4 mt-5" data-testid="program-step">
            <div className="flex flex-wrap gap-2 mb-3">
              {program.modules.map((item, index) => (
                <button key={item.id} type="button" className={`chip ${index === moduleIndex ? "active" : ""}`} onClick={() => { setModuleIndex(index); setStepIndex(0); setPicked(null); setTaskNote(""); }}>
                  {item.title}
                </button>
              ))}
            </div>
            <div className="eyebrow">{mod.title} · step {stepIndex + 1} of {mod.steps.length}</div>
            <h2 className="font-sub font-semibold text-[18px] mt-1">{step.title}</h2>
            <div className="mt-3 flex flex-wrap gap-1.5" data-testid="program-reveal">
              {(step.reveal?.nodes || []).map((name) => <span key={name} className="tag">{name}</span>)}
              {(step.reveal?.functions || []).map((name) => <span key={name} className="tag">{name}</span>)}
            </div>
            <div className="mt-4 font-sub font-semibold" data-testid="program-predict"><GlossaryText text={step.predict?.prompt} /></div>
            <div className="mt-2 flex flex-col gap-2">
              {(step.predict?.choices || []).map((choice, index) => (
                <ChoiceButton
                  key={`${step.id}-${index}`}
                  id={index}
                  label={choice}
                  picked={picked}
                  correct={step.predict.answer}
                  revealed={picked !== null}
                  onPick={setPicked}
                  testId={`program-choice-${index}`}
                />
              ))}
            </div>
            {picked !== null && (
              <div className="mt-3 text-[13px] text-[var(--text-secondary)]" data-testid="program-why">
                <div>{picked === step.predict.answer ? "That's the one this foundation uses." : <GlossaryText text={step.predict.why} />}</div>
                <div className="mt-2"><GlossaryText text={step.why} /></div>
                <label className="block mt-3">
                  <span className="eyebrow">Task</span>
                  <div className="mt-1 text-[13px] text-[var(--text-primary)]"><GlossaryText text={step.task} /></div>
                  <input className="mt-2 w-full bg-[var(--bg-main)] border border-[var(--border)] rounded px-2 py-1" value={taskText} data-testid="program-task-input" onChange={(event) => setTaskText(event.target.value)} />
                </label>
                <button type="button" className="ue-btn ue-btn-primary mt-2" data-testid="program-task-check" onClick={submitStep}>Check task</button>
                {taskNote && <p className="mt-2" data-testid="program-task-result">{taskNote}</p>}
                {stepIndex < mod.steps.length - 1 && (
                  <button type="button" className="ue-btn mt-2 ml-2" onClick={() => { setStepIndex(stepIndex + 1); setPicked(null); setTaskText(""); setTaskNote(""); }}>Next step</button>
                )}
              </div>
            )}
          </div>
        )}

        {view === "modify" && modify && (
          <div className="panel p-4 mt-5" data-testid="modify-panel">
            <div className="flex flex-wrap gap-2 mb-3">
              {(program.modify_tasks || []).map((item) => (
                <button key={item.id} type="button" className={`chip ${item.id === modify.id ? "active" : ""}`} data-testid={`modify-task-${item.id}`} onClick={() => { setModifyId(item.id); setSettings({}); setModifyNote(null); }}>
                  {item.title}
                </button>
              ))}
            </div>
            <h2 className="font-sub font-semibold text-[18px]">{modify.title}</h2>
            <p className="mt-2 text-[13px] text-[var(--text-secondary)]">{modify.prompt}</p>
            <div className="mt-4 space-y-3">
              {(modify.fields || []).map((field) => (
                <Field key={field.key} field={field} value={settings[field.key]} onChange={(value) => setSettings((current) => ({ ...current, [field.key]: value }))} />
              ))}
            </div>
            <button type="button" className="ue-btn ue-btn-primary mt-4" data-testid="modify-check" onClick={checkModify}>Check</button>
            {modifyNote && (
              <p className="mt-3 text-[13px]" data-testid="modify-result" data-pass={modifyNote.pass ? "yes" : "no"}>
                {modifyNote.detail}
              </p>
            )}
          </div>
        )}

        {view === "compare" && (
          <div className="mt-5 space-y-4" data-testid="compare-approaches">
            {(program.compares || []).map((item) => (
              <div key={item.id} className="panel p-4" data-testid={`compare-${item.id}`}>
                <div className="eyebrow">{item.feature}</div>
                <h2 className="font-sub font-semibold text-[18px] mt-1">{item.title}</h2>
                <div className="grid md:grid-cols-2 gap-3 mt-3">
                  {[item.left, item.right].map((side) => (
                    <div key={side.label} className="panel p-3">
                      <div className="font-mono text-[11px] text-[var(--unreal-orange)]">{side.label}</div>
                      <pre className="mt-2 whitespace-pre-wrap text-[12px] font-mono text-[var(--text-secondary)]">{side.body}</pre>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[13px] text-[var(--text-secondary)]"><GlossaryText text={item.note} /></p>
              </div>
            ))}
          </div>
        )}

        {view === "map" && (
          <div className="panel p-4 mt-5" data-testid="system-map">
            <div className="eyebrow mb-2">System map</div>
            <div className="flex flex-wrap gap-2">
              {(program.map?.nodes || []).map((node) => (
                <button key={node.id} type="button" className={`chip ${mapId === node.id ? "active" : ""}`} data-testid={`map-node-${node.id}`} onClick={() => setMapId(node.id)}>
                  {node.title}
                </button>
              ))}
            </div>
            <div className="mt-3 text-[12px] font-mono text-[var(--text-muted)]">
              {(program.map?.edges || []).map((edge) => `${edge.from} → ${edge.to}`).join("   ")}
            </div>
            {mapNode && (
              <div className="mt-4" data-testid="map-detail">
                <h2 className="font-sub font-semibold text-[18px]">{mapNode.title}</h2>
                <p className="mt-2 text-[13px] text-[var(--text-secondary)]"><GlossaryText text={mapNode.detail} /></p>
              </div>
            )}
          </div>
        )}

        {view === "finish" && (
          <div className="panel p-4 mt-5" data-testid="program-finish">
            <h2 className="font-sub font-semibold text-[18px]">Load the starter project</h2>
            <p className="mt-2 text-[13px] text-[var(--text-secondary)] max-w-xl">
              This puts the Tactical FPS foundation into your projects and opens it in Tools. Interaction, inventory, weapon wear, and health are in the one project. The C++ is written for a blank UE 5.8 game module, and the same files build on 5.7. Home marks the program complete.
            </p>
            <button type="button" className="ue-btn ue-btn-primary mt-4" data-testid="program-load-starter" onClick={finish}>Load into Tools</button>
          </div>
        )}
      </div>
    </div>
    </GlossaryTags.Provider>
  );
}
