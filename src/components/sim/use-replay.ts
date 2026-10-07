"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { Plan, Tool } from "@/components/sim/chart-types";
import { revealCandles } from "@/app/train/actions";
import { fromRow, seriesAt, supportedTimeframes, type SimCandle, type TimeframeData } from "@/lib/engine/candles";
import { bucketStart, TIMEFRAME_MINUTES, type Timeframe } from "@/lib/engine/time";
import { settleAtEnd, startOrder, stepOrder, validateOrder, type OrderState } from "@/lib/engine/trade";
import type { Annotation, Bias, Confidence5, Decision, Order, PublicScenario, ReplayResponse, TradeOutcome } from "@/lib/engine/types";

/** Candles per second at each playback speed. */
export const SPEEDS = [1, 3, 8, 20, 60] as const;
export const SPEED_LABEL = ["1×", "3×", "8×", "20×", "Max"];
/** How many candles to keep fetched ahead of the cursor. */
const PREFETCH_AHEAD = 40;
const FETCH_CHUNK = 120;

export type Phase = "reading" | "committed" | "resolved";

export type ReplayState = {
  candles: SimCandle[];
  /** Candles shown at the start: the decision moment. Back and Reset stop here. */
  startRevealed: number;
  /** Candles shown (the replay cursor). */
  revealed: number;
  /** The most candles ever shown: the live edge. */
  highWater: number;
  done: boolean;
  fetching: boolean;
  fetchError: string | null;
  playing: boolean;
  speed: number;
  tf: Timeframe;
  tool: Tool;
  annotations: Annotation[];
  undo: Annotation[][];
  selectedId: string | null;
  bias: Bias | null;
  plan: Plan | null;
  planT: number | null;
  waits: number;
  phase: Phase;
  decision: Decision | null;
  order: Order | null;
  orderState: OrderState | null;
  decidedAtRevealed: number;
  confidence: Confidence5 | null;
  nextId: number;
};

type Action =
  | { type: "append"; rows: SimCandle[]; done: boolean }
  | { type: "fetching"; value: boolean; error?: string | null }
  | { type: "retryFetch" }
  | { type: "advance"; n: number }
  | { type: "back" }
  | { type: "reset" }
  | { type: "live" }
  | { type: "play"; value: boolean }
  | { type: "speed"; value: number }
  | { type: "tf"; tf: Timeframe }
  | { type: "tool"; tool: Tool }
  | { type: "add"; a: Omit<Annotation, "id"> }
  | { type: "select"; id: string | null }
  | { type: "deleteSelected" }
  | { type: "undo" }
  | { type: "clear" }
  | { type: "bias"; bias: Bias | null }
  | { type: "plan"; plan: Plan | null }
  | { type: "confidence"; value: Confidence5 | null }
  | { type: "commit"; decision: "long" | "short" | "no_trade" }
  | { type: "wait" };

export function initialReplay(s: PublicScenario, firstTf: Timeframe): ReplayState {
  return {
    candles: s.stream.map(fromRow),
    startRevealed: s.cursorStart,
    revealed: s.cursorStart,
    highWater: s.cursorStart,
    done: false,
    fetching: false,
    fetchError: null,
    playing: false,
    speed: 2,
    tf: firstTf,
    tool: "cursor",
    annotations: [],
    undo: [],
    selectedId: null,
    bias: null,
    plan: null,
    planT: null,
    waits: 0,
    phase: "reading",
    decision: null,
    order: null,
    orderState: null,
    decidedAtRevealed: s.cursorStart,
    confidence: null,
    nextId: 1,
  };
}

/** Moves the cursor forward by up to `n` candles, stepping a live order over
 * each new candle. Stops at the candle that ends a trade. */
