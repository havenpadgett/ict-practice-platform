import { AccuracyBar } from "@/components/analytics/accuracy-bar";
import type { FreeTradeCheckAccuracy, FreeTradeStats } from "@/lib/analytics";

const CHECK_LABELS: Record<FreeTradeCheckAccuracy["check"], string> = {
  decision: "Trade decision",
  direction: "Direction",
  entry: "Entry",
  stop: "Stop",
  rr: "Risk-to-reward",
};

export function FreeTradeStatsView({ stats }: { stats: FreeTradeStats }) {
  const sign = stats.totalR > 0 ? "+" : stats.totalR < 0 ? "−" : "";

  return (
    <div>
      <p className="text-sm text-foreground">
        {stats.trades} trade{stats.trades === 1 ? "" : "s"} across {stats.scenarios} scenario
        {stats.scenarios === 1 ? "" : "s"} · {stats.wins} won · {stats.losses} lost ·{" "}
        <span className="font-medium">
          {sign}
          {Math.abs(stats.totalR).toFixed(2)}R
        </span>{" "}
        total
      </p>
      <div className="mt-4 space-y-4">
        {stats.checks.map((check) => (
          <AccuracyBar
            key={check.check}
            label={CHECK_LABELS[check.check]}
            accuracy={check.accuracy}
            sublabel={`${check.count} graded`}
          />
        ))}
      </div>
    </div>
  );
}
