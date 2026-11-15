import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errorText } from "../lib/api";
import { choiceNote } from "../lib/choices.mjs";
import ChoiceButton from "../components/ChoiceButton";
import GlossaryText, { GlossaryTags } from "../components/GlossaryText";

export default function Courses() {
  const [cards, setCards] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [course, setCourse] = useState(null);
  const [moduleIndex, setModuleIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [diff, setDiff] = useState("");
  const [assignment, setAssignment] = useState("");
  const [result, setResult] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});
  const [loadError, setLoadError] = useState("");
  const [packProblems, setPackProblems] = useState([]);

  const loadList = () => api.get("/study").then((r) => {
    setCards(r.data?.courses || []);
    setReviews(r.data?.reviews || []);
    setPackProblems(r.data?.problems || []);
    setLoadError("");
  }).catch((err) => setLoadError(errorText(err)));

  useEffect(() => { loadList(); }, []);

  const openCourse = (id) => {
    api.get(`/courses/${id}`)
      .then((r) => {
        setCourse(r.data.course);
        setModuleIndex(0);
        setAnswers({});
        setDiff("");
        setAssignment("");
        setResult(null);
      })
      .catch((err) => toast.error(errorText(err)));
  };

  const mod = course?.modules?.[moduleIndex];

  const submit = async () => {
    if (!course || !mod) return;
    try {
      const { data } = await api.post(`/courses/${course.id}/modules/${mod.id}/attempt`, { answers, diff, assignment });
      setResult(data);
      loadList();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const answerReview = async (id, choice) => {
    try {
      const { data } = await api.post("/study/review", { id, choice });
      setReviewNotes((current) => ({
        ...current,
        [id]: {
          picked: choice,
          correctIndex: data.correct ? choice : -1,
          text: data.correct ? "That's the one." : (data.why || "Not this time. It will come back."),
        },
      }));
      if (data.correct) setReviews((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  if (!course) {
    return (
      <div className="home-screen" data-testid="courses-screen">
        <div className="home-inner">
          <div className="eyebrow">Courses</div>
          <h1 className="font-display text-[40px] font-extrabold uppercase tracking-wider leading-none mt-1">Courses</h1>
          <p className="mt-2 text-[13px] text-[var(--text-secondary)] max-w-xl">
            A course is a scored path. Quizzes, a diff, a short assignment, and a takeaway. Scores stay on this computer. You can retake any module.
          </p>
          {loadError && <p className="mt-3 text-[12px] font-mono text-[var(--accent-red)]" data-testid="courses-load-error">{loadError}</p>}
          {!cards.length && (
            <div className="panel p-4 mt-5" data-testid="courses-empty">
              <div className="eyebrow mb-2">No courses loaded</div>
              <p className="text-[13px] text-[var(--text-secondary)]">
                The lesson packs did not load, so there is nothing to open. The install should include them. You can also add a JSON pack in the packs folder next to your projects, then restart.
              </p>
              {packProblems.map((problem) => (
                <p key={problem} className="mt-2 text-[12px] font-mono text-[var(--accent-red)]">{problem}</p>
              ))}
            </div>
          )}
          {cards.length > 0 && packProblems.length > 0 && (
            <div className="panel p-3 mt-4" data-testid="courses-pack-problems">
              <div className="eyebrow mb-1">A pack could not be read</div>
              {packProblems.map((problem) => (
                <p key={problem} className="text-[12px] font-mono text-[var(--accent-red)]">{problem}</p>
              ))}
            </div>
          )}
          {reviews.length > 0 && (
            <div className="panel p-4 mt-5" data-testid="spaced-review">
              <div className="eyebrow mb-2">Review</div>
              {reviews.map((item) => (
                <div key={item.id} className="mt-3">
                  <div className="text-[13px]"><GlossaryText text={item.prompt} /></div>
                  <div className="mt-2 flex flex-col gap-2">
                    {(item.choices || []).map((choice, index) => {
                      const note = reviewNotes[item.id];
                      return (
                        <ChoiceButton
                          key={`${item.id}-${index}`}
                          id={index}
                          label={choice}
                          picked={note ? note.picked : null}
                          correct={note ? note.correctIndex : null}
                          revealed={!!note}
                          onPick={(choiceId) => answerReview(item.id, choiceId)}
                          testId={`review-choice-${item.id}-${index}`}
                        />
                      );
                    })}
                  </div>
                  {reviewNotes[item.id] && <p className="mt-2 text-[13px] text-[var(--text-secondary)]" data-testid={`review-result-${item.id}`}><GlossaryText text={reviewNotes[item.id].text} /></p>}
                </div>
              ))}
            </div>
          )}
          <div className="home-grid mt-6">
            {cards.map((card) => (
              <button key={card.id} type="button" className="panel home-card text-left" data-testid={`course-card-${card.id}`} onClick={() => openCourse(card.id)}>
                <div className="font-sub font-semibold text-[15px]">{card.title}</div>
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{card.summary}</p>
                <div className="mt-2 text-[11px] font-mono text-[var(--text-muted)]">{card.modules.length} modules · pass at {card.pass_mark}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <GlossaryTags.Provider value={course.glossary_tags || null}>
    <div className="home-screen" data-testid="course-screen">
      <div className="home-inner">
        <button type="button" className="why-concept !mt-0" onClick={() => { setCourse(null); setResult(null); loadList(); }}>All courses</button>
        <div className="eyebrow mt-3">Course</div>
        <h1 className="font-display text-[36px] font-extrabold uppercase tracking-wider leading-none mt-1">{course.title}</h1>
        <p className="mt-2 text-[13px] text-[var(--text-secondary)]">Pass mark {course.pass_mark}. A retake replaces the saved score.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {course.modules.map((item, index) => (
            <button key={item.id} type="button" className={`chip ${index === moduleIndex ? "active" : ""}`} data-testid={`course-module-${item.id}`} onClick={() => { setModuleIndex(index); setAnswers({}); setDiff(""); setAssignment(""); setResult(null); }}>
              {item.title}
            </button>
          ))}
        </div>
        {mod && (
          <div className="panel p-4 mt-5" data-testid="course-quiz">
            <h2 className="font-sub font-semibold text-[18px]">{mod.title}</h2>
            <div className="mt-4 space-y-4">
              {(mod.quiz || []).map((question, qIndex) => (
                <div key={question.id}>
                  <div className="text-[13px] text-[var(--text-primary)]">{qIndex + 1}. <GlossaryText text={question.prompt} /></div>
                  <div className="mt-2 flex flex-col gap-2">
                    {question.choices.map((choice, index) => (
                      <ChoiceButton
                        key={`${question.id}-${index}`}
                        id={index}
                        label={choice}
                        picked={answers[question.id]}
                        correct={question.answer}
                        revealed={!!result}
                        onPick={(choiceId) => setAnswers((current) => ({ ...current, [question.id]: choiceId }))}
                        testId={`quiz-choice-${question.id}-${index}`}
                      />
                    ))}
                  </div>
                  {result && (
                    <p className="mt-2 text-[13px] text-[var(--text-secondary)]" data-testid={`quiz-note-${question.id}`}>
                      <GlossaryText text={choiceNote({
                        picked: answers[question.id],
                        correct: question.answer,
                        why: question.why,
                        revealed: true,
                      })} />
                    </p>
                  )}
                </div>
              ))}
            </div>
            {mod.diff && (
              <div className="mt-5" data-testid="diff-quiz">
                <div className="eyebrow mb-2">Diff</div>
                <div className="text-[13px]"><GlossaryText text={mod.diff.prompt} /></div>
                <div className="grid md:grid-cols-2 gap-3 mt-3">
                  {["left", "right"].map((side) => (
                    <ChoiceButton
                      key={side}
                      id={side}
                      picked={diff}
                      correct={mod.diff.bug}
                      revealed={!!result}
                      onPick={setDiff}
                      testId={`diff-side-${side}`}
                    >
                      <span className="block font-mono text-[11px] text-[var(--unreal-orange)]">{mod.diff[side].label}</span>
                      <span className="choice-code">{mod.diff[side].code}</span>
                    </ChoiceButton>
                  ))}
                </div>
              </div>
            )}
            <label className="block mt-5">
              <span className="eyebrow">Assignment</span>
              <div className="mt-1 text-[13px] text-[var(--text-secondary)]"><GlossaryText text={mod.assignment?.prompt} /></div>
              <textarea className="mt-2 w-full min-h-[70px] bg-[var(--bg-main)] border border-[var(--border)] rounded px-2 py-1 text-[13px]" data-testid="course-assignment" value={assignment} onChange={(event) => setAssignment(event.target.value)} />
            </label>
            <button type="button" className="ue-btn ue-btn-primary mt-3" data-testid="course-submit" onClick={submit}>Submit module</button>
            {result && (
              <div className="mt-4 text-[13px] text-[var(--text-secondary)]" data-testid="course-result">
                <div data-testid="course-score">{result.percent}% · {result.passed ? "Pass" : "Not yet"}{result.assignment_ok ? " · assignment accepted" : " · assignment needs another look"}</div>
                {(result.results || []).map((item) => (
                  <div key={item.id} className="mt-2">{item.correct ? "Right." : "Not that one."} <GlossaryText text={item.why} /></div>
                ))}
                {result.diff_why && (
                  <div className="mt-2" data-testid="diff-note">
                    <GlossaryText text={choiceNote({
                      picked: diff,
                      correct: mod.diff.bug,
                      why: result.diff_why,
                      revealed: true,
                      rightText: "The diff is right.",
                      wrongText: `The diff is the other side. ${result.diff_why}`,
                    })} />
                  </div>
                )}
                <div className="mt-3 panel p-3" data-testid="course-takeaway">
                  <div className="eyebrow mb-1">Takeaway</div>
                  <GlossaryText text={result.takeaway} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
    </GlossaryTags.Provider>
  );
}
