"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { revealCandles } from "@/app/train/actions";
import { fromRow, seriesAt, supportedTimeframes, type SimCandle, type TimeframeData } from "@/lib/engine/candles";
import { initialReplay, reducer, SPEEDS, type Action, type ReplayState } from "@/lib/engine/replay";
import type { Timeframe } from "@/lib/engine/time";
import type { Decision, PublicScenario, ReplayResponse, TradeOutcome } from "@/lib/engine/types";

export { SPEED_LABEL, SPEEDS } from "@/lib/engine/replay";
export type { Phase, ReplayState } from "@/lib/engine/replay";

/** How many candles to keep fetched ahead of the cursor. */
const PREFETCH_AHEAD = 40;
const FETCH_CHUNK = 120;

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
