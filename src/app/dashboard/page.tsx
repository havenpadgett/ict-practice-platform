"use client";

import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/primary-button";
import { StatCard } from "@/components/stat-card";
import {
  getExercisesCompletedCount,
  getOverallAccuracy,
  getSessionScoreLabel,
  loadAttempts,
  loadSession,
} from "@/lib/storage";

export default function DashboardPage() {
  const [stats, setStats] = useState<{
    accuracy: string;
    completed: string;
    sessionScore: string;
  } | null>(null);

  // Reading localStorage is a one-time sync from a browser-only store (it
  // isn't available during SSR), so this can't be lazy initial state — the
  // setState-in-effect here is intentional.
  useEffect(() => {
    const attempts = loadAttempts();
    const session = loadSession();
    const accuracy = getOverallAccuracy(attempts);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStats({
      accuracy: accuracy === null ? "—" : `${accuracy}%`,
      completed: String(getExercisesCompletedCount(attempts)),
      sessionScore: getSessionScoreLabel(session),
    });
  }, []);

  const display = stats ?? { accuracy: "—", completed: "—", sessionScore: "—" };

  const STATS = [
    { label: "Overall Accuracy", value: display.accuracy },
    { label: "Exercises Completed", value: display.completed },
    { label: "Session Score", value: display.sessionScore },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-10 sm:px-6 sm:pt-8 sm:pb-14">
      <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        Dashboard
      </h1>
      <p className="mt-1 text-sm text-muted">
        Your practice progress at a glance.
      </p>

      <div className="mt-8 grid grid-cols-3 gap-4">
        {STATS.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      <div className="mt-10">
        <PrimaryButton href="/practice">Start FVG Practice</PrimaryButton>
      </div>
    </div>
  );
}
