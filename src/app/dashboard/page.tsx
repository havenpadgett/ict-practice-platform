"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MigrationPrompt } from "@/components/auth/migration-prompt";
import { ErrorBanner } from "@/components/error-banner";
import { LoadingState } from "@/components/loading-state";
import { RecommendedSession } from "@/components/recommended-session";
import { MetricStrip } from "@/components/metric-strip";
import { SkillRows, type SkillRow } from "@/components/skill-rows";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { DASHBOARD_COLUMNS, fetchAttempts, migrateLocalAttempts, type DbAttempt } from "@/lib/attempts";
import { conceptDisplayName, conceptShortName } from "@/lib/concepts";
import { fetchProfile } from "@/lib/profiles";
import { describeError } from "@/lib/errors";
import { trackRecommendationShown } from "@/lib/events";
import { mistakeCounts } from "@/lib/mistakes";
import { LIQUIDITY_VARIANT, MIN_ATTEMPTS_FOR_ACCURACY, RECOGNITION_CONCEPTS, TRADE_CONCEPTS } from "@/lib/practice-modes";
import { attemptsSince, conceptTrend, recentSessions } from "@/lib/progress";
import { recommendSession, scoreConcepts } from "@/lib/recommendations";
import { clearLocalAttempts, loadAttempts } from "@/lib/storage";

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
        <DashboardHeader streak={null} weekCount={null} />
        <div className="mt-8">
          <LoadingState label="Loading your stats…" variant="stats" />
        </div>
      </div>
    );
  }

  const showMigrationPrompt = localCount > 0 && !migrationDismissed;

  return (
    <div className="page">
      <DashboardHeader streak={streak} weekCount={attempts ? attemptsSince(attempts, 7).length : null} />

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
          <RecommendedSession recommendation={recommendSession(attempts)} />
          <p className="text-sm text-muted">
            Accuracy, streaks and per-concept progress appear here after your first session. Each exercise takes about a
            minute, and every answer comes with an explanation.
          </p>
        </div>
      ) : attempts ? (
        <DashboardContent attempts={attempts} streak={streak} />
      ) : null}
    </div>
  );
}

function DashboardHeader({ streak, weekCount }: { streak: number | null; weekCount: number | null }) {
  const parts = [
    streak ? `${streak}-day streak` : null,
    weekCount !== null ? `${weekCount} exercise${weekCount === 1 ? "" : "s"} this week` : null,
  ].filter(Boolean);
  return (
    <>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-lede">{parts.length > 0 ? parts.join(" · ") : "Your practice at a glance."}</p>
    </>
  );
}

function DashboardContent({ attempts, streak }: { attempts: DbAttempt[]; streak: number | null }) {
  const recommendation = recommendSession(attempts);
  const mistakes = mistakeCounts(attempts);
  const { concepts } = scoreConcepts(attempts);
  const byConcept = new Map(concepts.map((c) => [c.concept, c]));
  const correct = attempts.filter((a) => a.is_correct).length;
  const week = attemptsSince(attempts, 7);
  const weekCorrect = week.filter((a) => a.is_correct).length;

  const skillRows: SkillRow[] = [...RECOGNITION_CONCEPTS, LIQUIDITY_VARIANT, ...TRADE_CONCEPTS].map((concept) => {
    const score = byConcept.get(concept);
    return {
      key: concept,
      label: conceptDisplayName(concept),
      shortLabel: conceptShortName(concept),
      attempts: score?.attempts ?? 0,
      accuracy: score?.accuracy ?? 0,
      trend: conceptTrend(attempts.filter((a) => a.concept === concept)),
    };
  });
  // Practiced concepts first (in teaching order), then the ones not tried.
  skillRows.sort((a, b) => Number(b.attempts > 0) - Number(a.attempts > 0));

  const sessions = recentSessions(attempts, 4);

  return (
    <div className="mt-8 space-y-section">
      <div className="space-y-4">
        <RecommendedSession recommendation={recommendation} />
        {mistakes.open > 0 && (
          <div className="flex flex-col gap-3 rounded-lg border border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {mistakes.open} mistake{mistakes.open === 1 ? "" : "s"} to review
              </p>
              <p className="mt-0.5 text-sm text-muted">
                Charts you last answered incorrectly. {mistakes.cleared} cleared so far.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link href="/practice?mode=mistakes" className="btn-secondary">
                Review {mistakes.open} mistake{mistakes.open === 1 ? "" : "s"}
              </Link>
              <Link href="/mistakes" className="btn-link">
                See all
              </Link>
            </div>
          </div>
        )}
      </div>

      <section aria-labelledby="dash-summary">
        <h2 id="dash-summary" className="sr-only">
          Summary
        </h2>
        <MetricStrip
          metrics={[
            {
              label: "Accuracy",
              value: attempts.length >= MIN_ATTEMPTS_FOR_ACCURACY ? `${Math.round((correct / attempts.length) * 100)}%` : "—",
              detail: `${attempts.length} attempt${attempts.length === 1 ? "" : "s"} all time`,
            },
            {
              label: "This week",
              value: String(week.length),
              detail:
                week.length >= MIN_ATTEMPTS_FOR_ACCURACY ? `${Math.round((weekCorrect / week.length) * 100)}% correct` : "exercises answered",
            },
            { label: "Streak", value: streak === null ? "—" : `${streak} day${streak === 1 ? "" : "s"}`, detail: "days practiced in a row" },
            { label: "Mistakes cleared", value: String(mistakes.cleared), detail: `${mistakes.open} still open` },
          ]}
        />
      </section>

      <section aria-labelledby="dash-concepts">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="dash-concepts" className="text-lg">
            Concept progress
          </h2>
          <Link href="/analytics" className="btn-link">
            Analytics
          </Link>
        </div>
        <p className="mt-1 text-sm text-muted">
          Accuracy shows once a concept has {MIN_ATTEMPTS_FOR_ACCURACY} attempts. Trend compares your last 5 with the 5
          before.
        </p>
        <div className="mt-3">
          <SkillRows rows={skillRows} />
        </div>
      </section>

      {sessions.length > 0 && (
        <section aria-labelledby="dash-recent">
          <h2 id="dash-recent" className="text-lg">
            Recent sessions
          </h2>
          <ul className="mt-3 divide-y divide-line">
            {sessions.map((s) => (
              <li key={s.sessionId} className="flex items-baseline justify-between gap-4 py-3 text-sm">
                <span className="min-w-0 truncate text-foreground">
                  {s.concepts.length > 2 ? "Mixed session" : s.concepts.map(conceptShortName).join(" + ")}
                  <span className="ml-2 text-xs text-muted">{formatDay(s.endedAt)}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">
                  <span className="text-foreground">
                    {s.correct}/{s.total}
                  </span>{" "}
                  correct
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