function advance(state: ReplayState, n: number): ReplayState {
  if (state.phase === "resolved") return state;
  const target = Math.min(state.revealed + n, state.candles.length);
  if (target <= state.revealed) {
    // Out of candles: if that is the end of the data, settle any live order.
    if (state.done && state.revealed >= state.candles.length && state.phase === "committed" && state.orderState) {
      return { ...state, playing: false, orderState: { status: "done", outcome: settleAtEnd(state.orderState, state.candles, "1m") }, phase: "resolved" };
    }
    return state;
  }
  let orderState = state.orderState;
  let revealed = state.revealed;
  let phase: Phase = state.phase;
  for (let i = state.revealed; i < target; i++) {
    revealed = i + 1;
    if (phase === "committed" && orderState && orderState.status !== "done" && i >= (state.order?.placedAt ?? 0)) {
      const step = stepOrder(orderState, state.candles[i], i, "1m");
      orderState = step.state;
      if (step.ended) {
        phase = "resolved";
        break;
      }
    }
  }
  // The last candle of the data ends the replay.
  if (phase === "committed" && orderState && revealed >= state.candles.length && state.done) {
    orderState = { status: "done", outcome: settleAtEnd(orderState, state.candles, "1m") };
    phase = "resolved";
  }
  return {
    ...state,
    revealed,
    highWater: Math.max(state.highWater, revealed),
    orderState,
    phase,
    playing: phase === "resolved" ? false : state.playing,
  };
}

function reducer(state: ReplayState, action: Action): ReplayState {
  switch (action.type) {
    case "append": {
      const merged = [...state.candles, ...action.rows.filter((r) => r.t > (state.candles[state.candles.length - 1]?.t ?? -1))];
      return { ...state, candles: merged, done: action.done || state.done, fetching: false, fetchError: null };
    }
    case "fetching":
      return { ...state, fetching: action.value, fetchError: action.error ?? null };
    case "retryFetch":
      return { ...state, fetchError: null };
    case "advance":
      return advance(state, action.n);
    case "back":
      return state.phase === "reading" && state.revealed > state.startRevealed ? { ...state, revealed: state.revealed - 1, playing: false } : state;
    case "reset":
      return state.phase === "reading" ? { ...state, revealed: state.startRevealed, playing: false } : state;
    case "live":
      return { ...state, revealed: state.highWater };
    case "play":
      return state.phase === "resolved" ? state : { ...state, playing: action.value };
    case "speed":
      return { ...state, speed: action.value };
    case "tf":
      return { ...state, tf: action.tf };
    case "tool":
      return { ...state, tool: action.tool, selectedId: action.tool === "cursor" ? state.selectedId : null };
    case "add": {
      const live = state.revealed === state.highWater;
      const a: Annotation = { ...action.a, id: `m${state.nextId}`, drawnAt: state.revealed, ...(live ? {} : { hindsight: true }) };
      return { ...state, annotations: [...state.annotations, a], undo: [...state.undo, state.annotations], nextId: state.nextId + 1, selectedId: null };
    }
    case "select":
      return { ...state, selectedId: action.id };
    case "deleteSelected":
      return state.selectedId ? { ...state, annotations: state.annotations.filter((a) => a.id !== state.selectedId), undo: [...state.undo, state.annotations], selectedId: null } : state;
    case "undo": {
      if (state.undo.length === 0) return state;
      const prev = state.undo[state.undo.length - 1];
      return { ...state, annotations: prev, undo: state.undo.slice(0, -1), selectedId: null };
    }
    case "clear":
      return state.annotations.length === 0 ? state : { ...state, annotations: [], undo: [...state.undo, state.annotations], selectedId: null };
    case "bias":
      return { ...state, bias: action.bias };
    case "plan":
      return state.phase !== "reading" ? state : { ...state, plan: action.plan, planT: action.plan && !state.plan ? state.candles[state.revealed - 1]?.t ?? null : state.planT };
    case "confidence":
      return { ...state, confidence: action.value };
    case "commit": {
      if (state.phase !== "reading" || state.revealed !== state.highWater) return state;
      if (action.decision === "no_trade") {
        return { ...state, phase: "resolved", decision: "no_trade", order: null, orderState: null, decidedAtRevealed: state.revealed, playing: false };
      }
      if (!state.plan || state.plan.direction !== action.decision) return state;
      const order: Order = { direction: state.plan.direction, entry: state.plan.entry, stop: state.plan.stop, target: state.plan.target, placedAt: state.revealed };
      const lastClose = state.candles[state.revealed - 1].c;
      if (!validateOrder(order, lastClose).ok) return state;
      return {
        ...state,
        phase: "committed",
        decision: action.decision,
        order,
        orderState: startOrder(order, lastClose),
        decidedAtRevealed: state.revealed,
        playing: true,
        speed: Math.max(state.speed, 2),
        tool: "cursor",
        selectedId: null,
      };
    }
    case "wait": {
      if (state.phase !== "reading" || state.revealed !== state.highWater) return state;
      const last = state.candles[state.revealed - 1];
      const bucketEnd = bucketStart(last.t, state.tf) + TIMEFRAME_MINUTES[state.tf];
      const n = Math.max(1, Math.min(120, bucketEnd - last.t - 1));
      return { ...advance({ ...state, waits: state.waits + 1 }, n), playing: false };
    }
  }
}

