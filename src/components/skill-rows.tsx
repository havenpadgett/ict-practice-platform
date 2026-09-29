import { MIN_ATTEMPTS_FOR_ACCURACY } from "@/lib/practice-modes";
import type { Trend } from "@/lib/progress";

export type SkillRow = {
  key: string;
  label: string;
  /** Used on narrow screens where the full label would truncate. */
  shortLabel?: string;
  attempts: number;
  /** 0-1. */
  accuracy: number;
  /** 0-1, the share of `accuracy` that was COULD_IMPROVE rather than a
   * clean CORRECT (Phase B) — drawn as its own amber segment of the bar,
   * inside the accuracy width, not added on top of it. */
  couldImprove?: number;
  trend?: Trend | null;
};

const TREND_TEXT: Record<Trend, string> = { up: "↑ improving", down: "↓ slipping", steady: "steady" };

/** Compact per-concept rows: a bar and "73% · 22 attempts", or a clear
 * "not enough data" below MIN_ATTEMPTS_FOR_ACCURACY instead of a
 * percentage built from one or two answers. */
export function SkillRows({ rows }: { rows: SkillRow[] }) {
  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => {
        const scored = row.attempts >= MIN_ATTEMPTS_FOR_ACCURACY;
        const pct = Math.round(row.accuracy * 100);
        // couldImprove is a share of accuracy, not additional width — the
        // amber segment sits inside the accent bar, never past its end.
        const couldImprovePct = Math.round((row.couldImprove ?? 0) * 100);
        const correctPct = Math.max(0, pct - couldImprovePct);
        return (
          <li key={row.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[12rem_minmax(0,1fr)_15rem]">
            <span className="truncate text-sm text-foreground">
              {row.shortLabel ? (
                <>
                  <span className="sm:hidden">{row.shortLabel}</span>
                  <span className="hidden sm:inline">{row.label}</span>
                </>
              ) : (
                row.label
              )}
            </span>
            <span className="order-last col-span-2 sm:order-none sm:col-span-1">
              {scored ? (
                <span className="relative block h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                  <span className="block h-full rounded-full bg-muted" style={{ width: `${pct}%` }} />
                  {couldImprovePct > 0 && (
                    <span
                      className="absolute inset-y-0 right-0 rounded-full bg-warn"
                      style={{ width: `${couldImprovePct}%`, left: `${correctPct}%` }}
                    />
                  )}
                </span>
              ) : (
                <span className="block h-1.5 rounded-full border border-dashed border-line" aria-hidden />
              )}
            </span>
            <span className="text-right text-xs text-muted tabular-nums">
              {row.attempts === 0 ? (
                "Not started"
              ) : scored ? (
                <>
                  <span className="text-sm font-medium text-foreground">{pct}%</span> · {row.attempts} attempts
                  {couldImprovePct > 0 && <span className="text-warn"> · {couldImprovePct}% could improve</span>}
                  {row.trend && <span className="ml-2">{TREND_TEXT[row.trend]}</span>}
                </>
              ) : (
                <>
                  {row.attempts} of {MIN_ATTEMPTS_FOR_ACCURACY} attempts needed
                </>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
