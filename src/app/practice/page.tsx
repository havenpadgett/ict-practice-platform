"use client";

import { useEffect, useRef, useState } from "react";
import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { LoadingState } from "@/components/loading-state";
import { CandlestickChart } from "@/components/practice/candlestick-chart";
import { ConceptPicker } from "@/components/practice/concept-picker";
import { ExerciseControls } from "@/components/practice/exercise-controls";
import { FeedbackPanel } from "@/components/practice/feedback-panel";
import { SessionSummary } from "@/components/practice/session-summary";
import { getExercise, getExerciseIdsByConcept } from "@/data/exercises";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { insertAttempt, nextAttemptNumber } from "@/lib/attempts";
import { CONCEPT_LIST, getConceptMeta, type Concept } from "@/lib/concepts";
import { gradeAttempt, type GradeResult, type UserAnswer, type UserRegion } from "@/lib/grading";
import {
  clearSession,
  createSession,
  loadSession,
  saveSession,
  type SessionState,
} from "@/lib/storage";

export default function PracticePage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [session, setSession] = useState<SessionState | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [userRegion, setUserRegion] = useState<UserRegion | null>(null);
  const [userLevel, setUserLevel] = useState<number | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const exerciseStartRef = useRef<number>(0);

  // Resume an in-progress (or just-completed) session from a prior visit;
  // otherwise honor a ?concept= deep link (e.g. from the analytics page's
  // "recommended next practice" link) by starting that concept directly;
  // otherwise show the concept picker. Reading localStorage/location is a
  // one-time sync from browser-only state (neither is available during
  // SSR) and can't be done in render, so the setState-in-effect here is
  // intentional.
  useEffect(() => {
    const existing = loadSession();
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSession(existing);
      return;
    }
    const requestedConcept = new URLSearchParams(window.location.search).get("concept");
    if (requestedConcept && CONCEPT_LIST.includes(requestedConcept as Concept)) {
      handlePickConcept(requestedConcept as Concept);
      return;
    }
    setShowPicker(true);
  }, []);

  // Reset the response-time clock whenever a new exercise becomes active.
  useEffect(() => {
    exerciseStartRef.current = Date.now();
  }, [session?.session_id, session?.current_index]);

  function handlePickConcept(concept: Concept) {
    const fresh = createSession(concept, getExerciseIdsByConcept(concept));
    saveSession(fresh);
    setSession(fresh);
    setShowPicker(false);
    setUserRegion(null);
    setUserLevel(null);
    setResult(null);
  }

  function handleBackToPicker() {
    clearSession();
    setSession(null);
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
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
          <ConceptPicker onPick={handlePickConcept} />
        </div>
        <DisclaimerFooter />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-10 pb-16 sm:px-6 sm:pt-14" />
        <DisclaimerFooter />
      </div>
    );
  }

  const conceptMeta = getConceptMeta(session.concept);

  if (session.completed) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
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
    throw new Error(`Missing exercise ${exerciseId}`);
  }

  const attemptedCount = session.correct_count + session.missed_exercise_ids.length;
  const isLastExercise = session.current_index === session.exercise_order.length - 1;
  const canSubmit = exercise.answer_type === "zone" ? userRegion !== null : userLevel !== null;

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

    setSaving(true);
    setSaveError(null);
    const responseTimeMs = Date.now() - exerciseStartRef.current;
    const isRegion = answer.type === "region";
    const isLevel = answer.type === "level";

    try {
      const attemptNumber = await nextAttemptNumber(user.id, exercise!.exercise_id);
      await insertAttempt(user.id, {
        exercise_id: exercise!.exercise_id,
        concept: exercise!.concept,
        answer_type: exercise!.answer_type,
        user_answer_type: answer.type,
        user_price_low: isRegion ? answer.region.priceLow : null,
        user_price_high: isRegion ? answer.region.priceHigh : null,
        user_candle_start: isRegion ? answer.region.candleIndexLow : null,
        user_candle_end: isRegion ? answer.region.candleIndexHigh : null,
        user_price: isLevel ? answer.price : null,
        distance_from_level: grade.distanceFromLevel,
        is_correct: grade.isCorrect,
        coverage: grade.coverage,
        precision_ratio: grade.precisionRatio,
        failure_reason: grade.failureReason,
        response_time_ms: responseTimeMs,
        attempt_number: attemptNumber,
      });
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Couldn't save this attempt — your progress in this session is unaffected.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (exercise!.answer_type === "zone" && !userRegion) return;
    if (exercise!.answer_type === "level" && userLevel === null) return;
    const answer: UserAnswer =
      exercise!.answer_type === "zone"
        ? { type: "region", region: userRegion! }
        : { type: "level", price: userLevel! };
    const grade = gradeAttempt(exercise!, answer);
    setResult(grade);
    await recordAttempt(answer, grade);
  }

  async function handleNoAnswer() {
    setUserRegion(null);
    setUserLevel(null);
    const answer: UserAnswer = { type: "none" };
    const grade = gradeAttempt(exercise!, answer);
    setResult(grade);
    await recordAttempt(answer, grade);
  }

  function handleNext() {
    if (!session) return;
    const nextIndex = session.current_index + 1;
    const completed = nextIndex >= session.exercise_order.length;
    const updatedSession: SessionState = { ...session, current_index: nextIndex, completed };
    saveSession(updatedSession);
    setSession(updatedSession);
    setUserRegion(null);
    setUserLevel(null);
    setResult(null);
    setSaveError(null);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {conceptMeta.title}
          </h1>
          <p className="text-sm text-muted">
            Exercise {session.current_index + 1} of {session.exercise_order.length} · Score{" "}
            {session.correct_count}/{attemptedCount}
          </p>
        </div>
        <p className="mt-2 text-sm text-muted">{exercise.prompt}</p>

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
          ) : (
            <CandlestickChart
              answerType="level"
              candles={exercise.candles}
              interactive={result === null}
              userLevel={userLevel}
              onUserLevelChange={setUserLevel}
              correctLevel={result?.revealZone ? exercise.answer?.price ?? null : null}
            />
          )}
        </div>

        {saving && <p className="mt-3 text-xs text-muted">Saving…</p>}
        {saveError && (
          <p className="mt-3 text-xs" style={{ color: "#e2685f" }}>
            {saveError}
          </p>
        )}

        <div className="mt-5">
          {result ? (
            <FeedbackPanel
              result={result}
              onNext={handleNext}
              nextLabel={isLastExercise ? "See Results" : "Next Exercise"}
            />
          ) : (
            <ExerciseControls
              canSubmit={canSubmit}
              onSubmit={handleSubmit}
              onNoAnswer={handleNoAnswer}
              noAnswerLabel={exercise.noAnswerLabel}
            />
          )}
        </div>
      </div>

      <DisclaimerFooter />
    </div>
  );
}
