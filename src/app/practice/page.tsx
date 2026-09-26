"use client";

import { useEffect, useRef, useState } from "react";
import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { LoadingState } from "@/components/loading-state";
import { CandlestickChart } from "@/components/practice/candlestick-chart";
import { ChoiceControls } from "@/components/practice/choice-controls";
import { ConceptPicker } from "@/components/practice/concept-picker";
import { ExerciseControls } from "@/components/practice/exercise-controls";
import { FeedbackPanel } from "@/components/practice/feedback-panel";
import { FreeTradeExercise, type FreeTradeAttempt } from "@/components/practice/free-trade-exercise";
import { GuidedExercise } from "@/components/practice/guided-exercise";
import { SessionLengthPicker } from "@/components/practice/session-length-picker";
import { SessionSummary } from "@/components/practice/session-summary";
import { SaveStatus } from "@/components/save-status";
import {
  buildSessionExerciseIds,
  getExercise,
  isPracticeReady,
  type FreeTradeExercise as FreeTradeExerciseData,
  type GuidedExercise as GuidedExerciseData,
  type SessionLength,
} from "@/data/exercises";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { buildAnswerAttempt, buildFreeTradeAttempt, buildGuidedAttempt } from "@/lib/attempt-rows";
import { DASHBOARD_COLUMNS, fetchAttempts, insertAttempt, nextAttemptNumber, type NewAttempt } from "@/lib/attempts";
import { describeError, type FriendlyError } from "@/lib/errors";
import { modeFor, track, type SessionSource } from "@/lib/events";
import { CONCEPT_LIST, getConceptMeta, type Concept } from "@/lib/concepts";
import { gradeAttempt, type GradeResult, type UserAnswer, type UserRegion } from "@/lib/grading";
import type { FreeTradeGradeResult } from "@/lib/free-trade-grading";
import type { GuidedGradeResult, GuidedUserAnswer } from "@/lib/guided-grading";
import { recordSessionCompletion } from "@/lib/profiles";
import { buildAdaptiveSession } from "@/lib/recommendations";
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<FriendlyError | null>(null);
  /** The last attempt row that failed to save, so it can be retried. */
  const pendingRowRef = useRef<NewAttempt | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [adaptiveError, setAdaptiveError] = useState<string | null>(null);
  const exerciseStartRef = useRef<number>(0);


  // Reset the response-time clock whenever a new exercise becomes active.
  useEffect(() => {
    exerciseStartRef.current = Date.now();
  }, [session?.session_id, session?.current_index]);

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
      // The engine works from the lightweight catalog; confirm each pick
      // against the full data in case the catalog is stale.
      const ids = buildAdaptiveSession(await fetchAttempts(user.id, DASHBOARD_COLUMNS)).filter((id) => {
        const e = getExercise(id);
        return e !== undefined && isPracticeReady(e);
      });
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
  const exercise = getExercise(exerciseId);
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
    exercise.answer_type === "zone"
      ? userRegion !== null
      : exercise.answer_type === "level"
        ? userLevel !== null
        : userChoice !== null;

  // Saving is the only async step. A failure keeps the built row so "Retry
  // save" can resend it; session progress never depends on it.
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

  // Grading happens synchronously and the verdict shows immediately — only
  // *saving* the attempt is async, so a slow or failed network write never
  // blocks the user from seeing their result or moving on. Session progress
  // (local, not the database write) still advances either way; saveError
  // surfaces a failed save without losing the user's place.
  async function recordAttempt(answer: UserAnswer, grade: GradeResult) {
    if (!session || !user) return;

    // Session progress is local bookkeeping, independent of whether the
    // Supabase write below succeeds — update it synchronously, before the
    // async save starts, so there's no window where clicking "Next
    // Exercise" mid-save could race with this and overwrite newer state
    // with a stale snapshot.
    const updatedSession: SessionState = {
      ...session,
      correct_count: session.correct_count + (grade.isCorrect ? 1 : 0),
      missed_exercise_ids: grade.isCorrect
        ? session.missed_exercise_ids
        : [...session.missed_exercise_ids, exercise!.exercise_id],
    };
    saveSession(updatedSession);
    setSession(updatedSession);

    const responseTimeMs = msSince(exerciseStartRef.current);

    await saveAttempt(user.id, exercise!.exercise_id, (attemptNumber) =>
      buildAnswerAttempt(exercise!, answer, grade, { sessionId: session.session_id, responseTimeMs, attemptNumber }),
    );
  }

  // Guided Entry's multi-step flow finalizes itself (Submit Setup or No
  // Trade at any step) and calls this once, in place of handleSubmit /
  // handleNoAnswer — session bookkeeping and the Supabase write follow the
  // same shape as recordAttempt above, just with guided's own fields.
  async function recordGuidedAttempt(answer: GuidedUserAnswer, grade: GuidedGradeResult) {
    if (!session || !user || exercise!.answer_type !== "guided") return;

    const updatedSession: SessionState = {
      ...session,
      correct_count: session.correct_count + (grade.isCorrect ? 1 : 0),
      missed_exercise_ids: grade.isCorrect
        ? session.missed_exercise_ids
        : [...session.missed_exercise_ids, exercise!.exercise_id],
    };
    saveSession(updatedSession);
    setSession(updatedSession);

    const responseTimeMs = msSince(exerciseStartRef.current);


    await saveAttempt(user.id, exercise!.exercise_id, (attemptNumber) =>
      buildGuidedAttempt(exercise! as GuidedExerciseData, answer, grade, { sessionId: session.session_id, responseTimeMs, attemptNumber }),
    );
  }

  // Free Trade's playback runner grades itself when the scenario ends
  // (trade closed, End Session, or playback ran out) and calls this once —
  // same shape as recordGuidedAttempt. is_correct is the process verdict,
  // never the win/loss outcome.
  async function recordFreeTradeAttempt(attempt: FreeTradeAttempt, grade: FreeTradeGradeResult) {
    if (!session || !user || exercise!.answer_type !== "free") return;

    const updatedSession: SessionState = {
      ...session,
      correct_count: session.correct_count + (grade.passed ? 1 : 0),
      missed_exercise_ids: grade.passed
        ? session.missed_exercise_ids
        : [...session.missed_exercise_ids, exercise!.exercise_id],
    };
    saveSession(updatedSession);
    setSession(updatedSession);

    const responseTimeMs = msSince(exerciseStartRef.current);
    const { position, exit } = attempt;

    await saveAttempt(user.id, exercise!.exercise_id, (attemptNumber) =>
      buildFreeTradeAttempt(exercise! as FreeTradeExerciseData, position, exit, grade, { sessionId: session.session_id, responseTimeMs, attemptNumber }),
    );
  }

  async function handleSubmit() {
    if (exercise!.answer_type === "zone" && !userRegion) return;
    if (exercise!.answer_type === "level" && userLevel === null) return;
    if (exercise!.answer_type === "choice" && userChoice === null) return;
    const answer: UserAnswer =
      exercise!.answer_type === "zone"
        ? { type: "region", region: userRegion! }
        : exercise!.answer_type === "level"
          ? { type: "level", price: userLevel! }
          : { type: "choice", choice: userChoice! };
    const grade = safeGrade(answer);
    if (!grade) return;
    setResult(grade);
    await recordAttempt(answer, grade);
  }

  /** Grading throws on malformed exercise data; show that instead of
   * silently doing nothing. */
  function safeGrade(answer: UserAnswer): GradeResult | null {
    try {
      return gradeAttempt(exercise!, answer);
    } catch (err) {
      setGradeError(`This exercise couldn't be graded (${err instanceof Error ? err.message : "bad data"}).`);
      return null;
    }
  }

  async function handleNoAnswer() {
    setUserRegion(null);
    setUserLevel(null);
    const answer: UserAnswer = { type: "none" };
    const grade = safeGrade(answer);
    if (!grade) return;
    setResult(grade);
    await recordAttempt(answer, grade);
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
    setSaveError(null);
    setGradeError(null);
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
              onGraded={recordFreeTradeAttempt}
              onNext={handleNext}
              nextLabel={isLastExercise ? "See Results" : "Next Scenario"}
            />
            <SaveStatus saving={saving} error={saveError} onRetry={retrySave} />
          </div>
        ) : exercise.answer_type === "guided" ? (
          <div className="mt-6">
            <GuidedExercise
              key={exercise.exercise_id}
              exercise={exercise}
              onGraded={recordGuidedAttempt}
              onNext={handleNext}
              nextLabel={isLastExercise ? "See Results" : "Next Exercise"}
            />
            <SaveStatus saving={saving} error={saveError} onRetry={retrySave} />
          </div>
        ) : (
          <>
            <div className="mt-6 overflow-hidden rounded-lg border border-line bg-surface p-2 sm:p-3">
              {exercise.answer_type === "zone" ? (
                <CandlestickChart
                  answerType="zone"
                  candles={exercise.candles}
                  interactive={result === null}
                  userRegion={userRegion}
                  onUserRegionChange={setUserRegion}
                  correctZone={result?.revealZone ? exercise.answer : null}
                />
              ) : exercise.answer_type === "level" ? (
                <CandlestickChart
                  answerType="level"
                  candles={exercise.candles}
                  interactive={result === null}
                  userLevel={userLevel}
                  onUserLevelChange={setUserLevel}
                  correctLevel={result?.revealZone ? exercise.answer?.price ?? null : null}
                />
              ) : (
                <CandlestickChart
                  answerType="choice"
                  candles={exercise.candles}
                  interactive={false}
                  fvgZone={exercise.answer.fvg_zone}
                  dealingRange={exercise.answer.dealing_range}
                  showEquilibrium={result !== null}
                />
              )}
            </div>

            <SaveStatus saving={saving} error={saveError} onRetry={retrySave} />

            <div className="mt-5">
              {gradeError ? (
                <div role="alert">
                  <p className="text-sm text-danger">{gradeError}</p>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="mt-3 btn-primary"
                  >
                    Skip this exercise
                  </button>
                </div>
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
