"use client";

import { SPEED_LABEL } from "@/components/sim/use-replay";
import { formatMoment, TIMEFRAME_LABEL, type Timeframe } from "@/lib/engine/time";

/** Reset, back, step, step several, play/pause and speed, plus the timeframe
 * switcher. Switching timeframe keeps the same moment: it only changes how
 * the candles up to now are grouped. */
export function PlaybackBar({
  nowT,
  tf,
  timeframes,
  onTf,
  playing,
  speed,
  onPlay,
  onSpeed,
  onStep,
  onBack,
  onReset,
  canBack,
  canReset,
  stepping,
  atLiveEdge,
  onLive,
  fetching,
  locked,
}: {
  nowT: number;
  tf: Timeframe;
  timeframes: Timeframe[];
  onTf: (tf: Timeframe) => void;
  playing: boolean;
  speed: number;
  onPlay: () => void;
  onSpeed: (i: number) => void;
  onStep: (n: number) => void;
  onBack: () => void;
  onReset: () => void;
  canBack: boolean;
  canReset: boolean;
  /** Stepping is allowed (not resolved, not waiting). */
  stepping: boolean;
  atLiveEdge: boolean;
  onLive: () => void;
  fetching: boolean;
  /** After a trade is committed, back and reset are gone: no rewinding. */
  locked: boolean;
}) {
  const btn = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-control px-2.5 text-sm text-muted transition-colors hover:text-foreground disabled:opacity-40";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Timeframe" className="flex flex-wrap gap-1">
          {timeframes.map((t) => (
            <button key={t} type="button" aria-pressed={tf === t} onClick={() => onTf(t)} className={`btn-option min-h-11 px-3 text-xs ${tf === t ? "" : ""}`}>
              {TIMEFRAME_LABEL[t]}
            </button>
          ))}
        </div>
        <p className="text-xs tabular-nums text-muted" aria-live="polite">
          {formatMoment(nowT)}
          {!atLiveEdge && (
            <button type="button" onClick={onLive} className="ml-2 text-accent underline underline-offset-2">
              back to live edge
            </button>
          )}
          {fetching && <span className="ml-2 text-muted">loading…</span>}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Replay controls">
        {!locked && (
          <>
            <button type="button" className={btn} onClick={onReset} disabled={!canReset} title="Reset to the decision moment" aria-label="Reset to the decision moment">
              ⏮
            </button>
            <button type="button" className={btn} onClick={onBack} disabled={!canBack} title="Back one candle" aria-label="Back one candle">
              ◀
            </button>
          </>
        )}
        <button type="button" className={btn} onClick={() => onStep(1)} disabled={!stepping} title="Advance one candle" aria-label="Advance one candle">
          ▶ 1
        </button>
        <button type="button" className={btn} onClick={() => onStep(5)} disabled={!stepping} title="Advance five candles" aria-label="Advance five candles">
          +5
        </button>
        <button type="button" className={btn} onClick={() => onStep(15)} disabled={!stepping} title="Advance fifteen candles" aria-label="Advance fifteen candles">
          +15
        </button>
        <button type="button" className={`${btn} ${playing ? "border-accent text-accent" : ""}`} onClick={onPlay} disabled={!stepping} aria-pressed={playing} title={playing ? "Pause" : "Play"}>
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted">
          Speed
          <select value={speed} onChange={(e) => onSpeed(Number(e.target.value))} className="field min-h-11 w-auto py-1">
            {SPEED_LABEL.map((l, i) => (
              <option key={l} value={i}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
