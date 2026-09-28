"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CandlestickChart } from "@/components/practice/candlestick-chart";
import { ChartFrame, ExerciseLayout } from "@/components/practice/exercise-layout";
import { GuidedBiasControls } from "@/components/practice/guided-bias-controls";
import { GuidedFeedback } from "@/components/practice/guided-feedback";
import { GuidedLevelControls } from "@/components/practice/guided-level-controls";
import { GuidedStepper, type StepperItem } from "@/components/practice/guided-stepper";
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
  /** How the attempt was finalized: Submit setup (true) or No Trade. */
  declared?: boolean;
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

const STEP_LABEL: Record<Step, string> = { bias: "Bias", entry: "Entry", stop: "Stop", target: "Target", done: "Done" };
const BIAS_LABEL: Record<GuidedBias, string> = { bullish: "Bullish", bearish: "Bearish", unclear: "Unclear" };

function fmt(price: number): string {
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const [declared, setDeclared] = useState<boolean | null>(restored.draft?.declared ?? null);

  // Autosave the flow as it goes.
  useEffect(() => {
    onDraftChange?.({ step, bias, entry, stop, target, ...(declared !== null ? { declared } : {}) });
    // onDraftChange is a fresh closure each parent render; the values are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, bias, entry, stop, target, declared]);
  const [grading, setGrading] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  // On a phone the controls sit under the chart. Moving to a placement
  // step brings the chart back into view so the next line can be placed
  // without scrolling up. Not on first render (a restored draft).
  const firstStep = useRef(true);
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    if ((step === "entry" || step === "stop" || step === "target") && window.matchMedia("(max-width: 1023px)").matches) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      chartRef.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }
  }, [step]);
  const [pending, setPending] = useState<GuidedUserAnswer | null>(null);

  async function submit(answer: GuidedUserAnswer) {
    setDeclared(answer.declaredTrade);
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

  // Beginner charts only (difficulty 1): risk distance once the stop is
  // placed, and the 2R target drawn faintly. Harder charts get neither.
  const beginner = exercise.difficulty === 1 && (bias === "bullish" || bias === "bearish");
  const risk = beginner && entry !== null && stop !== null ? (bias === "bullish" ? entry - stop : stop - entry) : null;
  const twoR = risk !== null && risk > 0 && entry !== null ? entry + (bias === "bullish" ? 1 : -1) * exercise.min_rr * risk : null;
  const guidance =
    risk === null
      ? null
      : risk <= 0
        ? `Your stop is on the wrong side of your entry for a ${bias} trade.`
        : `Risk: ${fmt(risk)} points. A ${exercise.min_rr}R target is at ${fmt(twoR!)}.`;

  const order: Step[] = ["bias", "entry", "stop", "target"];
  const currentIndex = step === "done" ? order.length : order.indexOf(step);
  const values: Record<string, string | null> = {
    bias: bias ? BIAS_LABEL[bias] : null,
    entry: entry !== null ? fmt(entry) : null,
    stop: stop !== null ? fmt(stop) : null,
    target: target !== null ? fmt(target) : null,
  };
  const stepperItems: StepperItem[] = order.map((id, i) => ({
    id,
    label: STEP_LABEL[id],
    value: i <= currentIndex ? values[id] : null,
    state: i < currentIndex ? "done" : i === currentIndex ? "current" : "todo",
  }));
  const back = () => setStep(order[Math.max(0, currentIndex - 1)]);

  function placeLevel(raw: number) {
    // Snap to NQ's 0.25 tick, like Free Trade and a real platform.
    const price = Math.round(raw * 4) / 4;
    if (step === "entry") setEntry(price);
    else if (step === "stop") setStop(price);
    else if (step === "target") setTarget(price);
  }

  const chart = (
    <div ref={chartRef} className="scroll-mt-16">
      <ChartFrame>
        <CandlestickChart
          answerType="guided"
          candles={exercise.candles}
          interactive={interactive}
          entryPrice={entry}
          stopPrice={stop}
          targetPrice={target}
          activeField={interactive ? activeField : null}
          onActiveFieldChange={placeLevel}
          correctEntry={graded?.reveal.entry ?? null}
          correctStop={graded?.reveal.stop ?? null}
          correctTarget={graded?.reveal.target ?? null}
          guides={step !== "done" && twoR !== null ? [{ price: twoR, label: `${exercise.min_rr}R` }] : undefined}
        />
      </ChartFrame>
    </div>
  );

  return (
    <ExerciseLayout
      prompt={prompt}
      chart={chart}
      controls={
      <div>
        {step !== "done" && (
          <div className="mb-5">
            <GuidedStepper steps={stepperItems} />
          </div>
        )}
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
          <GuidedBiasControls selected={bias} onSelect={setBias} onContinue={handleContinueFromBias} />
        )}
        {!grading && !pending && step === "entry" && (
          <GuidedLevelControls
            step="entry"
            price={entry}
            onContinue={() => setStep("stop")}
            onBack={back}
            onManualPrice={placeLevel}
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
            onBack={back}
            onManualPrice={placeLevel}
            onNoTrade={() => finalize(false)}
            liveRR={null}
            minRR={exercise.min_rr}
            guidance={guidance}
          />
        )}
        {!grading && !pending && step === "target" && (
          <GuidedLevelControls
            step="target"
            price={target}
            onContinue={() => finalize(true)}
            onBack={back}
            onManualPrice={placeLevel}
            onNoTrade={() => finalize(false)}
            liveRR={liveRR}
            minRR={exercise.min_rr}
            guidance={guidance}
          />
        )}
        {step === "done" && result && (
          <GuidedFeedback
            result={result}
            plan={
              bias === "unclear" || bias === null
                ? "No Trade (bias unclear)"
                : [
                    BIAS_LABEL[bias],
                    entry !== null ? `entry ${fmt(entry)}` : null,
                    stop !== null ? `stop ${fmt(stop)}` : null,
                    target !== null ? `target ${fmt(target)}` : null,
                    declared === false ? "then No Trade" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
            }
            onNext={onNext}
            nextLabel={nextLabel}
          />
        )}
        {footer}
      </div>
      }
    />
  );
}
