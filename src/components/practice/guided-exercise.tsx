"use client";

import { useState } from "react";
import { CandlestickChart } from "@/components/practice/candlestick-chart";
import { GuidedBiasControls } from "@/components/practice/guided-bias-controls";
import { GuidedFeedback } from "@/components/practice/guided-feedback";
import { GuidedLevelControls } from "@/components/practice/guided-level-controls";
import type { GuidedBias } from "@/data/exercises";
import { computeAchievedRR, type GuidedGradeResult, type GuidedUserAnswer } from "@/lib/guided-grading";
import type { PublicGuidedExercise } from "@/lib/public-exercise";

export type GuidedGradeResponse = {
  grade: GuidedGradeResult;
  reveal: { entry: number | null; stop: number | null; target: number | null };
};

type Step = "bias" | "entry" | "stop" | "target" | "done";

export function GuidedExercise({
  exercise,
  onGrade,
  onNext,
  nextLabel,
}: {
  exercise: PublicGuidedExercise;
  /** Called the instant the attempt is finalized (Submit Setup or No Trade
   * at any step). The parent grades it on the server and records it; null
   * means grading failed and the parent is showing why. */
  onGrade: (answer: GuidedUserAnswer) => Promise<GuidedGradeResponse | null>;
  onNext: () => void;
  nextLabel: string;
}) {
  const [step, setStep] = useState<Step>("bias");
  const [bias, setBias] = useState<GuidedBias | null>(null);
  const [entry, setEntry] = useState<number | null>(null);
  const [stop, setStop] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [graded, setGraded] = useState<GuidedGradeResponse | null>(null);
  const [grading, setGrading] = useState(false);
  const [pending, setPending] = useState<GuidedUserAnswer | null>(null);

  async function submit(answer: GuidedUserAnswer) {
    setGrading(true);
    setPending(answer);
    const res = await onGrade(answer);
    setGrading(false);
    if (res) {
      setGraded(res);
      setPending(null);
      setStep("done");
    }
  }

  function finalize(declaredTrade: boolean) {
    if (bias === null || grading) return;
    void submit({ bias, entry, stop, target, declaredTrade });
  }
  const result = graded?.grade ?? null;

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

  const interactive = step !== "done" && !grading && pending === null;
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
          correctEntry={graded?.reveal.entry ?? null}
          correctStop={graded?.reveal.stop ?? null}
          correctTarget={graded?.reveal.target ?? null}
        />
      </div>

      <div className="mt-5">
        {(grading || pending) && step !== "done" ? (
          grading ? (
            <p className="text-sm text-muted" role="status">Grading…</p>
          ) : (
            <button type="button" onClick={() => pending && void submit(pending)} className="btn-primary">
              Try grading again
            </button>
          )
        ) : null}
        {!grading && !pending && step === "bias" && (
          <GuidedBiasControls
            selected={bias}
            onSelect={setBias}
            onContinue={handleContinueFromBias}
            onNoTrade={() => finalize(false)}
          />
        )}
        {!grading && !pending && step === "entry" && (
          <GuidedLevelControls
            step="entry"
            price={entry}
            onContinue={() => setStep("stop")}
            onNoTrade={() => finalize(false)}
            liveRR={null}
            minRR={exercise.min_rr}
          />
        )}
        {!grading && !pending && step === "stop" && (
          <GuidedLevelControls
            step="stop"
            price={stop}
            onContinue={() => setStep("target")}
            onNoTrade={() => finalize(false)}
            liveRR={null}
            minRR={exercise.min_rr}
          />
        )}
        {!grading && !pending && step === "target" && (
          <GuidedLevelControls
            step="target"
            price={target}
            onContinue={() => finalize(true)}
            onNoTrade={() => finalize(false)}
            liveRR={liveRR}
            minRR={exercise.min_rr}
          />
        )}
        {step === "done" && result && (
          <GuidedFeedback result={result} onNext={onNext} nextLabel={nextLabel} />
        )}
      </div>
    </div>
  );
}
