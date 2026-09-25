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
import { buildSessionExerciseIds, getExercise, type SessionLength } from "@/data/exercises";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { fetchAttempts, insertAttempt, nextAttemptNumber, NULL_FREE_TRADE_FIELDS } from "@/lib/attempts";
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
  const [saveError, setSaveError] = useState<string | null>(null);
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

  function handleStartSession(concept: Concept, length: SessionLength, difficulty?: 1 | 2 | 3) {
    beginSession(concept, buildSessionExerciseIds(concept, length, difficulty));
  }

  async function handleStartAdaptive() {
    if (!user) return;
    setAdaptiveError(null);
    try {
      beginSession(ADAPTIVE_SESSION, buildAdaptiveSession(await fetchAttempts(user.id)));
    } catch (err) {
      setAdaptiveError(err instanceof Error ? err.message : "Couldn't load your history to build the session.");
    }
  }

  function beginSession(kind: string, exerciseIds: string[]) {
    const fresh = createSession(kind, exerciseIds);
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
      handleStartSession(requestedConcept as Concept, length, d === 1 || d === 2 || d === 3 ? d : undefined);
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
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
          <ConceptPicker onPick={handlePickConcept} onPickAdaptive={handleStartAdaptive} adaptiveError={adaptiveError} />
        </div>
        <DisclaimerFooter />
      </div>
    );
  }

  if (lengthPickerConcept) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
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
        <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-10 pb-16 sm:px-6 sm:pt-14" />
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
  const canSubmit =
    exercise.answer_type === "zone"
      ? userRegion !== null
      : exercise.answer_type === "level"
        ? userLevel !== null
        : userChoice !== null;

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
    const responseTimeMs = msSince(exerciseStartRef.current);
    const isRegion = answer.type === "region";
    const isLevel = answer.type === "level";
    const isChoice = answer.type === "choice";

    try {
      const attemptNumber = await nextAttemptNumber(user.id, exercise!.exercise_id);
      await insertAttempt(user.id, {
        exercise_id: exercise!.exercise_id,
        concept: exercise!.concept,
        difficulty: exercise!.difficulty,
        answer_type: exercise!.answer_type,
        user_answer_type: answer.type,
        user_price_low: isRegion ? answer.region.priceLow : null,
        user_price_high: isRegion ? answer.region.priceHigh : null,
        user_candle_start: isRegion ? answer.region.candleIndexLow : null,
        user_candle_end: isRegion ? answer.region.candleIndexHigh : null,
        user_price: isLevel ? answer.price : null,
        distance_from_level: grade.distanceFromLevel,
        user_choice: isChoice ? answer.choice : null,
        correct_choice: exercise!.answer_type === "choice" ? exercise!.answer.correct_choice : null,
        guided_bias_choice: null,
        guided_entry_price: null,
        guided_stop_price: null,
        guided_target_price: null,
        guided_bias_correct: null,
        guided_entry_correct: null,
        guided_stop_correct: null,
        guided_target_correct: null,
        guided_achieved_rr: null,
        guided_declared_trade: null,
        ...NULL_FREE_TRADE_FIELDS,
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

    setSaving(true);
    setSaveError(null);
    const responseTimeMs = msSince(exerciseStartRef.current);

    const stepResult = (step: "bias" | "entry" | "stop" | "target") =>
      grade.steps.find((s) => s.step === step)?.isCorrect ?? null;

    try {
      const attemptNumber = await nextAttemptNumber(user.id, exercise!.exercise_id);
      await insertAttempt(user.id, {
        exercise_id: exercise!.exercise_id,
        concept: exercise!.concept,
        difficulty: exercise!.difficulty,
        answer_type: "guided",
        user_answer_type: "guided",
        user_price_low: null,
        user_price_high: null,
        user_candle_start: null,
        user_candle_end: null,
        coverage: null,
        precision_ratio: null,
        user_price: null,
        distance_from_level: null,
        user_choice: null,
        correct_choice: null,
        guided_bias_choice: answer.bias,
        guided_entry_price: answer.entry,
        guided_stop_price: answer.stop,
        guided_target_price: answer.target,
        guided_bias_correct: stepResult("bias"),
        guided_entry_correct: stepResult("entry"),
        guided_stop_correct: stepResult("stop"),
        guided_target_correct: stepResult("target"),
        guided_achieved_rr: grade.achievedRR,
        guided_declared_trade: answer.declaredTrade,
        ...NULL_FREE_TRADE_FIELDS,
        is_correct: grade.isCorrect,
        failure_reason: null,
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

    setSaving(true);
    setSaveError(null);
    const responseTimeMs = msSince(exerciseStartRef.current);
    const { position, exit } = attempt;
    const checkResult = (id: FreeTradeGradeResult["checks"][number]["id"]) => {
      const status = grade.checks.find((c) => c.id === id)?.status;
      return status === "pass" ? true : status === "fail" ? false : null;
    };

    try {
      const attemptNumber = await nextAttemptNumber(user.id, exercise!.exercise_id);
      await insertAttempt(user.id, {
        exercise_id: exercise!.exercise_id,
        concept: exercise!.concept,
        difficulty: exercise!.difficulty,
        answer_type: "free",
        user_answer_type: "free",
        user_price_low: null,
        user_price_high: null,
        user_candle_start: null,
        user_candle_end: null,
        coverage: null,
        precision_ratio: null,
        user_price: null,
        distance_from_level: null,
        user_choice: null,
        correct_choice: null,
        guided_bias_choice: null,
        guided_entry_price: null,
        guided_stop_price: null,
        guided_target_price: null,
        guided_bias_correct: null,
        guided_entry_correct: null,
        guided_stop_correct: null,
        guided_target_correct: null,
        guided_achieved_rr: null,
        guided_declared_trade: null,
        free_direction: position?.direction ?? "none",
        free_entry_price: position?.entry ?? null,
        free_stop_price: position?.stop ?? null,
        free_target_price: position?.target ?? null,
        free_entry_candle_index: position?.entryIndex ?? null,
        free_exit_candle_index: exit?.index ?? null,
        free_exit_price: exit?.price ?? null,
        free_exit_reason: exit?.reason ?? null,
        free_rr: grade.rr,
        free_result_r: grade.resultR,
        free_outcome: grade.outcome,
        free_direction_correct: checkResult("direction"),
        free_entry_correct: checkResult("entry"),
        free_stop_correct: checkResult("stop"),
        free_rr_correct: checkResult("rr"),
        free_decision_correct: checkResult("decision"),
        is_correct: grade.passed,
        failure_reason: null,
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
    if (exercise!.answer_type === "choice" && userChoice === null) return;
    const answer: UserAnswer =
      exercise!.answer_type === "zone"
        ? { type: "region", region: userRegion! }
        : exercise!.answer_type === "level"
          ? { type: "level", price: userLevel! }
          : { type: "choice", choice: userChoice! };
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
    setUserChoice(null);
    setResult(null);
    setSaveError(null);
    // Best-effort, off the critical path — a failure here shouldn't block
    // showing the session summary (matching how ensureProfile is called).
    if (completed && user) {
      recordSessionCompletion(user.id).catch(() => {});
    }
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
            {session.correct_count}/{attemptedCount} · Difficulty {exercise.difficulty}/3
          </p>
        </div>
        {isAdaptive && <p className="eyebrow mt-3">{getConceptMeta(exercise.concept).pickerLabel}</p>}
        <p className="mt-2 text-sm text-muted">{exercise.prompt}</p>

        {exercise.answer_type === "free" ? (
          <div className="mt-6">
            <FreeTradeExercise
              key={exercise.exercise_id}
              exercise={exercise}
              onGraded={recordFreeTradeAttempt}
              onNext={handleNext}
              nextLabel={isLastExercise ? "See Results" : "Next Scenario"}
            />
            {saving && <p className="mt-3 text-xs text-muted">Saving…</p>}
            {saveError && (
              <p className="mt-3 text-xs" style={{ color: "#e2685f" }}>
                {saveError}
              </p>
            )}
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
            {saving && <p className="mt-3 text-xs text-muted">Saving…</p>}
            {saveError && (
              <p className="mt-3 text-xs" style={{ color: "#e2685f" }}>
                {saveError}
              </p>
            )}
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
