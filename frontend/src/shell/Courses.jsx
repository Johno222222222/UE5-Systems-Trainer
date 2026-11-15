import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errorText } from "../lib/api";

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

  const loadList = () => api.get("/study").then((r) => {
    setCards(r.data?.courses || []);
    setReviews(r.data?.reviews || []);
  }).catch(() => {});

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
      setReviewNotes((current) => ({ ...current, [id]: data.correct ? "That's the one." : (data.why || "Not this time. It will come back.") }));
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
          {reviews.length > 0 && (
            <div className="panel p-4 mt-5" data-testid="spaced-review">
              <div className="eyebrow mb-2">Review</div>
              {reviews.map((item) => (
                <div key={item.id} className="mt-3">
                  <div className="text-[13px]">{item.prompt}</div>
                  <div className="mt-2 flex flex-col gap-2">
                    {(item.choices || []).map((choice, index) => (
                      <button key={choice} type="button" className="ue-btn justify-start" onClick={() => answerReview(item.id, index)}>{choice}</button>
                    ))}
                  </div>
                  {reviewNotes[item.id] && <p className="mt-2 text-[13px] text-[var(--text-secondary)]">{reviewNotes[item.id]}</p>}
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
                  <div className="text-[13px] text-[var(--text-primary)]">{qIndex + 1}. {question.prompt}</div>
                  <div className="mt-2 flex flex-col gap-2">
                    {question.choices.map((choice, index) => (
                      <button key={choice} type="button" className={`ue-btn justify-start whitespace-normal text-left ${answers[question.id] === index ? "!border-[var(--unreal-orange)]" : ""}`} data-testid={`quiz-choice-${question.id}-${index}`} onClick={() => setAnswers((current) => ({ ...current, [question.id]: index }))}>
                        {choice}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {mod.diff && (
              <div className="mt-5" data-testid="diff-quiz">
                <div className="eyebrow mb-2">Diff</div>
                <div className="text-[13px]">{mod.diff.prompt}</div>
                <div className="grid md:grid-cols-2 gap-3 mt-3">
                  {["left", "right"].map((side) => (
                    <button key={side} type="button" className={`panel p-3 text-left ${diff === side ? "border-[var(--unreal-orange)]" : ""}`} data-testid={`diff-side-${side}`} onClick={() => setDiff(side)}>
                      <div className="font-mono text-[11px] text-[var(--unreal-orange)]">{mod.diff[side].label}</div>
                      <pre className="mt-2 whitespace-pre-wrap text-[12px] font-mono text-[var(--text-secondary)]">{mod.diff[side].code}</pre>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label className="block mt-5">
              <span className="eyebrow">Assignment</span>
              <div className="mt-1 text-[13px] text-[var(--text-secondary)]">{mod.assignment?.prompt}</div>
              <textarea className="mt-2 w-full min-h-[70px] bg-[var(--bg-main)] border border-[var(--border)] rounded px-2 py-1 text-[13px]" data-testid="course-assignment" value={assignment} onChange={(event) => setAssignment(event.target.value)} />
            </label>
            <button type="button" className="ue-btn ue-btn-primary mt-3" data-testid="course-submit" onClick={submit}>Submit module</button>
            {result && (
              <div className="mt-4 text-[13px] text-[var(--text-secondary)]" data-testid="course-result">
                <div data-testid="course-score">{result.percent}% · {result.passed ? "Pass" : "Not yet"}{result.assignment_ok ? " · assignment accepted" : " · assignment needs another look"}</div>
                {(result.results || []).map((item) => (
                  <div key={item.id} className="mt-2">{item.correct ? "Right." : "Not that one."} {item.why}</div>
                ))}
                {result.diff_why && <div className="mt-2">{result.diff_correct ? "The diff is right." : "The diff is the other side."} {result.diff_why}</div>}
                <div className="mt-3 panel p-3" data-testid="course-takeaway">
                  <div className="eyebrow mb-1">Takeaway</div>
                  {result.takeaway}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
