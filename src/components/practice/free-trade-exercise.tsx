"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { CandlestickChart } from "@/components/practice/candlestick-chart";
import { ChartFrame, ExerciseLayout } from "@/components/practice/exercise-layout";
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

/** The last playback speed picked, remembered per browser. */
const SPEED_KEY = "ict-practice:ft-speed";

function loadSpeed(): Speed {
  try {
    const v = window.localStorage.getItem(SPEED_KEY);
    return v === "slow" || v === "normal" || v === "fast" ? v : "normal";
  } catch {
    return "normal";
  }
}

function saveSpeed(speed: Speed): void {
  try {
    window.localStorage.setItem(SPEED_KEY, speed);
  } catch {
    // Best-effort.
  }
}

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

function formatPrice(price: number): string {
  return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export type FreeTradeAttempt = {
  position: FreeTradePosition | null;
  exit: FreeTradeExit | null;
};

export type FreeTradeGradeResponse = { grade: FreeTradeGradeResult; key: FreeTradeAnswer };

/** What's autosaved during playback (src/lib/storage.ts). */
export type FreeTradeDraft = State;

const PHASES: Phase[] = ["watching", "placing", "in_trade", "done"];

/** A saved playback state, if it's usable for this scenario. Restored
 * paused, so a refresh never resumes playing on its own. */
function readDraft(d: unknown, hiddenCount: number): State | null {
  if (typeof d !== "object" || d === null) return null;
  const x = d as Record<string, unknown>;
  const revealed = x.revealed;
  if (typeof revealed !== "number" || !Number.isInteger(revealed) || revealed < 0 || revealed > hiddenCount) return null;
  if (!PHASES.includes(x.phase as Phase) || !(x.speed === "slow" || x.speed === "normal" || x.speed === "fast")) return null;
  if (x.activeField !== "stop" && x.activeField !== "target") return null;
  const t = x.trade as Record<string, unknown> | null;
  if (t !== null && (typeof t !== "object" || (t.direction !== "long" && t.direction !== "short") || typeof t.entry !== "number" || typeof t.entryIndex !== "number")) {
    return null;
  }
  return { ...(x as unknown as State), playing: false };
}

function readGraded(g: unknown): FreeTradeGradeResponse | null {
  if (typeof g !== "object" || g === null) return null;
  const x = g as Record<string, unknown>;
  return typeof x.grade === "object" && x.grade !== null && typeof x.key === "object" && x.key !== null ? (g as FreeTradeGradeResponse) : null;
}

export function FreeTradeExercise({
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
  exercise: FreeTradeExerciseData;
  prompt?: ReactNode;
  /** Save status and the report link, under the controls. */
  footer?: ReactNode;
  /** Called once the scenario ends (trade closed, "Exit trade and finish" / "End as No Trade", or playback
   * ran out). The parent grades it on the server and records it; null means
   * grading failed and the parent is showing why. */
  onGrade: (attempt: FreeTradeAttempt) => Promise<FreeTradeGradeResponse | null>;
  onNext: () => void;
  nextLabel: string;
  /** Restored after a refresh: playback so far, and the grade if the
   * scenario was already graded. */
  initialDraft?: unknown;
  initialGraded?: unknown;
  onDraftChange?: (draft: FreeTradeDraft) => void;
}) {
  const [restoredGrade] = useState(() => readGraded(initialGraded));
  const [state, dispatch] = useReducer(
    (s: State, a: Action) => reduce(exercise, s, a),
    null,
    () => {
      const draft = readDraft(initialDraft, exercise.hidden_candles.length);
      if (restoredGrade) return { ...(draft ?? initialState), playing: false, phase: "done" as const };
      return draft ?? { ...initialState, speed: loadSpeed() };
    },
  );
  // Already graded before a refresh: never grade (and record) it again.
  const reportedRef = useRef(restoredGrade !== null);
  const [graded, setGraded] = useState<FreeTradeGradeResponse | null>(restoredGrade);

  // Autosave playback as it goes.
  useEffect(() => {
    onDraftChange?.(state);
    // onDraftChange is a fresh closure each parent render; the state is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
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

  // Keyboard: Space play/pause, → next candle, L long, S short, Esc
  // cancel placing, ? help. Ignored while typing, and Space is left alone
  // on a focused control so it still presses that control.
  const [showKeys, setShowKeys] = useState(false);
  useEffect(() => {
    if (done) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const typing = t?.closest("input, textarea, select, [contenteditable=true]");
      if (typing) return;
      const onControl = t?.closest("button, a, summary");
      if (e.key === " " && !onControl) {
        e.preventDefault();
        if (state.phase !== "placing") dispatch({ type: "toggle_play" });
      } else if (e.key === "ArrowRight" && !onControl) {
        e.preventDefault();
        if (state.phase !== "placing" && !state.playing) dispatch({ type: "advance" });
      } else if (e.key === "l" || e.key === "L") {
        dispatch({ type: "open_trade", direction: "long" });
      } else if (e.key === "s" || e.key === "S") {
        dispatch({ type: "open_trade", direction: "short" });
      } else if (e.key === "Escape") {
        if (showKeys) setShowKeys(false);
        else dispatch({ type: "cancel_trade" });
      } else if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        setShowKeys((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, state.phase, state.playing, showKeys]);

  const lastClose = candles[candles.length - 1]?.close ?? null;
  const progressPct = hiddenCount > 0 ? (state.revealed / hiddenCount) * 100 : 100;

  const chart = (
    <div>
      {/* The title names what happened, so it's shown only afterwards. */}
      {done && <p className="eyebrow mb-2">{exercise.title}</p>}
      <ChartFrame>
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
      </ChartFrame>
      {!done && (
        <div className="mt-3">
          <div
            className="h-1 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-label="Playback"
            aria-valuemin={0}
            aria-valuemax={hiddenCount}
            aria-valuenow={state.revealed}
          >
            <div className="h-full bg-muted transition-[width]" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted tabular-nums">
            Candle {state.revealed} of {hiddenCount} revealed
            {state.playing && <span> · playing at {SPEED_LABELS[state.speed].toLowerCase()} speed</span>}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <ExerciseLayout
      prompt={prompt}
      chart={chart}
      controls={
      <div>
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
            <button type="button" onClick={() => void requestGrade()} className="btn-primary">
              Try grading again
            </button>
          )
        ) : (
          <div className="space-y-5">
            {/* Playback */}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => dispatch({ type: "toggle_play" })}
                  disabled={placing}
                  className="btn-secondary"
                  aria-keyshortcuts="Space"
                >
                  {state.playing ? "Pause" : "Play"}
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "advance" })}
                  disabled={placing || state.playing}
                  className={placing || state.playing ? "btn-secondary" : "btn-primary"}
                  aria-keyshortcuts="ArrowRight"
                >
                  Next candle
                </button>
                <button
                  type="button"
                  onClick={() => setShowKeys((v) => !v)}
                  aria-expanded={showKeys}
                  aria-controls="ft-shortcuts"
                  aria-label="Keyboard shortcuts"
                  className="btn-link ml-auto hidden no-underline hover:underline sm:inline-flex"
                >
                  ?
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Playback speed">
                <span className="text-xs text-muted">Speed</span>
                {(Object.keys(SPEED_MS) as Speed[]).map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => {
                      dispatch({ type: "set_speed", speed });
                      saveSpeed(speed);
                    }}
                    aria-pressed={state.speed === speed}
                    className="btn-option px-3 text-xs"
                  >
                    {SPEED_LABELS[speed]}
                  </button>
                ))}
              </div>
              {showKeys && (
                <div id="ft-shortcuts" className="mt-3 rounded-lg border border-line p-3 text-xs text-muted">
                  <p className="font-medium text-foreground">Keyboard shortcuts</p>
                  <dl className="mt-2 grid grid-cols-[4.5rem_1fr] gap-y-1">
                    <dt><kbd>Space</kbd></dt><dd>Play / pause</dd>
                    <dt><kbd>→</kbd></dt><dd>Next candle</dd>
                    <dt><kbd>L</kbd> / <kbd>S</kbd></dt><dd>Go long / short</dd>
                    <dt><kbd>Esc</kbd></dt><dd>Cancel the trade you&apos;re placing</dd>
                    <dt><kbd>?</kbd></dt><dd>Show or hide this list</dd>
                  </dl>
                </div>
              )}
            </div>

            {/* Trade */}
            {state.phase === "watching" && (
              <div className="border-t border-line pt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => dispatch({ type: "open_trade", direction: "long" })} className="btn-secondary" aria-keyshortcuts="L">
                    Long
                  </button>
                  <button type="button" onClick={() => dispatch({ type: "open_trade", direction: "short" })} className="btn-secondary" aria-keyshortcuts="S">
                    Short
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted tabular-nums">
                  You enter at the close of the latest candle{lastClose !== null ? ` (${formatPrice(lastClose)})` : ""}, then place
                  your stop and target. No trade by the end is a No Trade answer.
                </p>
              </div>
            )}

            {placing && trade && (
              <div className="card">
                <p className="text-sm text-foreground tabular-nums">
                  {trade.direction === "long" ? "Long" : "Short"} at {formatPrice(trade.entry)}. Place your stop and target on
                  the chart.
                </p>
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Which line to place">
                  {(["stop", "target"] as LevelField[]).map((field) => (
                    <button
                      key={field}
                      type="button"
                      onClick={() => dispatch({ type: "set_active_field", field })}
                      aria-pressed={state.activeField === field}
                      className="btn-option tabular-nums"
                    >
                      {field === "stop" ? "Stop" : "Target"}
                      {trade[field] !== null ? `: ${formatPrice(trade[field]!)}` : ""}
                    </button>
                  ))}
                </div>
                {liveRR !== null && (
                  <p className="mt-3 text-sm text-foreground tabular-nums">
                    R:R <span className="font-medium">{liveRR.toFixed(2)}:1</span>
                    <span className="text-muted">
                      {" "}
                      · {liveRR >= exercise.min_rr ? "meets" : "below"} the {exercise.min_rr}:1 minimum
                    </span>
                  </p>
                )}
                {(stopError || targetError) && (
                  <p className="text-error mt-2" role="alert">
                    {stopError ?? targetError}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => dispatch({ type: "confirm_trade" })}
                    disabled={!isPlacementValid(trade)}
                    className="btn-primary"
                  >
                    Confirm trade
                  </button>
                  <button type="button" onClick={() => dispatch({ type: "cancel_trade" })} className="btn-secondary" aria-keyshortcuts="Escape">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {state.phase === "in_trade" && trade && trade.stop !== null && trade.target !== null && (
              <p className="border-t border-line pt-5 text-sm text-foreground tabular-nums">
                In a {trade.direction === "long" ? "long" : "short"} from {formatPrice(trade.entry)} · stop {formatPrice(trade.stop)} ·
                target {formatPrice(trade.target)}
                {liveRR !== null && <span className="text-muted"> · {liveRR.toFixed(2)}R planned</span>}
              </p>
            )}

            {state.phase !== "placing" && (
              <div className="border-t border-line pt-5">
                <button type="button" onClick={() => dispatch({ type: "end" })} className="btn-secondary">
                  {state.phase === "in_trade" ? "Exit trade and finish" : "End as No Trade"}
                </button>
                <p className="mt-2 text-xs text-muted">
                  {state.phase === "in_trade"
                    ? "Closes your trade at the latest candle's close and ends this scenario."
                    : "Ends this scenario without a trade. The rest of the chart is shown afterwards."}
                </p>
              </div>
            )}
          </div>
        )}
        {footer}
      </div>
      }
    />
  );
}