export type Replay = {
  state: ReplayState;
  /** Series for the showing timeframe at the cursor. */
  series: SimCandle[];
  timeframes: Timeframe[];
  atLiveEdge: boolean;
  /** The trade so far (open or closed), for the on-chart marker and the ticket. */
  outcome: TradeOutcome | null;
  fill: { index: number; price: number } | null;
  dispatch: (a: Action) => void;
  response: () => ReplayResponse;
};

/** The replay state machine: playback, timeframe switching at one timestamp,
 * markup, the trade plan and the order from commitment to resolution. The
 * server reveals candles in chunks as the cursor needs them. */
export function useReplay(scenario: PublicScenario, firstTf: Timeframe): Replay {
  const [state, dispatch] = useReducer(reducer, undefined, () => initialReplay(scenario, firstTf));
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const data: TimeframeData = useMemo(
    () => ({
      history: Object.fromEntries(Object.entries(scenario.history).map(([k, v]) => [k, (v ?? []).map(fromRow)])),
      stream: state.candles,
      streamTimeframe: scenario.streamTimeframe,
    }),
    [scenario.history, scenario.streamTimeframe, state.candles],
  );
  const timeframes = useMemo(() => supportedTimeframes(data, state.revealed), [data, state.revealed]);
  const series = useMemo(() => seriesAt(data, state.tf, state.revealed), [data, state.tf, state.revealed]);

  // Fetch ahead of the cursor, a chunk at a time. The request in flight is
  // tracked in a ref (not state) so the effect re-running when state changes
  // can't orphan its own result.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (state.done || inFlight.current || state.fetchError) return;
    const ahead = state.candles.length - state.revealed;
    if (ahead > PREFETCH_AHEAD && state.phase !== "committed") return;
    if (ahead > PREFETCH_AHEAD * 3) return;
    inFlight.current = true;
    dispatch({ type: "fetching", value: true });
    void revealCandles(scenario.id, state.candles.length, FETCH_CHUNK)
      .then((res) => {
        if (!mounted.current) return;
        if (!res.ok) dispatch({ type: "fetching", value: false, error: res.error });
        else dispatch({ type: "append", rows: res.rows.map(fromRow), done: res.done });
      })
      .catch(() => {
        if (mounted.current) dispatch({ type: "fetching", value: false, error: "Couldn't load more candles. Check your connection." });
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [state.candles.length, state.revealed, state.done, state.phase, state.fetchError, scenario.id]);

  // Playback clock.
  useEffect(() => {
    if (!state.playing) return;
    const ms = 1000 / SPEEDS[state.speed];
    const id = window.setInterval(() => dispatch({ type: "advance", n: SPEEDS[state.speed] >= 20 ? Math.round(SPEEDS[state.speed] / 20) : 1 }), SPEEDS[state.speed] >= 20 ? 50 : ms);
    return () => window.clearInterval(id);
  }, [state.playing, state.speed]);

  const outcome: TradeOutcome | null = useMemo(() => {
    if (!state.orderState) return null;
    if (state.orderState.status === "done") return state.orderState.outcome;
    if (state.orderState.status === "open") return null;
    return null;
  }, [state.orderState]);

  const fill = useMemo(() => {
    const os = state.orderState;
    if (!os) return null;
    if (os.status === "open") return { index: os.fillIndex, price: os.fillPrice };
    if (os.status === "done" && os.outcome.status === "closed") return { index: os.outcome.fillIndex, price: os.outcome.fillPrice };
    return null;
  }, [state.orderState]);

  const response = useCallback((): ReplayResponse => {
    const s = stateRef.current;
    const decision: Decision = s.decision ?? "wait";
    return { kind: "replay", annotations: s.annotations.filter((a) => a.kind !== "long_position" && a.kind !== "short_position"), bias: s.bias, decision, order: s.order, waits: s.waits, decidedAtRevealed: s.decidedAtRevealed };
  }, []);

  return { state, series, timeframes, atLiveEdge: state.revealed === state.highWater, outcome, fill, dispatch, response };
}
