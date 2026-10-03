"use client";

import Link from "next/link";
import { DailyStatus } from "@/components/daily/daily-status";
import { useDailyProgress } from "@/hooks/use-daily-progress";
import { dailyPath, utcDateKey } from "@/lib/daily";

/** On the dashboard: today's daily challenge and the streak. */
export function DailyCard() {
  const today = utcDateKey();
  const progress = useDailyProgress(today);
  const doneToday = progress.done.has(today);
  return (
    <section aria-labelledby="daily-card-title" className="rounded-lg border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="daily-card-title" className="text-base">
            Daily challenge
          </h2>
          <p className="mt-1 text-sm text-muted">
            {doneToday ? "Done for today. Your streak is safe." : "One chart a day, the same for everyone."}
          </p>
        </div>
        <Link href={dailyPath(today)} className={doneToday ? "btn-secondary" : "btn-primary"}>
          {doneToday ? "See today's chart" : "Play today's chart"}
        </Link>
      </div>
      <div className="mt-4 border-t border-line pt-4">
        <DailyStatus progress={progress} today={today} />
      </div>
    </section>
  );
}
