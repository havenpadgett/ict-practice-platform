"use client";

import { CandlestickChart } from "@/components/practice/candlestick-chart";
import type { Exercise } from "@/data/exercises";

const noop = () => {};

/** The scenario's chart with its detected answer key drawn on it. */
export function ReviewChart({ exercise }: { exercise: Exercise }) {
  if (exercise.answer_type === "zone") {
    return (
      <CandlestickChart
        answerType="zone"
        candles={exercise.candles}
        interactive={false}
        userRegion={null}
        onUserRegionChange={noop}
        correctZone={exercise.answer}
      />
    );
  }
  if (exercise.answer_type === "level") {
    return (
      <CandlestickChart
        answerType="level"
        candles={exercise.candles}
        interactive={false}
        userLevel={null}
        onUserLevelChange={noop}
        correctLevel={exercise.answer?.price ?? null}
      />
    );
  }
  return <p className="text-sm text-muted">No chart preview for answer type {exercise.answer_type}.</p>;
}
