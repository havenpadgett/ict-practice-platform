"use client";

import { useState, type ReactNode } from "react";
import { CandlestickChart } from "@/components/practice/candlestick-chart";
import { ChoiceControls } from "@/components/practice/choice-controls";
import { ChartFrame, ExerciseLayout } from "@/components/practice/exercise-layout";
import { ExerciseControls } from "@/components/practice/exercise-controls";
import { FeedbackPanel } from "@/components/practice/feedback-panel";
import { ManualEntry } from "@/components/practice/manual-entry";
import type { ZoneAnswer } from "@/data/exercises";
import { getConceptMeta } from "@/lib/concepts";
import type { GradeResult, UserRegion } from "@/lib/grading";
import type { PublicChoiceExercise, PublicLevelExercise, PublicZoneExercise } from "@/lib/public-exercise";

export type RecognitionReveal = { zone: ZoneAnswer | null; level: number | null };

/** Recognition mode: one chart, one concept, answered by drawing a box,
 * placing a line or picking an option. The answer state, grading and
 * saving live in the practice page (they're shared with autosave); this
 * owns the layout, the chart and the controls around it. */
export function RecognitionExercise({
  exercise,
  prompt,
  userRegion,
  onUserRegionChange,
  userLevel,
  onUserLevelChange,
  userChoice,
  onUserChoiceChange,
  result,
  reveal,
  isRetry,
  grading,
  gradeError,
  canRetryGrade,
  onRetryGrade,
  onSkip,
  onSubmit,
  onNoAnswer,
  onNext,
  nextLabel,
  onRetryChart,
  footer,
}: {
  exercise: PublicZoneExercise | PublicLevelExercise | PublicChoiceExercise;
  prompt: ReactNode;
  userRegion: UserRegion | null;
  onUserRegionChange: (r: UserRegion | null) => void;
  userLevel: number | null;
  onUserLevelChange: (p: number | null) => void;
  userChoice: string | null;
  onUserChoiceChange: (c: string) => void;
  result: GradeResult | null;
  reveal: RecognitionReveal | null;
  /** The feedback on screen is for an uncounted retry. */
  isRetry: boolean;
  grading: boolean;
  gradeError: string | null;
  /** A failed grading request can be sent again. */
  canRetryGrade: boolean;
  onRetryGrade: () => void;
  onSkip: () => void;
  onSubmit: () => void;
  onNoAnswer: () => void;
  onNext: () => void;
  nextLabel: string;
  onRetryChart: () => void;
  /** Save status and the report link, under the controls. */
  footer: ReactNode;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const answering = result === null && !grading;
  const hasAnswer =
    exercise.answer_type === "zone" ? userRegion !== null : exercise.answer_type === "level" ? userLevel !== null : userChoice !== null;
  const canSubmit = !grading && hasAnswer;
  const meta = getConceptMeta(exercise.concept);
  const highlight = showWhy && reveal?.zone ? { start: reveal.zone.candle_start, end: reveal.zone.candle_end } : null;

  const chart =
    exercise.answer_type === "zone" ? (
      <CandlestickChart
        answerType="zone"
        candles={exercise.candles}
        interactive={answering}
        userRegion={userRegion}
        onUserRegionChange={onUserRegionChange}
        correctZone={reveal?.zone ?? null}
        highlight={highlight}
      />
    ) : exercise.answer_type === "level" ? (
      <CandlestickChart
        answerType="level"
        candles={exercise.candles}
        interactive={answering}
        userLevel={userLevel}
        onUserLevelChange={onUserLevelChange}
        correctLevel={reveal?.level ?? null}
      />
    ) : (
      <CandlestickChart
        answerType="choice"
        candles={exercise.candles}
        interactive={false}
        fvgZone={exercise.fvg_zone ?? undefined}
        dealingRange={exercise.dealing_range ?? undefined}
        showEquilibrium={result !== null}
      />
    );

  let controls: ReactNode;
  if (gradeError) {
    controls = (
      <div role="alert">
        <p className="text-sm text-danger">{gradeError}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {canRetryGrade && (
            <button type="button" onClick={onRetryGrade} className="btn-primary">
              Try again
            </button>
          )}
          <button type="button" onClick={onSkip} className={canRetryGrade ? "btn-secondary" : "btn-primary"}>
            Skip this exercise
          </button>
        </div>
      </div>
    );
  } else if (grading) {
    controls = (
      <p className="text-sm text-muted" role="status">
        Grading…
      </p>
    );
  } else if (result) {
    controls = (
      <FeedbackPanel
        result={result}
        rule={meta.rule}
        onShowWhy={exercise.answer_type === "zone" ? setShowWhy : undefined}
        onNext={onNext}
        nextLabel={nextLabel}
        onRetry={exercise.answer_type === "choice" || isRetry ? undefined : onRetryChart}
        isRetry={isRetry}
      />
    );
  } else if (exercise.answer_type === "choice") {
    controls = (
      <ChoiceControls options={exercise.options} selected={userChoice} onSelect={onUserChoiceChange} onSubmit={onSubmit} canSubmit={canSubmit} />
    );
  } else {
    controls = (
      <>
        <ExerciseControls
          hint={
            exercise.answer_type === "zone"
              ? "Drag on the chart to draw a box around your answer."
              : "Click or tap the chart to place a line. Drag to adjust it."
          }
          canSubmit={canSubmit}
          onSubmit={onSubmit}
          onNoAnswer={onNoAnswer}
          noAnswerLabel={exercise.noAnswerLabel}
          onClear={
            hasAnswer
              ? () => (exercise.answer_type === "zone" ? onUserRegionChange(null) : onUserLevelChange(null))
              : undefined
          }
        />
        {exercise.answer_type === "zone" ? (
          <ManualEntry kind="zone" candleCount={exercise.candles.length} onRegion={onUserRegionChange} />
        ) : (
          <ManualEntry kind="level" candleCount={exercise.candles.length} onLevel={onUserLevelChange} />
        )}
      </>
    );
  }

  return (
    <ExerciseLayout
      prompt={prompt}
      chart={<ChartFrame>{chart}</ChartFrame>}
      controls={
        <>
          {controls}
          {footer}
        </>
      }
    />
  );
}
