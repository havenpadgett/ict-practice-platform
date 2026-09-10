"use client";

import { useEffect, useRef, useState } from "react";
import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { CandlestickChart } from "@/components/practice/candlestick-chart";
import { ConceptPicker } from "@/components/practice/concept-picker";
import { ExerciseControls } from "@/components/practice/exercise-controls";
import { FeedbackPanel } from "@/components/practice/feedback-panel";
import { SessionSummary } from "@/components/practice/session-summary";
import { getExercise, getExerciseIdsByConcept } from "@/data/exercises";
import { CONCEPTS, type Concept } from "@/lib/concepts";
import { gradeAttempt, type GradeResult, type UserAnswer, type UserRegion } from "@/lib/grading";
import {
  appendAttempt,
  clearSession,
  createAttemptId,
  createSession,
  loadAttempts,
  loadSession,
  nextAttemptNumber,
  saveSession,
  type SessionState,
} from "@/lib/storage";

export default function PracticePage() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [userRegion, setUserRegion] = useState<UserRegion | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const exerciseStartRef = useRef<number>(0);

  // Resume an in-progress (or just-completed) session from a prior visit;
  // show the concept picker if there's none yet. Either way this is a
  // one-time sync from a browser-only store (localStorage isn't available
  // during SSR) and can't be done in render, so the setState-in-effect here
  // is intentional.
  useEffect(() => {
    const existing = loadSession();
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSession(existing);
    } else {
      setShowPicker(true);
    }
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
    setResult(null);
  }

  function handleBackToPicker() {
    clearSession();
    setSession(null);
    setShowPicker(true);
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

  const conceptMeta = CONCEPTS[session.concept as Concept];

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

  function recordAttempt(answer: UserAnswer, grade: GradeResult) {
    if (!session) return;
    const responseTimeMs = Date.now() - exerciseStartRef.current;
    const isRegion = answer.type === "region";

    appendAttempt({
      attempt_id: createAttemptId(),
      session_id: session.session_id,
      exercise_id: exercise!.exercise_id,
      concept: exercise!.concept,
      user_answer_type: answer.type,
      user_price_low: isRegion ? answer.region.priceLow : null,
      user_price_high: isRegion ? answer.region.priceHigh : null,
      user_candle_start: isRegion ? answer.region.candleIndexLow : null,
      user_candle_end: isRegion ? answer.region.candleIndexHigh : null,
      is_correct: grade.isCorrect,
      coverage: grade.coverage,
      precision_ratio: grade.precisionRatio,
      failure_reason: grade.failureReason,
      response_time_ms: responseTimeMs,
      attempt_number: nextAttemptNumber(loadAttempts(), exercise!.exercise_id),
      timestamp: new Date().toISOString(),
    });

    const updatedSession: SessionState = {
      ...session,
      correct_count: session.correct_count + (grade.isCorrect ? 1 : 0),
      missed_exercise_ids: grade.isCorrect
        ? session.missed_exercise_ids
        : [...session.missed_exercise_ids, exercise!.exercise_id],
    };
    saveSession(updatedSession);
    setSession(updatedSession);
  }

  function handleSubmit() {
    if (!userRegion) return;
    const answer: UserAnswer = { type: "region", region: userRegion };
    const grade = gradeAttempt(exercise!, answer);
    setResult(grade);
    recordAttempt(answer, grade);
  }

  function handleNoZone() {
    setUserRegion(null);
    const answer: UserAnswer = { type: "none" };
    const grade = gradeAttempt(exercise!, answer);
    setResult(grade);
    recordAttempt(answer, grade);
  }

  function handleNext() {
    if (!session) return;
    const nextIndex = session.current_index + 1;
    const completed = nextIndex >= session.exercise_order.length;
    const updatedSession: SessionState = { ...session, current_index: nextIndex, completed };
    saveSession(updatedSession);
    setSession(updatedSession);
    setUserRegion(null);
    setResult(null);
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
          <CandlestickChart
            candles={exercise.candles}
            interactive={result === null}
            userRegion={userRegion}
            onUserRegionChange={setUserRegion}
            correctZone={result?.revealZone ? exercise.answer : null}
          />
        </div>

        <div className="mt-5">
          {result ? (
            <FeedbackPanel
              result={result}
              onNext={handleNext}
              nextLabel={isLastExercise ? "See Results" : "Next Exercise"}
            />
          ) : (
            <ExerciseControls
              canSubmit={userRegion !== null}
              onSubmit={handleSubmit}
              onNoZone={handleNoZone}
              noZoneLabel={conceptMeta.noZoneLabel}
            />
          )}
        </div>
      </div>

      <DisclaimerFooter />
    </div>
  );
}
