"use client";

import { useEffect, useRef, useState } from "react";
import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { LoadingState } from "@/components/loading-state";
import { CandlestickChart } from "@/components/practice/candlestick-chart";
import { ChoiceControls } from "@/components/practice/choice-controls";
import { ConceptPicker } from "@/components/practice/concept-picker";
import { ExerciseControls } from "@/components/practice/exercise-controls";
import { FeedbackPanel } from "@/components/practice/feedback-panel";
import { FreeTradeExercise, type FreeTradeAttempt, type FreeTradeGradeResponse } from "@/components/practice/free-trade-exercise";
import { GuidedExercise, type GuidedGradeResponse } from "@/components/practice/guided-exercise";
import { SessionLengthPicker } from "@/components/practice/session-length-picker";
import { SessionSummary } from "@/components/practice/session-summary";
import { SaveStatus } from "@/components/save-status";
import { gradeFreeTradeScenario, gradeGuided, gradeRecognition, loadSessionExercises } from "@/app/practice/actions";
import { getExerciseMeta } from "@/data/catalog";
import type { ZoneAnswer } from "@/data/exercises";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { DASHBOARD_COLUMNS, fetchAttempts, insertAttempt, nextAttemptNumber, type NewAttempt } from "@/lib/attempts";
import { describeError, type FriendlyError } from "@/lib/errors";
import { modeFor, track, type SessionSource } from "@/lib/events";
import { CONCEPT_LIST, getConceptMeta, type Concept } from "@/lib/concepts";
import type { GradeResult, UserAnswer, UserRegion } from "@/lib/grading";
import type { GuidedUserAnswer } from "@/lib/guided-grading";
import { recordSessionCompletion } from "@/lib/profiles";
import type { PublicExercise } from "@/lib/public-exercise";
import { buildAdaptiveSession } from "@/lib/recommendations";
import { buildSessionExerciseIds, type SessionLength } from "@/lib/session-builder";
import {
  ADAPTIVE_SESSION,
  clearSession,
  createSession,
  loadSession,
  saveSession,
  type SessionState,
} from "@/lib/storage";

/** Response time for an attempt — called from event handlers only. */
function msSince(start: number): number {
  return Date.now() - start;
}

