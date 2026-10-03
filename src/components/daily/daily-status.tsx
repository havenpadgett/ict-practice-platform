"use client";

import type { DailyProgress } from "@/hooks/use-daily-progress";

const dayLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });

/** The daily streak: a week of marks with today outlined, and the numbers.
 * The streak counts consecutive days with the daily completed on the day,
 * and is separate from the practice streak. */
export function DailyStatus({ progress, today }: { progress: DailyProgress; today: string }) {
  const doneToday = progress.done.has(today);
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <div>
        <p className="eyebrow">Daily streak</p>
        <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums">
          {progress.ready ? progress.streak : "—"}
          {" "}
          <span className="text-sm font-normal text-muted">{progress.streak === 1 ? "day" : "days"}</span>
        </p>
      </div>
      <ol className="flex gap-1.5" aria-label="Last 7 days">
        {progress.week.map((d) => (
          <li key={d.date} className="flex flex-col items-center gap-1">
            <span
              className={`h-6 w-6 rounded-md border ${d.done ? "border-accent bg-accent" : d.date === today ? "border-control" : "border-line"}`}
              aria-hidden
            />
            <span className="text-[10px] text-muted">{dayLabel(d.date)}</span>
            <span className="sr-only">
              {d.date}: {d.done ? "completed" : "not completed"}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted tabular-nums">
        {progress.ready && progress.total > 0 ? `${progress.total} completed · best streak ${progress.best}` : "Complete the daily to start a streak."}
        <br />
        {doneToday ? "Done today. A new chart at 00:00 UTC." : "A new chart every day at 00:00 UTC."}
      </p>
    </div>
  );
}
