"use client";

import { useState } from "react";
import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { CandlestickChart } from "@/components/practice/candlestick-chart";
import { ExerciseControls } from "@/components/practice/exercise-controls";
import { FeedbackPanel } from "@/components/practice/feedback-panel";
import { getExercise, type Exercise } from "@/data/exercises";
import { gradeAttempt, type GradeResult, type UserRegion } from "@/lib/grading";

function requireExercise(exerciseId: string): Exercise {
  const exercise = getExercise(exerciseId);
  if (!exercise) {
    throw new Error(`Missing exercise ${exerciseId}`);
  }
  return exercise;
}

const exercise = requireExercise("fvg-001");

export default function PracticePage() {
  const [userRegion, setUserRegion] = useState<UserRegion | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);

  function handleSubmit() {
    if (!userRegion) return;
    setResult(gradeAttempt(exercise, { type: "region", region: userRegion }));
  }

  function handleNoFvg() {
    setUserRegion(null);
    setResult(gradeAttempt(exercise, { type: "none" }));
  }

  function handleTryAgain() {
    setUserRegion(null);
    setResult(null);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          FVG Practice
        </h1>
        <p className="mt-2 text-sm text-muted">Mark the Fair Value Gap.</p>

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
            <FeedbackPanel result={result} onTryAgain={handleTryAgain} />
          ) : (
            <ExerciseControls
              canSubmit={userRegion !== null}
              onSubmit={handleSubmit}
              onNoFvg={handleNoFvg}
            />
          )}
        </div>
      </div>

      <DisclaimerFooter />
    </div>
  );
}
