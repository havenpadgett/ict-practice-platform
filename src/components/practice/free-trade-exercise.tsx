"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { CandlestickChart } from "@/components/practice/candlestick-chart";
import { FreeTradeFeedback } from "@/components/practice/free-trade-feedback";
import type { FreeTradeAnswer, FreeTradeDirection } from "@/data/exercises";
import type { PublicFreeTradeExercise as FreeTradeExerciseData } from "@/lib/public-exercise";
import {
  checkExit,
  computeRR,
  isStopOnLosingSide,
  isTargetOnWinningSide,
  type FreeTradeExit,
  type FreeTradeGradeResult,
  type FreeTradePosition,
} from "@/lib/free-trade-grading";

type Speed = "slow" | "normal" | "fast";

const SPEED_MS: Record<Speed, number> = { slow: 1200, normal: 600, fast: 250 };
const SPEED_LABELS: Record<Speed, string> = { slow: "Slow", normal: "Normal", fast: "Fast" };

/** NQ's minimum price increment — placed stops/targets snap to it. */
const TICK_SIZE = 0.25;

function roundToTick(price: number): number {
  return Math.round(price / TICK_SIZE) * TICK_SIZE;
}

/** Empty slots kept to the right of the newest revealed candle. */
const PLAYBACK_EXTRA_SLOTS = 4;

type Phase = "watching" | "placing" | "in_trade" | "done";
type LevelField = "stop" | "target";

type DraftTrade = {
  direction: FreeTradeDirection;
  entryIndex: number;
  entry: number;
  stop: number | null;
  target: number | null;
};

type State = {
  /** How many of hidden_candles are revealed. */
  revealed: number;
  playing: boolean;
  speed: Speed;
  phase: Phase;
  trade: DraftTrade | null;
  activeField: LevelField;
  exit: FreeTradeExit | null;
};

type Action =
  | { type: "advance" }
  | { type: "toggle_play" }
  | { type: "set_speed"; speed: Speed }
  | { type: "open_trade"; direction: FreeTradeDirection }
  | { type: "set_active_field"; field: LevelField }
  | { type: "set_level"; price: number }
  | { type: "cancel_trade" }
  | { type: "confirm_trade" }
  | { type: "end" };

const initialState: State = {
  revealed: 0,
  playing: false,
  speed: "normal",
  phase: "watching",
  trade: null,
  activeField: "stop",
  exit: null,
};

function isPlacementValid(trade: DraftTrade | null): trade is DraftTrade & { stop: number; target: number } {
  return (
    trade !== null &&
    trade.stop !== null &&
    trade.target !== null &&
    isStopOnLosingSide(trade.direction, trade.entry, trade.stop) &&
    isTargetOnWinningSide(trade.direction, trade.entry, trade.target)
  );
}

function toPosition(trade: DraftTrade & { stop: number; target: number }): FreeTradePosition {
  return {
    direction: trade.direction,
    entryIndex: trade.entryIndex,
    entry: trade.entry,
    stop: trade.stop,
    target: trade.target,
  };
}

/** Ends the scenario: an open trade is marked at the last revealed close
 * and a trade still being placed is discarded (it was never confirmed).
 * Grading happens on the server once the scenario is done. */
function finish(exercise: FreeTradeExerciseData, state: State, exit: FreeTradeExit | null): State {
  const position = state.phase === "in_trade" && isPlacementValid(state.trade) ? toPosition(state.trade) : null;
  const lastIndex = exercise.candles.length + state.revealed - 1;
  const lastCandle = lastIndex < exercise.candles.length
    ? exercise.candles[lastIndex]
    : exercise.hidden_candles[lastIndex - exercise.candles.length];
  const finalExit = position === null ? null : exit ?? { index: lastIndex, price: lastCandle.close, reason: "session_end" as const };
  return {
    ...state,
    playing: false,
    phase: "done",
    trade: position === null ? null : state.trade,
    exit: finalExit,
  };
}

