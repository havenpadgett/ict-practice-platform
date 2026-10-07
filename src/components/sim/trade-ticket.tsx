"use client";

import { useState } from "react";
import type { Plan } from "@/components/sim/chart-types";
import type { Phase } from "@/components/sim/use-replay";
import { describeOutcome, plannedRR, validateOrder } from "@/lib/engine/trade";
import type { Bias, Confidence5, Direction, Order, TradeOutcome } from "@/lib/engine/types";

const MIN_RR = 2;

const BIAS_OPTIONS: { value: Bias; label: string }[] = [
  { value: "bullish", label: "Bullish" },
  { value: "bearish", label: "Bearish" },
  { value: "neutral", label: "Neutral" },
];

export const CONFIDENCE5: { value: Confidence5; label: string }[] = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5" },
];

/** A price field that can be typed in freely and still follows the chart
 * when the plan's line is dragged. */
function PriceField({ id, label, value, onChange, disabled }: { id: string; label: string; value: number; onChange: (n: number) => void; disabled?: boolean }) {
  const [text, setText] = useState(String(value));
  const [seen, setSeen] = useState(value);
  // Follow the plan when its line is dragged on the chart, without
  // overwriting what is being typed.
  if (value !== seen) {
    setSeen(value);
    if (Number(text) !== value) setText(String(value));
  }
  return (
    <div>
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={0.25}
        disabled={disabled}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n)) onChange(n);
        }}
        className="field mt-1 w-full tabular-nums"
      />
    </div>
  );
}

