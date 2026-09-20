"use client";

import { useEffect, useState } from "react";
import { MigrationPrompt } from "@/components/auth/migration-prompt";
import { ErrorBanner } from "@/components/error-banner";
import { LoadingState } from "@/components/loading-state";
import { PrimaryButton } from "@/components/primary-button";
import { StatCard } from "@/components/stat-card";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { getStrongestAndWeakestConcept } from "@/lib/analytics";
import {
  fetchAttempts,
  getAccuracyByConcept,
  getExercisesCompletedCount,
  getOverallAccuracy,
  migrateLocalAttempts,
  type DbAttempt,
} from "@/lib/attempts";
import { CONCEPTS, type Concept } from "@/lib/concepts";
import { fetchProfile } from "@/lib/profiles";
import { clearLocalAttempts, getSessionScoreLabel, loadAttempts, loadSession } from "@/lib/storage";

export default function DashboardPage() {
  const { user, loading: authLoading } = useRequireAuth();

  const [attempts, setAttempts] = useState<DbAttempt[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const [localCount, setLocalCount] = useState(0);
  const [migrationDismissed, setMigrationDismissed] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrateError, setMigrateError] = useState<string | null>(null);

  const [streak, setStreak] = useState<number | null>(null);

  // Reading localStorage is a one-time sync from a browser-only store (it
  // isn't available during SSR), so this can't be lazy initial state — the
  // setState-in-effect here is intentional.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalCount(loadAttempts().length);
  }, []);

  async function loadStats(userId: string) {
    setDataLoading(true);
    setLoadError(null);
    try {
      const rows = await fetchAttempts(userId);
      setAttempts(rows);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load your stats.");
    } finally {
      setDataLoading(false);
    }
    // Streak is shown as "—" rather than blocking/erroring the rest of the
    // dashboard if it fails to load — it's a nice-to-have, not core data.
    try {
      const profile = await fetchProfile(userId);
      setStreak(profile?.current_streak ?? 0);
    } catch {
      setStreak(null);
    }
  }

  // Fetching from Supabase is itself the external-system sync this effect
  // exists for; loadStats is stable in shape across renders (it only
  // closes over setState setters), so re-running it whenever `user`
  // changes is the correct and only dependency.
  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStats(user.id);
  }, [user]);

  async function handleMigrate() {
    if (!user) return;
    setMigrating(true);
    setMigrateError(null);
    try {
      const local = loadAttempts();
      await migrateLocalAttempts(user.id, local);
      clearLocalAttempts();
      setLocalCount(0);
      await loadStats(user.id);
    } catch (err) {
      setMigrateError(
        err instanceof Error
          ? err.message
          : "Migration failed — your local data is untouched, nothing was lost.",
      );
    } finally {
      setMigrating(false);
    }
  }

  if (authLoading || !user) {
    return <LoadingState />;
  }

  const showMigrationPrompt = localCount > 0 && !migrationDismissed;

  const accuracy = attempts ? getOverallAccuracy(attempts) : null;
  const byConcept = attempts ? getAccuracyByConcept(attempts) : {};
  const highlights = getStrongestAndWeakestConcept(byConcept);

  const STATS = [
    { label: "Overall Accuracy", value: accuracy === null ? "—" : `${accuracy}%` },
    { label: "Exercises Completed", value: attempts ? String(getExercisesCompletedCount(attempts)) : "—" },
    { label: "Session Score", value: getSessionScoreLabel(loadSession()) },
    { label: "Practice Streak", value: streak === null ? "—" : `${streak} day${streak === 1 ? "" : "s"}` },
  ];

  const conceptStats = (Object.keys(CONCEPTS) as Concept[]).map((concept) => ({
    concept,
    label: CONCEPTS[concept].pickerLabel,
    value: byConcept[concept],
  }));

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-10 sm:px-6 sm:pt-8 sm:pb-14">
      <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        Dashboard
      </h1>
      <p className="mt-1 text-sm text-muted">
        Your practice progress at a glance.
      </p>

      {showMigrationPrompt && (
        <div className="mt-6">
          <MigrationPrompt
            count={localCount}
            migrating={migrating}
            error={migrateError}
            onMigrate={handleMigrate}
            onDismiss={() => setMigrationDismissed(true)}
          />
        </div>
      )}

      {dataLoading ? (
        <div className="mt-8">
          <LoadingState label="Loading your stats…" />
        </div>
      ) : loadError ? (
        <div className="mt-8">
          <ErrorBanner message={loadError} onRetry={() => loadStats(user.id)} />
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {STATS.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>

          <div className="mt-8">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Accuracy by Concept
            </p>
            <div className="mt-3 grid grid-cols-2 gap-4">
              {conceptStats.map((stat) => (
                <StatCard
                  key={stat.concept}
                  label={stat.label}
                  value={stat.value === undefined ? "—" : `${stat.value}%`}
                />
              ))}
            </div>
          </div>

          {highlights && (
            <div className="mt-8">
              <PrimaryButton href={`/practice?concept=${encodeURIComponent(highlights.weakest.concept)}`}>
                Practice my weakest concept (
                {CONCEPTS[highlights.weakest.concept as Concept]?.pickerLabel ?? highlights.weakest.concept})
              </PrimaryButton>
            </div>
          )}
        </>
      )}

      <div className="mt-10">
        <PrimaryButton href="/practice">Start Practicing</PrimaryButton>
      </div>
    </div>
  );
}