function reduce(exercise: FreeTradeExerciseData, state: State, action: Action): State {
  const hiddenCount = exercise.hidden_candles.length;
  switch (action.type) {
    case "advance": {
      if (state.phase !== "watching" && state.phase !== "in_trade") return state;
      if (state.revealed >= hiddenCount) return finish(exercise, state, null);
      const revealed = state.revealed + 1;
      const index = exercise.candles.length + revealed - 1;
      const candle = exercise.hidden_candles[revealed - 1];
      const next = { ...state, revealed };
      if (state.phase === "in_trade" && isPlacementValid(state.trade)) {
        const exit = checkExit(toPosition(state.trade), candle, index);
        if (exit) return finish(exercise, next, exit);
      }
      if (revealed >= hiddenCount) return finish(exercise, next, null);
      return next;
    }
    case "toggle_play":
      if (state.phase !== "watching" && state.phase !== "in_trade") return state;
      return { ...state, playing: !state.playing };
    case "set_speed":
      return { ...state, speed: action.speed };
    case "open_trade": {
      if (state.phase !== "watching") return state;
      const entryIndex = exercise.candles.length + state.revealed - 1;
      const entryCandle =
        state.revealed === 0 ? exercise.candles[entryIndex] : exercise.hidden_candles[state.revealed - 1];
      return {
        ...state,
        playing: false,
        phase: "placing",
        activeField: "stop",
        trade: { direction: action.direction, entryIndex, entry: entryCandle.close, stop: null, target: null },
      };
    }
    case "set_active_field":
      return { ...state, activeField: action.field };
    case "set_level":
      if (state.phase !== "placing" || state.trade === null) return state;
      return { ...state, trade: { ...state.trade, [state.activeField]: roundToTick(action.price) } };
    case "cancel_trade":
      if (state.phase !== "placing") return state;
      return { ...state, phase: "watching", trade: null };
    case "confirm_trade":
      if (state.phase !== "placing" || !isPlacementValid(state.trade)) return state;
      return { ...state, phase: "in_trade" };
    case "end":
      if (state.phase === "done") return state;
      return finish(exercise, state, null);
  }
}

const primaryClass =
  "inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const secondaryClass =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-line px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40";
const activeClass =
  "inline-flex min-h-11 items-center justify-center rounded-md border border-accent bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent";