export function ConfidenceFive({ value, onChange, disabled }: { value: Confidence5 | null; onChange: (v: Confidence5 | null) => void; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled}>
      <legend className="text-xs text-muted">
        How confident are you in this read? <span>Optional · 1 a guess, 5 certain</span>
      </legend>
      <div className="mt-2 flex gap-2">
        {CONFIDENCE5.map((c) => (
          <button key={c.value} type="button" aria-pressed={value === c.value} onClick={() => onChange(value === c.value ? null : c.value)} className="btn-option min-w-11 px-3 text-sm">
            {c.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function TradeTicket({
  bias,
  onBias,
  plan,
  onPlan,
  onNewPlan,
  lastClose,
  phase,
  outcome,
  inTrade,
  order,
  fillPrice,
  barsInTrade,
  atLiveEdge,
  confidence,
  onConfidence,
  onCommit,
  onWait,
  canWait,
  allowWait,
  asksConfidence,
  showBias = true,
}: {
  bias: Bias | null;
  onBias: (b: Bias) => void;
  plan: Plan | null;
  onPlan: (p: Plan | null) => void;
  onNewPlan: (d: Direction) => void;
  lastClose: number;
  phase: Phase;
  outcome: TradeOutcome | null;
  inTrade: boolean;
  order: Order | null;
  fillPrice: number | null;
  barsInTrade: number;
  atLiveEdge: boolean;
  confidence: Confidence5 | null;
  onConfidence: (c: Confidence5 | null) => void;
  onCommit: (d: "long" | "short" | "no_trade") => void;
  onWait: () => void;
  canWait: boolean;
  allowWait: boolean;
  asksConfidence: boolean;
  /** False where bias was already committed on an earlier stage. */
  showBias?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const committed = phase !== "reading";

  const entry = plan ? (plan.entry ?? lastClose) : null;
  const rr = plan && entry !== null ? plannedRR(plan.direction, entry, plan.stop, plan.target) : null;
  const risk = plan && entry !== null ? Math.abs(entry - plan.stop) : null;

  function commit(d: "long" | "short") {
    if (!plan || plan.direction !== d) return;
    if (showBias && bias === null) return setError("Declare your bias first.");
    const order: Order = { direction: plan.direction, entry: plan.entry, stop: plan.stop, target: plan.target, placedAt: 1 };
    const check = validateOrder(order, lastClose);
    if (!check.ok) return setError(check.reason);
    setError(null);
    onCommit(d);
  }

  if (committed) {
    return (
      <section className="card space-y-3" aria-live="polite">
        <p className="eyebrow">Your trade</p>
        {order && (
          <p className="text-sm text-foreground">
            {order.direction === "long" ? "Long" : "Short"} {order.entry === null ? "at market" : `at ${order.entry.toFixed(2)}`} · stop {order.stop.toFixed(2)} · target {order.target.toFixed(2)}
          </p>
        )}
        {phase === "committed" && (
          <p className="text-sm">
            {inTrade ? `In the trade for ${barsInTrade} candle${barsInTrade === 1 ? "" : "s"}, filled at ${fillPrice?.toFixed(2)}.` : "Order working, not filled yet."} The result isn&apos;t shown until price reaches the stop or the target, or the scenario ends.
          </p>
        )}
        {phase === "resolved" && outcome && <p className="text-sm text-foreground">{describeOutcome(outcome)}</p>}
      </section>
    );
  }

  return (
    <section className="card space-y-5">
      {showBias && (
        <fieldset>
          <legend className="eyebrow">Bias (higher timeframe)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {BIAS_OPTIONS.map((b) => (
              <button key={b.value} type="button" aria-pressed={bias === b.value} onClick={() => onBias(b.value)} className="btn-option px-3.5 text-sm">
                {b.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className={`space-y-3 ${showBias ? "border-t border-line pt-5" : ""}`}>
        <p className="eyebrow">Trade plan</p>
        {!plan ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => onNewPlan("long")}>
              Plan a long
            </button>
            <button type="button" className="btn-secondary" onClick={() => onNewPlan("short")}>
              Plan a short
            </button>
            <p className="w-full text-xs text-muted">Or use the Long / Short position tool and click the chart where you want in.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{plan.direction === "long" ? "Long" : "Short"}</p>
              <div role="group" aria-label="Entry type" className="flex gap-1">
                <button type="button" aria-pressed={plan.entry === null} onClick={() => onPlan({ ...plan, entry: null })} className="btn-option px-3 text-xs">
                  At market
                </button>
                <button type="button" aria-pressed={plan.entry !== null} onClick={() => onPlan({ ...plan, entry: plan.entry ?? lastClose })} className="btn-option px-3 text-xs">
                  At a price
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <PriceField id="plan-entry" label="Entry" value={plan.entry ?? lastClose} disabled={plan.entry === null} onChange={(n) => onPlan({ ...plan, entry: n })} />
              <PriceField id="plan-stop" label="Stop" value={plan.stop} onChange={(n) => onPlan({ ...plan, stop: n })} />
              <PriceField id="plan-target" label="Target" value={plan.target} onChange={(n) => onPlan({ ...plan, target: n })} />
            </div>
            <p className="text-xs tabular-nums">
              {rr !== null && risk !== null ? (
                <>
                  Risk {risk.toFixed(2)} points · planned <span className="text-foreground">{rr.toFixed(1)}R</span> {rr >= MIN_RR ? `· meets the ${MIN_RR}R minimum` : `· below the ${MIN_RR}R minimum`}
                </>
              ) : (
                "Stop and target must sit on the right sides of the entry."
              )}
            </p>
            <button type="button" className="btn-link text-xs" onClick={() => onPlan(null)}>
              Remove plan
            </button>
          </>
        )}
      </div>

      {asksConfidence && (
        <div className="border-t border-line pt-5">
          <ConfidenceFive value={confidence} onChange={onConfidence} />
        </div>
      )}

      <div className="space-y-2 border-t border-line pt-5">
        {error && (
          <p role="alert" className="text-error text-sm">
            {error}
          </p>
        )}
        {!atLiveEdge && <p className="text-xs text-muted">You are looking at earlier candles. Return to the live edge to commit.</p>}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-primary" disabled={!atLiveEdge || !plan || plan.direction !== "long"} onClick={() => commit("long")}>
            Enter long
          </button>
          <button type="button" className="btn-primary" disabled={!atLiveEdge || !plan || plan.direction !== "short"} onClick={() => commit("short")}>
            Enter short
          </button>
          {allowWait && (
            <button type="button" className="btn-secondary" disabled={!atLiveEdge || !canWait} onClick={onWait} title="Keep watching: advance to the next candle on this timeframe">
              Wait
            </button>
          )}
          <button
            type="button"
            className="btn-secondary"
            disabled={!atLiveEdge}
            onClick={() => {
              if (showBias && bias === null) return setError("Declare your bias first.");
              setError(null);
              onCommit("no_trade");
            }}
          >
            No trade
          </button>
        </div>
        <p className="text-xs">No trade is a position. Standing aside on a chart with nothing worth taking scores like any correct call.</p>
      </div>
    </section>
  );
}
