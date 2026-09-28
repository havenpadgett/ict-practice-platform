"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { LoadingState } from "@/components/loading-state";
import { RecognitionExercise, type RecognitionReveal } from "@/components/practice/recognition-exercise";
import { useAuth } from "@/contexts/auth-context";
import { conceptShortName, DIFFICULTY_LABELS } from "@/lib/concepts";
import { describeError } from "@/lib/errors";
import type { GradeResult, UserAnswer, UserRegion } from "@/lib/grading";
import type { PublicLevelExercise, PublicZoneExercise } from "@/lib/public-exercise";
import { appendLocalAttempt } from "@/lib/storage";
import { gradeSample, loadSample } from "@/app/try/actions";

type Sample = PublicZoneExercise | PublicLevelExercise;

function newId(prefix: string): string {
  return `${prefix}_${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Date.now().toString(36)}`;
}

/** Three graded charts without an account. Answers are kept on this device
 * only, and offered for saving on the dashboard after sign-up. */
export default function TryPage() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Sample[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [region, setRegion] = useState<UserRegion | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const [reveal, setReveal] = useState<RecognitionReveal | null>(null);
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [correct, setCorrect] = useState(0);
  const sessionId = useRef(newId("sample"));
  const startedAt = useRef(0);

  useEffect(() => {
    loadSample()
      .then(setExercises)
      .catch((err) => setLoadError(describeError(err, "load the sample").message));
  }, []);

  useEffect(() => {
    startedAt.current = Date.now();
  }, [index]);

  const done = exercises !== null && index >= exercises.length;
  const exercise = exercises && !done ? exercises[index] : null;

  async function submit(answer: UserAnswer) {
    if (!exercise) return;
    setGrading(true);
    setGradeError(null);
    try {
      const res = await gradeSample(exercise.exercise_id, answer);
      if (!res.ok) {
        setGradeError(res.error);
        return;
      }
      setResult(res.grade);
      setReveal(res.reveal);
      if (retrying) return;
      if (res.grade.isCorrect) setCorrect((c) => c + 1);
      // Signed in already: nothing to carry over.
      if (user) return;
      // Kept on this device for the sign-up migration (StoredAttempt).
      appendLocalAttempt({
        attempt_id: newId("attempt"),
        session_id: sessionId.current,
        exercise_id: exercise.exercise_id,
        concept: exercise.concept,
        user_answer_type: answer.type === "region" ? "region" : answer.type === "level" ? "level" : "none",
        user_price_low: answer.type === "region" ? answer.region.priceLow : null,
        user_price_high: answer.type === "region" ? answer.region.priceHigh : null,
        user_candle_start: answer.type === "region" ? answer.region.candleIndexLow : null,
        user_candle_end: answer.type === "region" ? answer.region.candleIndexHigh : null,
        user_price: answer.type === "level" ? answer.price : null,
        distance_from_level: res.grade.distanceFromLevel,
        is_correct: res.grade.isCorrect,
        coverage: res.grade.coverage,
        precision_ratio: res.grade.precisionRatio,
        failure_reason: res.grade.failureReason,
        response_time_ms: Date.now() - startedAt.current,
        attempt_number: 1,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      setGradeError(describeError(err, "grade this answer").message);
    } finally {
      setGrading(false);
    }
  }

  function next() {
    setIndex((i) => i + 1);
    setRegion(null);
    setLevel(null);
    setResult(null);
    setReveal(null);
    setGradeError(null);
    setRetrying(false);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="page max-w-7xl pt-6 sm:pt-8">
        {loadError ? (
          <p className="text-error" role="alert">
            {loadError}
          </p>
        ) : exercises === null ? (
          <LoadingState />
        ) : done ? (
          <div className="max-w-xl">
            <h1 className="eyebrow">Sample complete</h1>
            <p className="mt-3 text-5xl font-semibold tracking-tight text-foreground tabular-nums">
              {correct}
              <span className="text-muted">/{exercises.length}</span>
            </p>
            <p className="mt-4 text-base text-foreground">
              That&apos;s the loop: mark it, get graded against a written rule, see exactly where you were off.
            </p>
            <p className="mt-2 text-sm text-muted">
              With an account you get every concept, Guided Entry and Free Trade, a record of your mistakes, and a
              recommendation for what to practice next. These {exercises.length} answers are kept on this device and you
              can save them to your account after signing up.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <Link href="/dashboard" className="btn-primary">
                  Go to your dashboard
                </Link>
              ) : (
                <Link href="/login?mode=signup&next=/dashboard" className="btn-primary">
                  Create a free account
                </Link>
              )}
              <Link href="/" className="btn-secondary">
                Back to the overview
              </Link>
            </div>
          </div>
        ) : (
          exercise && (
            <>
              <div className="flex items-baseline justify-between gap-4">
                <h1 className="eyebrow">Sample · no account needed</h1>
                <p className="eyebrow tabular-nums">
                  {index + 1} / {exercises.length}
                </p>
              </div>
              <div
                className="mt-3 mb-6 h-0.5 overflow-hidden rounded-full bg-line"
                role="progressbar"
                aria-label="Sample progress"
                aria-valuemin={0}
                aria-valuemax={exercises.length}
                aria-valuenow={index}
              >
                <div className="h-full bg-accent transition-[width]" style={{ width: `${(index / exercises.length) * 100}%` }} />
              </div>
              <RecognitionExercise
                key={exercise.exercise_id}
                exercise={exercise}
                prompt={
                  <div>
                    <p className="text-lg leading-snug text-foreground sm:text-xl">{exercise.prompt}</p>
                    <p className="mt-1.5 text-xs text-muted">
                      {DIFFICULTY_LABELS[exercise.difficulty]} · {conceptShortName(exercise.concept)}
                    </p>
                  </div>
                }
                userRegion={region}
                onUserRegionChange={setRegion}
                userLevel={level}
                onUserLevelChange={setLevel}
                userChoice={null}
                onUserChoiceChange={() => {}}
                result={result}
                reveal={reveal}
                isRetry={retrying}
                grading={grading}
                gradeError={gradeError}
                canRetryGrade={false}
                onRetryGrade={() => {}}
                onSkip={next}
                onSubmit={() => {
                  if (exercise.answer_type === "zone" && region) void submit({ type: "region", region });
                  if (exercise.answer_type === "level" && level !== null) void submit({ type: "level", price: level });
                }}
                onNoAnswer={() => {
                  setRegion(null);
                  setLevel(null);
                  void submit({ type: "none" });
                }}
                onNext={next}
                nextLabel={index === exercises.length - 1 ? "See how you did" : "Next chart"}
                onRetryChart={() => {
                  setRetrying(true);
                  setResult(null);
                  setReveal(null);
                  setRegion(null);
                  setLevel(null);
                }}
                footer={null}
              />
            </>
          )
        )}
      </div>
      <DisclaimerFooter />
    </div>
  );
}
