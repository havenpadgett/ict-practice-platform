"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MigrationPrompt } from "@/components/auth/migration-prompt";
import { ErrorBanner } from "@/components/error-banner";
import { LoadingState } from "@/components/loading-state";
import { RecommendedSession } from "@/components/recommended-session";
import { StatCard } from "@/components/stat-card";
import { useRequireAuth } from "@/hooks/use-require-auth";
import {
  DASHBOARD_COLUMNS,
  fetchAttempts,
  getAccuracyByConcept,
  getExercisesCompletedCount,
  getOverallAccuracy,
  migrateLocalAttempts,
  type DbAttempt,
} from "@/lib/attempts";
import { CONCEPTS, type Concept } from "@/lib/concepts";
import { fetchProfile } from "@/lib/profiles";
import { describeError } from "@/lib/errors";
import { trackRecommendationShown } from "@/lib/events";
import { recommendSession } from "@/lib/recommendations";
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
      const rows = await fetchAttempts(userId, DASHBOARD_COLUMNS);
      setAttempts(rows);
    } catch (err) {
      setLoadError(describeError(err, "load your stats").message);
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

  // Once the recommendation is on screen, record that it was shown (at
  // most once a day) so follow-through can be measured.
  useEffect(() => {
    if (!attempts) return;
    const r = recommendSession(attempts);
    trackRecommendationShown(r.concept, r.difficulty);
  }, [attempts]);

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
    // Same shell as the loaded page, so nothing moves when data arrives.
    return (
      <div className="page">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-lede">Your practice progress at a glance.</p>
        <div className="mt-8">
          <LoadingState label="Loading your stats…" variant="stats" />
        </div>
      </div>
    );
  }

  const showMigrationPrompt = localCount > 0 && !migrationDismissed;

  const accuracy = attempts ? getOverallAccuracy(attempts) : null;
  const byConcept = attempts ? getAccuracyByConcept(attempts) : {};

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
    <div className="page">
      <h1 className="page-title">
        Dashboard
      </h1>
      <p className="page-lede">Your practice progress at a glance.</p>

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
          <LoadingState label="Loading your stats…" variant="stats" />
        </div>
      ) : loadError ? (
        <div className="mt-8">
          <ErrorBanner message={loadError} onRetry={() => loadStats(user.id)} />
        </div>
      ) : attempts && attempts.length === 0 ? (
        // A brand-new account: no empty stat tiles, just where to begin.
        <div className="mt-8 space-y-6">
          <div className="card">
            <p className="eyebrow">Getting started</p>
            <h2 className="mt-2 text-xl">Your stats start with your first session</h2>
            <p className="mt-2 text-sm text-muted">
              Accuracy, streaks and per-concept breakdowns appear here once you&apos;ve answered a few exercises. Each
              one takes under a minute, and every answer comes with an explanation.
            </p>
          </div>
          <RecommendedSession recommendation={recommendSession(attempts)} />
        </div>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {STATS.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>

          <div className="mt-8">
            <p className="eyebrow">
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

          {attempts && (
            <div className="mt-8">
              <RecommendedSession recommendation={recommendSession(attempts)} />
            </div>
          )}
        </>
      )}

      <div className="mt-10">
        <Link href="/practice" className="btn-secondary">
          Browse all concepts
        </Link>
      </div>
    </div>
  );
}
