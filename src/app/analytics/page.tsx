"use client";

import { useEffect, useState } from "react";
import { ConceptAccuracyBars } from "@/components/analytics/concept-accuracy-bars";
import { ConceptHighlights } from "@/components/analytics/concept-highlights";
import { DifficultyAccuracyBars } from "@/components/analytics/difficulty-accuracy-bars";
import { AnalyticsEmptyState } from "@/components/analytics/empty-state";
import { ExerciseAccuracyList } from "@/components/analytics/exercise-accuracy-list";
import { FreeTradeStatsView } from "@/components/analytics/free-trade-stats";
import { GuidedStepAccuracyBars } from "@/components/analytics/guided-step-accuracy-bars";
import { ImprovementChart } from "@/components/analytics/improvement-chart";
import { OverviewStats } from "@/components/analytics/overview-stats";
import { AdaptiveBreakdown } from "@/components/analytics/adaptive-breakdown";
import { ResponseTimeStatsView } from "@/components/analytics/response-time-stats";
import { ErrorBanner } from "@/components/error-banner";
import { LoadingState } from "@/components/loading-state";
import { useRequireAuth } from "@/hooks/use-require-auth";
import {
  getAccuracyByDifficulty,
  getAccuracyByExercise,
  getAccuracyOverTime,
  getFreeTradeStats,
  getGuidedStepAccuracy,
  getOverallStats,
  getResponseTimeStats,
  getStrongestAndWeakestConcept,
} from "@/lib/analytics";
import { fetchAttempts, getAccuracyByConcept, type DbAttempt } from "@/lib/attempts";

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useRequireAuth();

  const [attempts, setAttempts] = useState<DbAttempt[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  async function loadStats(userId: string) {
    setDataLoading(true);
    setLoadError(null);
    try {
      const rows = await fetchAttempts(userId);
      setAttempts(rows);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Couldn't load your analytics.");
    } finally {
      setDataLoading(false);
    }
  }

  // Fetching from Supabase is itself the external-system sync this effect
  // exists for; loadStats is stable in shape across renders, so re-running
  // it whenever `user` changes is the correct and only dependency.
  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStats(user.id);
  }, [user]);

  if (authLoading || !user) {
    return <LoadingState />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-10 sm:px-6 sm:pt-8 sm:pb-14">
      <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        Analytics
      </h1>
      <p className="mt-1 text-sm text-muted">How your practice is trending.</p>

      {dataLoading ? (
        <div className="mt-8">
          <LoadingState label="Loading your analytics…" />
        </div>
      ) : loadError ? (
        <div className="mt-8">
          <ErrorBanner message={loadError} onRetry={() => loadStats(user.id)} />
        </div>
      ) : !attempts || attempts.length === 0 ? (
        <AnalyticsEmptyState />
      ) : (
        <AnalyticsContent attempts={attempts} />
      )}
    </div>
  );
}

function AnalyticsContent({ attempts }: { attempts: DbAttempt[] }) {
  const overall = getOverallStats(attempts);
  const byConcept = getAccuracyByConcept(attempts);
  const highlights = getStrongestAndWeakestConcept(byConcept);
  const byExercise = getAccuracyByExercise(attempts);
  const byDifficulty = getAccuracyByDifficulty(attempts);
  const blocks = getAccuracyOverTime(attempts);
  const responseTime = getResponseTimeStats(attempts);
  const guidedSteps = getGuidedStepAccuracy(attempts);
  const freeTrade = getFreeTradeStats(attempts);

  return (
    <div className="mt-8 space-y-10">
      <OverviewStats stats={overall} />

      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Accuracy by Concept
        </p>
        <div className="mt-3">
          <ConceptAccuracyBars byConcept={byConcept} />
        </div>
      </section>

      {Object.keys(byDifficulty).length > 0 && (
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Accuracy by Difficulty
          </p>
          <div className="mt-3">
            <DifficultyAccuracyBars byDifficulty={byDifficulty} />
          </div>
        </section>
      )}

      {guidedSteps.length > 0 && (
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Guided Entry — Accuracy by Step
          </p>
          <p className="mt-1 text-xs text-muted">
            Bias, entry, stop, and target graded independently — a step only counts if you actually
            reached it.
          </p>
          <div className="mt-4">
            <GuidedStepAccuracyBars steps={guidedSteps} />
          </div>
        </section>
      )}

      {freeTrade && (
        <section>
          <p className="eyebrow">Free Trade — Process Checks</p>
          <p className="mt-1 text-xs text-muted">
            Pass rate per check, graded on process — each check only counts where it applied.
          </p>
          <div className="mt-4">
            <FreeTradeStatsView stats={freeTrade} />
          </div>
        </section>
      )}

      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Improvement Over Time
        </p>
        <p className="mt-1 text-xs text-muted">Accuracy across successive blocks of 5 attempts.</p>
        <div className="mt-4">
          <ImprovementChart blocks={blocks} />
        </div>
      </section>

      {highlights && (
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Strongest &amp; Weakest
          </p>
          <div className="mt-3">
            <ConceptHighlights strongest={highlights.strongest} weakest={highlights.weakest} />
          </div>
        </section>
      )}

      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Accuracy by Exercise
        </p>
        <p className="mt-1 text-xs text-muted">Most-missed exercises first.</p>
        <div className="mt-4">
          <ExerciseAccuracyList exercises={byExercise} />
        </div>
      </section>

      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Response Time</p>
        <div className="mt-3">
          <ResponseTimeStatsView stats={responseTime} />
        </div>
      </section>

      <section>
        <p className="eyebrow">Adaptive Practice</p>
        <div className="mt-3">
          <AdaptiveBreakdown attempts={attempts} />
        </div>
      </section>
    </div>
  );
}