export default function PracticePage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [session, setSession] = useState<SessionState | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  /** Set once a concept is picked, before session length is chosen — shows
   * the length picker instead of immediately starting a session. */
  const [lengthPickerConcept, setLengthPickerConcept] = useState<Concept | null>(null);
  const [userRegion, setUserRegion] = useState<UserRegion | null>(null);
  const [userLevel, setUserLevel] = useState<number | null>(null);
  const [userChoice, setUserChoice] = useState<string | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  /** The key to draw on the chart, returned by the server with the verdict. */
  const [reveal, setReveal] = useState<{ zone: ZoneAnswer | null; level: number | null } | null>(null);
  const [grading, setGrading] = useState(false);
  /** A recognition answer whose grading request failed, for "Try again". */
  const [pendingAnswer, setPendingAnswer] = useState<{ answer: UserAnswer; responseTimeMs: number } | null>(null);
  /** Exercises of the current session as the server sent them (answer-free,
   * docs/ANSWER-KEYS.md); null = no longer available. */
  const [loaded, setLoaded] = useState<Record<string, PublicExercise | null>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<FriendlyError | null>(null);
  /** The last attempt row that failed to save, so it can be retried. */
  const pendingRowRef = useRef<NewAttempt | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [adaptiveError, setAdaptiveError] = useState<string | null>(null);
  const exerciseStartRef = useRef<number>(0);


  // Reset the response-time clock whenever a new exercise becomes active,
  // including when it finishes loading.
  const currentId = session && !session.completed ? session.exercise_order[session.current_index] : null;
  const currentLoaded = currentId !== null && currentId in loaded;
  useEffect(() => {
    exerciseStartRef.current = Date.now();
  }, [session?.session_id, session?.current_index, currentLoaded]);

  // Fetch the session's exercises from the server (without answer keys).
  const sessionIds = session && !session.completed ? session.exercise_order.join(",") : "";
  useEffect(() => {
    if (!sessionIds) return;
    const missing = sessionIds.split(",").filter((id) => !(id in loaded));
    if (missing.length === 0) return;
    let cancelled = false;
    loadSessionExercises(missing)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(res.error);
          return;
        }
        setLoadError(null);
        setLoaded((prev) => ({ ...prev, ...res.exercises }));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(describeError(err, "load this exercise").message);
      });
    return () => {
      cancelled = true;
    };
    // `loaded` is read, not a trigger: re-running on every merge would refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIds, loadAttempt]);

  function handlePickConcept(concept: Concept) {
    setShowPicker(false);
    setLengthPickerConcept(concept);
  }

  function handleStartSession(
    concept: Concept,
    length: SessionLength,
    difficulty?: 1 | 2 | 3,
    source: SessionSource = "picker",
  ) {
    beginSession(concept, buildSessionExerciseIds(concept, length, difficulty), source);
  }

  async function handleStartAdaptive() {
    if (!user) return;
    setAdaptiveError(null);
    try {
      // The engine works from the answer-free catalog; the server re-checks
      // each pick is practice-ready when it serves it.
      const ids = buildAdaptiveSession(await fetchAttempts(user.id, DASHBOARD_COLUMNS)).filter(
        (id) => getExerciseMeta(id)?.practice_ready === true,
      );
      beginSession(ADAPTIVE_SESSION, ids, "adaptive_mix");
    } catch (err) {
      setAdaptiveError(describeError(err, "load your practice history to build the session").message);
    }
  }

  /** A session still in progress is recorded as abandoned at the point the
   * user left it (product analytics, src/lib/events.ts). */
  function trackAbandoned(s: SessionState | null) {
    if (s && !s.completed) {
      track({
        event_type: "session_abandoned",
        session_id: s.session_id,
        position: s.correct_count + s.missed_exercise_ids.length,
      });
    }
  }

  function beginSession(kind: string, exerciseIds: string[], source: SessionSource) {
    if (exerciseIds.length === 0) {
      // e.g. a concept whose only exercises are real scenarios still awaiting review.
      setNotice(`There are no exercises ready for ${kind === ADAPTIVE_SESSION ? "an adaptive session" : getConceptMeta(kind).pickerLabel} yet. Pick another concept.`);
      setSession(null);
      setLengthPickerConcept(null);
      setShowPicker(true);
      return;
    }
    setNotice(null);
    trackAbandoned(session ?? loadSession());
    const fresh = createSession(kind, exerciseIds);
    track({
      event_type: "session_started",
      session_id: fresh.session_id,
      mode: modeFor(kind),
      concept: kind,
      source,
      planned_length: exerciseIds.length,
    });
    saveSession(fresh);
    setSession(fresh);
    setShowPicker(false);
    setLengthPickerConcept(null);
    setUserRegion(null);
    setUserLevel(null);
    setUserChoice(null);
    setResult(null);
    setReveal(null);
    setGradeError(null);
    setPendingAnswer(null);
  }

  // A deep link (?concept=…[&difficulty=…&length=…], e.g. the dashboard's
  // recommended session) is a "start this now" action: it replaces any
  // session in progress, then the URL is cleaned so a reload resumes
  // instead of restarting. Otherwise resume an in-progress (or
  // just-completed) session from a prior visit, or show the concept picker.
  // Reading localStorage/location is a one-time sync from browser-only
  // state (neither is available during SSR) and can't be done in render, so
  // the setState-in-effect here is intentional.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedConcept = params.get("concept");
    if (requestedConcept && CONCEPT_LIST.includes(requestedConcept as Concept)) {
      const d = Number(params.get("difficulty"));
      const lengthParam = params.get("length");
      const length: SessionLength = lengthParam && /^\d+$/.test(lengthParam) ? Number(lengthParam) : "all";
      window.history.replaceState(null, "", "/practice");
      handleStartSession(
        requestedConcept as Concept,
        length,
        d === 1 || d === 2 || d === 3 ? d : undefined,
        params.get("src") === "rec" ? "recommendation" : "deep_link",
      );
      return;
    }
    const existing = loadSession();
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSession(existing);
      return;
    }
    setShowPicker(true);
    // Mount-only: reads the URL/localStorage once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleBackToPicker() {
    trackAbandoned(session);
    clearSession();
    setSession(null);
    setLengthPickerConcept(null);
    setShowPicker(true);
  }

  if (authLoading || !user) {
    return (
      <div className="flex flex-1 flex-col">
        <LoadingState />
        <DisclaimerFooter />
      </div>
    );
  }

  if (showPicker) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="page">
          {notice && (
            <p className="mb-6 rounded-md border border-line bg-surface p-3 text-sm text-foreground" role="status">
              {notice}
            </p>
          )}
          <ConceptPicker onPick={handlePickConcept} onPickAdaptive={handleStartAdaptive} adaptiveError={adaptiveError} />
        </div>
        <DisclaimerFooter />
      </div>
    );
  }

  if (lengthPickerConcept) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="page">
          <SessionLengthPicker
            concept={lengthPickerConcept}
            onPick={(length) => handleStartSession(lengthPickerConcept, length)}
            onBack={() => {
              setLengthPickerConcept(null);
              setShowPicker(true);
            }}
          />
        </div>
        <DisclaimerFooter />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="page" />
        <DisclaimerFooter />
      </div>
    );
  }

  const isAdaptive = session.concept === ADAPTIVE_SESSION;
  const conceptMeta = isAdaptive
    ? { title: "Adaptive Practice", pickerLabel: "Adaptive", pickerDescription: "" }
    : getConceptMeta(session.concept);

  if (session.completed) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="page">
          <h1 className="page-title">
            {conceptMeta.title}
          </h1>
          <div className="mt-6">
            <SessionSummary session={session} onPracticeAgain={handleBackToPicker} />
          </div>
        </div>
        <DisclaimerFooter />
      </div>
    );
  }

  const exerciseId = session.exercise_order[session.current_index];
  if (!(exerciseId in loaded)) {
    return (
      <div className="flex flex-1 flex-col">
        {loadError ? (
          <div className="page" role="alert">
            <h1 className="page-title">{conceptMeta.title}</h1>
            <p className="mt-4 text-sm text-danger">{loadError}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => setLoadAttempt((n) => n + 1)} className="btn-primary">
                Try again
              </button>
              <button type="button" onClick={handleBackToPicker} className="btn-secondary">
                Start a new session
              </button>
            </div>
          </div>
        ) : (
          <LoadingState />
        )}
        <DisclaimerFooter />
      </div>
    );
  }
  const exercise = loaded[exerciseId];
  if (!exercise) {
    // A saved session can outlive its exercises (e.g. a real scenario
    // rejected at review after the session started). Offer a way on
    // instead of crashing.
    return (
      <div className="flex flex-1 flex-col">
        <div className="page">
          <h1 className="page-title">{conceptMeta.title}</h1>
          <p className="mt-4 text-sm text-foreground">
            The next exercise in this session is no longer available. It may have been withdrawn after review.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                const next = { ...session, current_index: session.current_index + 1 };
                next.completed = next.current_index >= next.exercise_order.length;
                saveSession(next);
                setSession(next);
              }}
              className="btn-primary"
            >
              Skip it
            </button>
            <button
              type="button"
              onClick={handleBackToPicker}
              className="btn-secondary"
            >
              Start a new session
            </button>
          </div>
        </div>
        <DisclaimerFooter />
      </div>
    );
  }

  const attemptedCount = session.correct_count + session.missed_exercise_ids.length;
  const isLastExercise = session.current_index === session.exercise_order.length - 1;
  const canSubmit =
    !grading &&
    (exercise.answer_type === "zone"
      ? userRegion !== null
      : exercise.answer_type === "level"
        ? userLevel !== null
        : userChoice !== null);

  // Saving is the only async step after grading. A failure keeps the built
  // row so "Retry save" can resend it; session progress never depends on it.
  async function saveAttempt(userId: string, exerciseId: string, build: (attemptNumber: number) => NewAttempt) {
    setSaving(true);
    setSaveError(null);
    try {
      const row = build(await nextAttemptNumber(userId, exerciseId));
      pendingRowRef.current = row;
      await insertAttempt(userId, row);
      pendingRowRef.current = null;
    } catch (err) {
      setSaveError(describeError(err, "save this attempt"));
    } finally {
      setSaving(false);
    }
  }

  async function retrySave() {
    if (!user) return;
    const row = pendingRowRef.current;
    if (!row) return;
    await saveAttempt(user.id, row.exercise_id, (n) => ({ ...row, attempt_number: n }));
  }

  // Every mode ends here once the server has graded the answer: session
  // progress (local bookkeeping) is updated synchronously, before the async
  // save starts, so there's no window where clicking "Next" mid-save could
  // race with this and overwrite newer state with a stale snapshot. The
  // row comes from the server, built from the same grade the user sees.
  async function recordGraded(isCorrect: boolean, row: NewAttempt) {
    if (!session || !user) return;
    const updatedSession: SessionState = {
      ...session,
      correct_count: session.correct_count + (isCorrect ? 1 : 0),
      missed_exercise_ids: isCorrect ? session.missed_exercise_ids : [...session.missed_exercise_ids, exerciseId],
    };
    saveSession(updatedSession);
    setSession(updatedSession);
    await saveAttempt(user.id, exerciseId, (attemptNumber) => ({ ...row, attempt_number: attemptNumber }));
  }

  /** Grading is a server round-trip (the key lives there). A failure keeps
   * the answer so "Try again" can resend it. */
  async function submitRecognition(answer: UserAnswer, responseTimeMs: number) {
    if (!session) return;
    setGrading(true);
    setGradeError(null);
    setPendingAnswer({ answer, responseTimeMs });
    try {
      const res = await gradeRecognition(exerciseId, answer, { sessionId: session.session_id, responseTimeMs });
      if (!res.ok) {
        setGradeError(res.error);
        return;
      }
      setPendingAnswer(null);
      setResult(res.grade);
      setReveal(res.reveal);
      await recordGraded(res.grade.isCorrect, res.row);
    } catch (err) {
      setGradeError(describeError(err, "grade this answer").message);
    } finally {
      setGrading(false);
    }
  }

  async function handleSubmit() {
    if (!exercise || grading) return;
    if (exercise.answer_type === "zone" && !userRegion) return;
    if (exercise.answer_type === "level" && userLevel === null) return;
    if (exercise.answer_type === "choice" && userChoice === null) return;
    const answer: UserAnswer =
      exercise.answer_type === "zone"
        ? { type: "region", region: userRegion! }
        : exercise.answer_type === "level"
          ? { type: "level", price: userLevel! }
          : { type: "choice", choice: userChoice! };
    await submitRecognition(answer, msSince(exerciseStartRef.current));
  }

  async function handleNoAnswer() {
    if (grading) return;
    setUserRegion(null);
    setUserLevel(null);
    await submitRecognition({ type: "none" }, msSince(exerciseStartRef.current));
  }

  async function retryGrade() {
    if (pendingAnswer) await submitRecognition(pendingAnswer.answer, pendingAnswer.responseTimeMs);
  }

  // Guided Entry's multi-step flow finalizes itself (Submit Setup or No
  // Trade at any step) and calls this once.
  async function gradeGuidedAnswer(answer: GuidedUserAnswer): Promise<GuidedGradeResponse | null> {
    if (!session) return null;
    setGradeError(null);
    try {
      const res = await gradeGuided(exerciseId, answer, {
        sessionId: session.session_id,
        responseTimeMs: msSince(exerciseStartRef.current),
      });
      if (!res.ok) {
        setGradeError(res.error);
        return null;
      }
      void recordGraded(res.grade.isCorrect, res.row);
      return { grade: res.grade, reveal: res.reveal };
    } catch (err) {
      setGradeError(describeError(err, "grade this setup").message);
      return null;
    }
  }

  // Free Trade's playback runner calls this once when the scenario ends
  // (trade closed, End Session, or playback ran out). is_correct is the
  // process verdict, never the win/loss outcome.
  async function gradeFreeTradeAttempt(attempt: FreeTradeAttempt): Promise<FreeTradeGradeResponse | null> {
    if (!session) return null;
    setGradeError(null);
    try {
      const res = await gradeFreeTradeScenario(exerciseId, attempt.position, attempt.exit, {
        sessionId: session.session_id,
        responseTimeMs: msSince(exerciseStartRef.current),
      });
      if (!res.ok) {
        setGradeError(res.error);
        return null;
      }
      void recordGraded(res.grade.passed, res.row);
      return { grade: res.grade, key: res.key };
    } catch (err) {
      setGradeError(describeError(err, "grade this trade").message);
      return null;
    }
  }

  function handleNext() {
    if (!session) return;
    const nextIndex = session.current_index + 1;
    const completed = nextIndex >= session.exercise_order.length;
    const updatedSession: SessionState = { ...session, current_index: nextIndex, completed };
    if (completed) {
      track({
        event_type: "session_completed",
        session_id: session.session_id,
        position: session.correct_count + session.missed_exercise_ids.length,
      });
    }
    saveSession(updatedSession);
    setSession(updatedSession);
    setUserRegion(null);
    setUserLevel(null);
    setUserChoice(null);
    setResult(null);
    setReveal(null);
    setSaveError(null);
    setGradeError(null);
    setPendingAnswer(null);
    // Best-effort, off the critical path — a failure here shouldn't block
    // showing the session summary (matching how ensureProfile is called).
    if (completed && user) {
      recordSessionCompletion(user.id).catch(() => {});
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="page">
        {/* Everything above the chart is quiet: where you are (eyebrow +
            thin progress line), then the prompt, then the score as a
            footnote. The chart is the focus. */}
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="eyebrow">
            {conceptMeta.title}
            {isAdaptive && <> · {getConceptMeta(exercise.concept).pickerLabel}</>}
          </h1>
          <p className="eyebrow tabular-nums">
            {session.current_index + 1} / {session.exercise_order.length}
          </p>
        </div>
        <div
          className="mt-3 h-0.5 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label="Session progress"
          aria-valuemin={0}
          aria-valuemax={session.exercise_order.length}
          aria-valuenow={session.current_index}
        >
          <div
            className="h-full bg-accent transition-[width]"
            style={{ width: `${(session.current_index / session.exercise_order.length) * 100}%` }}
          />
        </div>
        <p className="mt-6 text-lg leading-snug text-foreground sm:text-xl">{exercise.prompt}</p>
        <p className="mt-1.5 text-xs text-muted tabular-nums">
          Score {session.correct_count}/{attemptedCount} · Difficulty {exercise.difficulty} of 3
        </p>

        {exercise.answer_type === "free" ? (
          <div className="mt-6">
            <FreeTradeExercise
              key={exercise.exercise_id}
              exercise={exercise}
              onGrade={gradeFreeTradeAttempt}
              onNext={handleNext}
              nextLabel={isLastExercise ? "See Results" : "Next Scenario"}
            />
            {gradeError && <p className="mt-3 text-sm text-danger" role="alert">{gradeError}</p>}
            <SaveStatus saving={saving} error={saveError} onRetry={retrySave} />
          </div>
        ) : exercise.answer_type === "guided" ? (
          <div className="mt-6">
            <GuidedExercise
              key={exercise.exercise_id}
              exercise={exercise}
              onGrade={gradeGuidedAnswer}
              onNext={handleNext}
              nextLabel={isLastExercise ? "See Results" : "Next Exercise"}
            />
            {gradeError && <p className="mt-3 text-sm text-danger" role="alert">{gradeError}</p>}
            <SaveStatus saving={saving} error={saveError} onRetry={retrySave} />
          </div>
        ) : (
          <>
            <div className="mt-6 overflow-hidden rounded-lg border border-line bg-surface p-2 sm:p-3">
              {exercise.answer_type === "zone" ? (
                <CandlestickChart
                  answerType="zone"
                  candles={exercise.candles}
                  interactive={result === null && !grading}
                  userRegion={userRegion}
                  onUserRegionChange={setUserRegion}
                  correctZone={reveal?.zone ?? null}
                />
              ) : exercise.answer_type === "level" ? (
                <CandlestickChart
                  answerType="level"
                  candles={exercise.candles}
                  interactive={result === null && !grading}
                  userLevel={userLevel}
                  onUserLevelChange={setUserLevel}
                  correctLevel={reveal?.level ?? null}
                />
              ) : (
                <CandlestickChart
                  answerType="choice"
                  candles={exercise.candles}
                  interactive={false}
                  fvgZone={exercise.fvg_zone ?? undefined}
                  dealingRange={exercise.dealing_range ?? undefined}
                  showEquilibrium={result !== null}
                />
              )}
            </div>

            <SaveStatus saving={saving} error={saveError} onRetry={retrySave} />

            <div className="mt-5">
              {gradeError ? (
                <div role="alert">
                  <p className="text-sm text-danger">{gradeError}</p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {pendingAnswer && (
                      <button type="button" onClick={retryGrade} className="btn-primary">
                        Try again
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleNext}
                      className={pendingAnswer ? "btn-secondary" : "btn-primary"}
                    >
                      Skip this exercise
                    </button>
                  </div>
                </div>
              ) : grading ? (
                <p className="text-sm text-muted" role="status">
                  Grading…
                </p>
              ) : result ? (
                <FeedbackPanel
                  result={result}
                  onNext={handleNext}
                  nextLabel={isLastExercise ? "See Results" : "Next Exercise"}
                />
              ) : exercise.answer_type === "choice" ? (
                <ChoiceControls
                  options={exercise.options}
                  selected={userChoice}
                  onSelect={setUserChoice}
                  onSubmit={handleSubmit}
                  canSubmit={canSubmit}
                />
              ) : (
                <ExerciseControls
                  hint={
                    exercise.answer_type === "zone"
                      ? "Drag on the chart to draw a box around your answer."
                      : "Click the chart to place a line. Drag to adjust it."
                  }
                  canSubmit={canSubmit}
                  onSubmit={handleSubmit}
                  onNoAnswer={handleNoAnswer}
                  noAnswerLabel={exercise.noAnswerLabel}
                />
              )}
            </div>
          </>
        )}
      </div>

      <DisclaimerFooter />
    </div>
  );
}
