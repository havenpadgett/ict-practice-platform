"use client";

import { useEffect, useState, type ReactNode } from "react";
import { CandlestickChart } from "@/components/practice/candlestick-chart";
import { ChartFrame, ExerciseLayout } from "@/components/practice/exercise-layout";
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

/** What's autosaved while the flow is in progress (src/lib/storage.ts). */
export type GuidedDraft = {
  step: Step;
  bias: GuidedBias | null;
  entry: number | null;
  stop: number | null;
  target: number | null;
};

const STEPS: Step[] = ["bias", "entry", "stop", "target", "done"];
const numOrNull = (x: unknown) => x === null || (typeof x === "number" && Number.isFinite(x));

function readDraft(d: unknown): GuidedDraft | null {
  if (typeof d !== "object" || d === null) return null;
  const x = d as Record<string, unknown>;
  const biasOk = x.bias === null || x.bias === "bullish" || x.bias === "bearish" || x.bias === "unclear";
  if (!STEPS.includes(x.step as Step) || !biasOk || !numOrNull(x.entry) || !numOrNull(x.stop) || !numOrNull(x.target)) return null;
  return x as GuidedDraft;
}

function readGraded(g: unknown): GuidedGradeResponse | null {
  if (typeof g !== "object" || g === null) return null;
  const x = g as Record<string, unknown>;
  return typeof x.grade === "object" && x.grade !== null && typeof x.reveal === "object" && x.reveal !== null
    ? (g as GuidedGradeResponse)
    : null;
}

export function GuidedExercise({
  exercise,
  onGrade,
  onNext,
  nextLabel,
  initialDraft,
  initialGraded,
  onDraftChange,
  prompt,
  footer,
}: {
  exercise: PublicGuidedExercise;
  prompt?: ReactNode;
  /** Save status and the report link, under the controls. */
  footer?: ReactNode;
  /** Called the instant the attempt is finalized (Submit Setup or No Trade
   * at any step). The parent grades it on the server and records it; null
   * means grading failed and the parent is showing why. */
  onGrade: (answer: GuidedUserAnswer) => Promise<GuidedGradeResponse | null>;
  onNext: () => void;
  nextLabel: string;
  /** Restored after a refresh: the flow so far, and the grade if it was
   * already graded (then the feedback shows instead of the flow). */
  initialDraft?: unknown;
  initialGraded?: unknown;
  onDraftChange?: (draft: GuidedDraft) => void;
}) {
  const [restored] = useState(() => {
    const graded = readGraded(initialGraded);
    const draft = readDraft(initialDraft);
    // "done" without its grade means grading never came back: resume at
    // the last step so it can be submitted again.
    const step: Step = graded ? "done" : draft?.step === "done" ? (draft.bias === "unclear" ? "bias" : "target") : (draft?.step ?? "bias");
    return { graded, draft, step };
  });
  const [step, setStep] = useState<Step>(restored.step);
  const [bias, setBias] = useState<GuidedBias | null>(restored.draft?.bias ?? null);
  const [entry, setEntry] = useState<number | null>(restored.draft?.entry ?? null);
  const [stop, setStop] = useState<number | null>(restored.draft?.stop ?? null);
  const [target, setTarget] = useState<number | null>(restored.draft?.target ?? null);
  const [graded, setGraded] = useState<GuidedGradeResponse | null>(restored.graded);

  // Autosave the flow as it goes.
  useEffect(() => {
    onDraftChange?.({ step, bias, entry, stop, target });
    // onDraftChange is a fresh closure each parent render; the values are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, bias, entry, stop, target]);
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

  const chart = (
      <ChartFrame>
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
      </ChartFrame>
  );

  return (
    <ExerciseLayout
      prompt={prompt}
      chart={chart}
      controls={
      <div>
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
        {footer}
      </div>
      }
    />
  );
}
