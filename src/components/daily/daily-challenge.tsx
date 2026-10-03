"use client";

import Link from "next/link";
import { ChallengeRunner, type ChallengeExerciseData } from "@/components/challenge/challenge-runner";
import { DailyStatus } from "@/components/daily/daily-status";
import { useDailyProgress } from "@/hooks/use-daily-progress";
import { addDays, currentStreak, dailyPath, FIRST_DAILY } from "@/lib/daily";

/** One day's challenge: the chart, the streak above it, the neighbouring
 * days below. Only today's counts toward the streak. */
export function DailyChallenge({ exercise, date, today }: { exercise: ChallengeExerciseData; date: string; today: string }) {
  const isToday = date === today;
  const progress = useDailyProgress(today);
  // Including today's answer, so the card made right after grading carries it.
  const streakWithToday = isToday ? currentStreak(new Set([...progress.done, date]), today) : progress.streak;
  const prev = addDays(date, -1);

  return (
    <div>
      <div className="mb-6 rounded-lg border border-line bg-surface p-4 sm:p-5">
        <DailyStatus progress={progress} today={today} />
        {!isToday && (
          <p className="mt-3 text-xs text-muted">
            This is an earlier day&apos;s chart. It doesn&apos;t count toward your streak.{" "}
            <Link href={dailyPath(today)} className="underline underline-offset-4 hover:text-foreground">
              Play today&apos;s
            </Link>
          </p>
        )}
      </div>

      <ChallengeRunner
        exercise={exercise}
        source={`daily:${date}`}
        sharePath={dailyPath(date)}
        daily={{ date, streak: isToday ? streakWithToday : 0 }}
      />

      <nav aria-label="Other days" className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-line pt-5 text-sm">
        {prev >= FIRST_DAILY && (
          <Link href={dailyPath(prev)} className="btn-link">
            Yesterday&apos;s challenge
          </Link>
        )}
        {!isToday && (
          <Link href={dailyPath(addDays(date, 1) > today ? today : addDays(date, 1))} className="btn-link">
            Next day
          </Link>
        )}
      </nav>
    </div>
  );
}
