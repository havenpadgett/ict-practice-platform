"use client";

import { useState, type FormEvent } from "react";
import type { UserRegion } from "@/lib/grading";

/** Keyboard (and precise) alternative to drawing on the chart: type the
 * price of a line, or the candles and prices of a box. Collapsed by default
 * so it never competes with the chart. The chart redraws from whatever is
 * entered, so the result can be checked visually before submitting. */
export function ManualEntry(
  props:
    | { kind: "level"; candleCount: number; onLevel: (price: number) => void }
    | { kind: "zone"; candleCount: number; onRegion: (region: UserRegion) => void },
) {
  const [error, setError] = useState<string | null>(null);

  function num(form: FormData, name: string): number {
    const raw = String(form.get(name) ?? "").trim();
    return raw === "" ? NaN : Number(raw);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (props.kind === "level") {
      const price = num(form, "price");
      if (!Number.isFinite(price) || price <= 0) return setError("Enter a price, like 21150.25.");
      setError(null);
      props.onLevel(price);
      return;
    }
    const start = num(form, "start");
    const end = num(form, "end");
    const upper = num(form, "upper");
    const lower = num(form, "lower");
    const n = props.candleCount;
    if (![start, end].every((x) => Number.isInteger(x) && x >= 1 && x <= n)) {
      return setError(`Candles are numbered 1 (leftmost) to ${n}.`);
    }
    if (![upper, lower].every((x) => Number.isFinite(x) && x > 0)) return setError("Enter both prices.");
    if (upper <= lower) return setError("The upper price has to be above the lower one.");
    setError(null);
    props.onRegion({
      candleIndexLow: Math.min(start, end) - 1,
      candleIndexHigh: Math.max(start, end) - 1,
      priceLow: lower,
      priceHigh: upper,
    });
  }

  return (
    <details className="group mt-3 text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-muted underline-offset-4 hover:text-foreground hover:underline">
        Enter values manually
      </summary>
      <form onSubmit={submit} noValidate className="mt-2 rounded-lg border border-line p-4">
        {props.kind === "level" ? (
          <label className="block text-xs text-muted">
            Price of your line
            <input name="price" inputMode="decimal" autoComplete="off" className="field" />
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted">
              First candle
              <input name="start" inputMode="numeric" autoComplete="off" className="field" />
            </label>
            <label className="block text-xs text-muted">
              Last candle
              <input name="end" inputMode="numeric" autoComplete="off" className="field" />
            </label>
            <label className="block text-xs text-muted">
              Upper price
              <input name="upper" inputMode="decimal" autoComplete="off" className="field" />
            </label>
            <label className="block text-xs text-muted">
              Lower price
              <input name="lower" inputMode="decimal" autoComplete="off" className="field" />
            </label>
            <p className="col-span-2 text-xs text-muted">Candles are numbered 1 (leftmost) to {props.candleCount}.</p>
          </div>
        )}
        {error && (
          <p className="text-error mt-2" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn-secondary mt-3">
          {props.kind === "level" ? "Place line" : "Draw box"}
        </button>
      </form>
    </details>
  );
}
