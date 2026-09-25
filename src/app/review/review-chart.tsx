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
  if (exercise.answer_type === "guided") {
    const a = exercise.answer;
    return (
      <CandlestickChart
        answerType="guided"
        candles={exercise.candles}
        interactive={false}
        entryPrice={null}
        stopPrice={null}
        targetPrice={null}
        activeField={null}
        onActiveFieldChange={noop}
        correctEntry={a.entry?.price ?? null}
        correctStop={a.stop?.price ?? null}
        correctTarget={a.target?.price ?? null}
      />
    );
  }
  if (exercise.answer_type === "free") {
    // Internal review only: the whole session, with the ideal levels.
    const a = exercise.answer;
    return (
      <CandlestickChart
        answerType="free"
        candles={[...exercise.candles, ...exercise.hidden_candles]}
        interactive={false}
        extraSlots={0}
        entryPrice={null}
        stopPrice={null}
        targetPrice={null}
        activeField={null}
        onActiveFieldChange={noop}
        entryIndex={null}
        exit={null}
        idealEntryZone={a.entry_zone ? { ...a.entry_zone, candle_start: a.entry_zone.earliest_index } : null}
        idealStopZone={a.stop_zone}
        idealTarget={a.target}
      />
    );
  }
  return <p className="text-sm text-muted">No chart preview for answer type {exercise.answer_type}.</p>;
}
