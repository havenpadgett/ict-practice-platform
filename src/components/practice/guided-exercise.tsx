"use client";

import { useState } from "react";
import { CandlestickChart } from "@/components/practice/candlestick-chart";
import { GuidedBiasControls } from "@/components/practice/guided-bias-controls";
import { GuidedFeedback } from "@/components/practice/guided-feedback";
import { GuidedLevelControls } from "@/components/practice/guided-level-controls";
import type { GuidedBias, GuidedExercise as GuidedExerciseData } from "@/data/exercises";
import { computeAchievedRR, gradeGuidedAttempt, type GuidedGradeResult, type GuidedUserAnswer } from "@/lib/guided-grading";

type Step = "bias" | "entry" | "stop" | "target" | "done";

export function GuidedExercise({
  exercise,
  onGraded,
  onNext,
  nextLabel,
}: {
  exercise: GuidedExerciseData;
  /** Fired the instant the attempt is finalized (Submit Setup or No Trade
   * at any step) — the parent records it the same way it does for every
   * other answer type, independent of when "Next" is eventually pressed. */
  onGraded: (answer: GuidedUserAnswer, grade: GuidedGradeResult) => void;
  onNext: () => void;
  nextLabel: string;
}) {
  const [step, setStep] = useState<Step>("bias");
  const [bias, setBias] = useState<GuidedBias | null>(null);
  const [entry, setEntry] = useState<number | null>(null);
  const [stop, setStop] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [result, setResult] = useState<GuidedGradeResult | null>(null);

  function finalize(declaredTrade: boolean) {
    if (bias === null) return;
    const answer: GuidedUserAnswer = { bias, entry, stop, target, declaredTrade };
    const grade = gradeGuidedAttempt(exercise, answer);
    setResult(grade);
    setStep("done");
    onGraded(answer, grade);
  }

  function handleContinueFromBias() {
    if (bias === null) return;
    // Unclear has no direction to build entry/stop/target against — it's
    // functionally a No Trade call the moment it's confirmed.
    if (bias === "unclear") {
      finalize(false);
      return;
    }
    setStep("entry");
  }

  const liveRR =
    step === "target" && bias !== null && entry !== null && stop !== null && target !== null
      ? computeAchievedRR(bias, entry, stop, target)
      : null;

  const interactive = step !== "done";
  const activeField = step === "entry" || step === "stop" || step === "target" ? step : null;

  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-line bg-surface p-2 sm:p-3">
        <CandlestickChart
          answerType="guided"
          candles={exercise.candles}
          interactive={interactive}
          entryPrice={entry}
          stopPrice={stop}
          targetPrice={target}
          activeField={interactive ? activeField : null}
          onActiveFieldChange={(price) => {
            if (step === "entry") setEntry(price);
            else if (step === "stop") setStop(price);
            else if (step === "target") setTarget(price);
          }}
          correctEntry={step === "done" ? exercise.answer.entry?.price ?? null : null}
          correctStop={step === "done" ? exercise.answer.stop?.price ?? null : null}
          correctTarget={step === "done" ? exercise.answer.target?.price ?? null : null}
        />
      </div>

      <div className="mt-5">
        {step === "bias" && (
          <GuidedBiasControls
            selected={bias}
            onSelect={setBias}
            onContinue={handleContinueFromBias}
            onNoTrade={() => finalize(false)}
          />
        )}
        {step === "entry" && (
          <GuidedLevelControls
            step="entry"
            price={entry}
            onContinue={() => setStep("stop")}
            onNoTrade={() => finalize(false)}
            liveRR={null}
            minRR={exercise.answer.min_rr}
          />
        )}
        {step === "stop" && (
          <GuidedLevelControls
            step="stop"
            price={stop}
            onContinue={() => setStep("target")}
            onNoTrade={() => finalize(false)}
            liveRR={null}
            minRR={exercise.answer.min_rr}
          />
        )}
        {step === "target" && (
          <GuidedLevelControls
            step="target"
            price={target}
            onContinue={() => finalize(true)}
            onNoTrade={() => finalize(false)}
            liveRR={liveRR}
            minRR={exercise.answer.min_rr}
          />
        )}
        {step === "done" && result && (
          <GuidedFeedback result={result} onNext={onNext} nextLabel={nextLabel} />
        )}
      </div>
    </div>
  );
}