function formatPrice(price: number): string {
  return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export type FreeTradeAttempt = {
  position: FreeTradePosition | null;
  exit: FreeTradeExit | null;
};

export type FreeTradeGradeResponse = { grade: FreeTradeGradeResult; key: FreeTradeAnswer };

export function FreeTradeExercise({
  exercise,
  onGrade,
  onNext,
  nextLabel,
}: {
  exercise: FreeTradeExerciseData;
  /** Called once the scenario ends (trade closed, End Session, or playback
   * ran out). The parent grades it on the server and records it; null means
   * grading failed and the parent is showing why. */
  onGrade: (attempt: FreeTradeAttempt) => Promise<FreeTradeGradeResponse | null>;
  onNext: () => void;
  nextLabel: string;
}) {
  const [state, dispatch] = useReducer((s: State, a: Action) => reduce(exercise, s, a), initialState);
  const reportedRef = useRef(false);
  const [graded, setGraded] = useState<FreeTradeGradeResponse | null>(null);
  const [grading, setGrading] = useState(false);

  // Auto-advance. The reducer stops playback itself when the scenario ends.
  useEffect(() => {
    if (!state.playing) return;
    const id = window.setInterval(() => dispatch({ type: "advance" }), SPEED_MS[state.speed]);
    return () => window.clearInterval(id);
  }, [state.playing, state.speed]);

  const requestGrade = useCallback(async () => {
    const position = state.trade && isPlacementValid(state.trade) ? toPosition(state.trade) : null;
    setGrading(true);
    const res = await onGrade({ position, exit: state.exit });
    setGrading(false);
    if (res) setGraded(res);
  }, [state.trade, state.exit, onGrade]);

  // Grade exactly once when the scenario ends; a failure offers a retry.
  useEffect(() => {
    if (state.phase !== "done" || reportedRef.current) return;
    reportedRef.current = true;
    void requestGrade();
  }, [state.phase, requestGrade]);

  const done = state.phase === "done";
  const hiddenCount = exercise.hidden_candles.length;
  // Only revealed candles are ever passed to the chart — until the scenario
  // ends, when the whole thing is shown with the ideal levels overlaid.
  // Memoized so the chart's layout and candle marks aren't rebuilt on
  // renders that don't reveal anything (placing a stop, playback speed…).
  const candles = useMemo(
    () =>
      done
        ? [...exercise.candles, ...exercise.hidden_candles]
        : [...exercise.candles, ...exercise.hidden_candles.slice(0, state.revealed)],
    [exercise, done, state.revealed],
  );

  const trade = state.trade;
  const placing = state.phase === "placing";
  const liveRR =
    trade && trade.stop !== null && trade.target !== null
      ? computeRR(trade.direction, trade.entry, trade.stop, trade.target)
      : null;
  const stopError =
    trade && trade.stop !== null && !isStopOnLosingSide(trade.direction, trade.entry, trade.stop)
      ? `Stop must be ${trade.direction === "long" ? "below" : "above"} your entry.`
      : null;
  const targetError =
    trade && trade.target !== null && !isTargetOnWinningSide(trade.direction, trade.entry, trade.target)
      ? `Target must be ${trade.direction === "long" ? "above" : "below"} your entry.`
      : null;

  const key = graded?.key ?? null;

  return (
    <div>
      <p className="eyebrow">{exercise.title}</p>

      <div className="mt-2 overflow-hidden rounded-lg border border-line bg-surface p-2 sm:p-3">
        <CandlestickChart
          answerType="free"
          candles={candles}
          // A real session's date would let the user look up what happened
          // next; it's shown once the scenario is over.
          hideDates={!done && exercise.real}
          extraSlots={done ? 0 : PLAYBACK_EXTRA_SLOTS}
          interactive={placing}
          entryPrice={trade?.entry ?? null}
          stopPrice={trade?.stop ?? null}
          targetPrice={trade?.target ?? null}
          activeField={placing ? state.activeField : null}
          onActiveFieldChange={(price) => dispatch({ type: "set_level", price })}
          entryIndex={trade?.entryIndex ?? null}
          exit={state.exit}
          idealEntryZone={
            key?.entry_zone ? { ...key.entry_zone, candle_start: key.entry_zone.earliest_index } : null
          }
          idealStopZone={key?.stop_zone ?? null}
          idealTarget={key?.target ?? null}
        />
      </div>

      {!done && (
        <p className="mt-2 text-xs text-muted">
          Playback {state.revealed} / {hiddenCount}
        </p>
      )}

      <div className="mt-4">
        {done ? (
          graded ? (
            <FreeTradeFeedback
              result={graded.grade}
              isValidSetup={graded.key.is_valid_setup}
              onNext={onNext}
              nextLabel={nextLabel}
            />
          ) : grading ? (
            <p className="text-sm text-muted" role="status">Grading…</p>
          ) : (
            <button type="button" onClick={() => void requestGrade()} className={primaryClass}>
              Try grading again
            </button>
          )
        ) : (
          <div className="space-y-4">
            {/* Playback */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => dispatch({ type: "advance" })}
                disabled={placing || state.playing}
                className={placing ? secondaryClass : primaryClass}
              >
                Next Candle
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "toggle_play" })}
                disabled={placing}
                className={secondaryClass}
              >
                {state.playing ? "Pause" : "Play"}
              </button>
              <div className="flex rounded-md border border-line" role="group" aria-label="Playback speed">
                {(Object.keys(SPEED_MS) as Speed[]).map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => dispatch({ type: "set_speed", speed })}
                    aria-pressed={state.speed === speed}
                    className={`min-h-11 min-w-11 px-3 text-xs font-medium transition-colors ${
                      state.speed === speed ? "bg-accent/10 text-accent" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {SPEED_LABELS[speed]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => dispatch({ type: "end" })}
                className={`${secondaryClass} sm:ml-auto`}
              >
                End Session
              </button>
            </div>

            {/* Trade */}
            {state.phase === "watching" && (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => dispatch({ type: "open_trade", direction: "long" })} className={secondaryClass}>
                    Long
                  </button>
                  <button type="button" onClick={() => dispatch({ type: "open_trade", direction: "short" })} className={secondaryClass}>
                    Short
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted">
                  Entry fills at the close of the latest candle. Ending the session without a trade counts as No Trade.
                </p>
              </div>
            )}

            {placing && trade && (
              <div className="card">
                <p className="text-sm text-foreground">
                  {trade.direction === "long" ? "Long" : "Short"} at {formatPrice(trade.entry)} — place your stop and
                  target on the chart.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["stop", "target"] as LevelField[]).map((field) => (
                    <button
                      key={field}
                      type="button"
                      onClick={() => dispatch({ type: "set_active_field", field })}
                      className={state.activeField === field ? activeClass : secondaryClass}
                    >
                      {field === "stop" ? "Stop" : "Target"}
                      {trade[field] !== null ? `: ${formatPrice(trade[field]!)}` : ""}
                    </button>
                  ))}
                </div>
                {liveRR !== null && (
                  <p className="mt-3 text-sm text-foreground">
                    Live R:R:{" "}
                    <span className={liveRR >= exercise.min_rr ? "font-medium text-accent" : "font-medium"}>
                      {liveRR.toFixed(2)}:1
                    </span>
                    <span className="text-muted">
                      {" "}
                      · {liveRR >= exercise.min_rr ? "meets" : "below"} the {exercise.min_rr}:1 minimum
                    </span>
                  </p>
                )}
                {(stopError || targetError) && (
                  <p className="mt-2 text-sm text-danger">
                    {stopError ?? targetError}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "confirm_trade" })}
                    disabled={!isPlacementValid(trade)}
                    className={primaryClass}
                  >
                    Confirm Trade
                  </button>
                  <button type="button" onClick={() => dispatch({ type: "cancel_trade" })} className={secondaryClass}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {state.phase === "in_trade" && trade && trade.stop !== null && trade.target !== null && (
              <p className="text-sm text-foreground">
                {trade.direction === "long" ? "Long" : "Short"} from {formatPrice(trade.entry)} · Stop{" "}
                {formatPrice(trade.stop)} · Target {formatPrice(trade.target)}
                {liveRR !== null && <span className="text-muted"> · R:R {liveRR.toFixed(2)}:1</span>}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
