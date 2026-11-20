import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errorText } from "../lib/api";
import ChoiceButton from "../components/ChoiceButton";
import GlossaryText, { GlossaryTags } from "../components/GlossaryText";
import LessonStudio from "./LessonStudio";

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
  const [genre, setGenre] = useState("all");
  const [level, setLevel] = useState("all");
  const [resume, setResume] = useState(null);
  const [saveNote, setSaveNote] = useState("");

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
        const checkpoint = r.data.state?.checkpoint || null;
        setCourse(r.data.course);
        setModuleIndex(checkpoint?.sectionIndex || 0);
        setAnswers(checkpoint?.answers || {});
        setDiff("");
        setAssignment("");
        setResult(checkpoint?.scores || null);
        setResume(checkpoint ? { ...checkpoint, token: Date.now() } : null);
        setSaveNote("");
      })
      .catch((err) => toast.error(errorText(err)));
  };

  const mod = course?.modules?.[moduleIndex];

  const saveLesson = async (snapshot) => {
    if (!course) return;
    try {
      await api.post(`/courses/${course.id}/checkpoint`, {
        ...snapshot,
        sectionIndex: moduleIndex,
        examMode: false,
      });
      setSaveNote("Saved on this computer.");
    } catch (err) {
      setSaveNote(errorText(err));
    }
  };

  const submit = async (given) => {
    if (!course || !mod) return;
    try {
      const { data } = await api.post(`/courses/${course.id}/modules/${mod.id}/attempt`, { answers: given || answers, diff, assignment });
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
            A course is a shorter scored path than a program. General pulls from every genre. FPS, TPS, Horror, and Strategy each have their own. Quizzes, a diff, a short assignment, and a takeaway stay on every module. Scores stay on this computer. You can retake any module.
          </p>
          <div className="mt-4 flex flex-wrap gap-2" data-testid="course-filters">
            {[["all", "All"], ["general", "General"], ["fps", "FPS"], ["tps", "TPS"], ["horror", "Horror"], ["strategy", "Strategy"]].map(([id, label]) => (
              <button key={id} type="button" className={`chip ${genre === id ? "active" : ""}`} data-testid={`course-genre-${id}`} onClick={() => setGenre(id)}>{label}</button>
            ))}
            <button type="button" className={`chip ${level === "all" ? "active" : ""}`} data-testid="course-level-all" onClick={() => setLevel("all")}>Any level</button>
            <button type="button" className={`chip ${level === "beginner" ? "active" : ""}`} data-testid="course-level-beginner" onClick={() => setLevel("beginner")}>Beginner</button>
            <button type="button" className={`chip ${level === "intermediate" ? "active" : ""}`} data-testid="course-level-intermediate" onClick={() => setLevel("intermediate")}>Intermediate</button>
          </div>
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
            {cards.filter((card) => (genre === "all" || (card.genre || "general") === genre) && (level === "all" || card.level === level)).map((card) => (
              <button key={card.id} type="button" className="panel home-card text-left" data-testid={`course-card-${card.id}`} onClick={() => openCourse(card.id)}>
                <div className="font-sub font-semibold text-[15px]">{card.title}</div>
                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{card.summary}</p>
                <div className="mt-2 text-[11px] font-mono text-[var(--text-muted)]">{card.genre ? `${card.genre} · ` : ""}{card.level ? `${card.level} · ` : ""}{card.modules.length} modules · pass at {card.pass_mark}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const sections = course.sections?.length ? course.sections : course.modules;
  const next = sections[moduleIndex + 1];
  return (
    <GlossaryTags.Provider value={course.glossary_tags || null}>
      <div data-testid="course-screen">
        <LessonStudio
          eyebrow="courses"
          title={course.title}
          summary={`Course${course.genre ? ` · ${course.genre}` : ""}${course.level ? ` · ${course.level}` : ""} · pass at ${course.pass_mark}`}
          sections={sections}
          sectionIndex={moduleIndex}
          result={result}
          nextLabel={next ? next.title : ""}
          onClose={() => { setCourse(null); setResult(null); loadList(); }}
          resume={resume}
          onSave={saveLesson}
          saveNote={saveNote}
          onSection={(index) => { setModuleIndex(index); setAnswers({}); setResult(null); }}
          onNext={() => { if (next) { setModuleIndex(moduleIndex + 1); setResult(null); } }}
          onScore={(given) => submit(given)}
        />
      </div>
    </GlossaryTags.Provider>
  );
}
