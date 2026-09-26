"use client";

import { useEffect, useState } from "react";
import { ConceptAccuracyBars } from "@/components/analytics/concept-accuracy-bars";
import { ConceptHighlights } from "@/components/analytics/concept-highlights";
import { DifficultyAccuracyBars } from "@/components/analytics/difficulty-accuracy-bars";
import { AnalyticsEmptyState } from "@/components/analytics/empty-state";
import { ExerciseAccuracyList } from "@/components/analytics/exercise-accuracy-list";
import { FreeTradeStatsView } from "@/components/analytics/free-trade-stats";
import { GuidedStepAccuracyBars } from "@/components/analytics/guided-step-accuracy-bars";
import { OverviewStats } from "@/components/analytics/overview-stats";
import { AccuracyTrend } from "@/components/analytics/accuracy-trend";
import { AdaptiveBreakdown } from "@/components/analytics/adaptive-breakdown";
import { ConceptDifficultyView, ProcessVsOutcomeView, RealVsConstructedView } from "@/components/analytics/depth-views";
import { ResponseTimeStatsView } from "@/components/analytics/response-time-stats";
import { ErrorBanner } from "@/components/error-banner";
import { LoadingState } from "@/components/loading-state";
import { describeError } from "@/lib/errors";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { getAccuracyTrend, getFreeTradeStats, getOverallStats, getStrongestAndWeakestConcept } from "@/lib/analytics";
import { aggregatesFromAttempts, aggregatesFromViews, fetchViewRows, type Aggregates, type ViewRows } from "@/lib/analytics-views";
import { fetchAttempts, type DbAttempt } from "@/lib/attempts";

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useRequireAuth();

  const [attempts, setAttempts] = useState<DbAttempt[] | null>(null);
  const [viewRows, setViewRows] = useState<ViewRows | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  async function loadStats(userId: string) {
    setDataLoading(true);
    setLoadError(null);
    try {
      // Aggregates come from the SQL views when they exist (null otherwise);
      // raw attempts are still needed for the trend line, Free Trade check
      // breakdown and the recommendation engine.
      const [rows, views] = await Promise.all([fetchAttempts(userId), fetchViewRows(userId)]);
      setAttempts(rows);
      setViewRows(views);
    } catch (err) {
      setLoadError(describeError(err, "load your analytics").message);
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
    // Same shell as the loaded page, so nothing moves when data arrives.
    return (
      <div className="page">
        <AnalyticsHeader />
        <div className="mt-8">
          <LoadingState label="Loading your analytics…" variant="stats" />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <AnalyticsHeader />

      {dataLoading ? (
        <div className="mt-8">
          <LoadingState label="Loading your analytics…" variant="stats" />
        </div>
      ) : loadError ? (
        <div className="mt-8">
          <ErrorBanner message={loadError} onRetry={() => loadStats(user.id)} />
        </div>
      ) : !attempts || attempts.length === 0 ? (
        <AnalyticsEmptyState />
      ) : (
        <AnalyticsContent attempts={attempts} aggregates={viewRows ? aggregatesFromViews(viewRows) : aggregatesFromAttempts(attempts)} />
      )}
    </div>
  );
}

const TREND_WINDOW = 10;

/** Shared by the loading shell and the loaded page so nothing shifts. */
function AnalyticsHeader() {
  return (
    <>
      <h1 className="page-title">Analytics</h1>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4">
        <p className="text-sm text-muted sm:text-base">How your practice is trending.</p>
        <span className="flex gap-4">
          <a href="/api/export/attempts" className="btn-link">
            Export CSV
          </a>
          <a href="/api/export/sessions" className="btn-link">
            Sessions CSV
          </a>
        </span>
      </div>
    </>
  );
}

function AnalyticsContent({ attempts, aggregates }: { attempts: DbAttempt[]; aggregates: Aggregates }) {
  const overall = getOverallStats(attempts);
  const {
    byConcept,
    byExercise,
    byDifficulty,
    responseTime,
    guidedSteps,
    conceptDifficulty,
    realVsConstructed,
    processVsOutcome,
  } = aggregates;
  const highlights = getStrongestAndWeakestConcept(byConcept);
  const freeTrade = getFreeTradeStats(attempts);
  const trend = getAccuracyTrend(attempts, TREND_WINDOW);

  return (
    <div className="mt-8 space-y-10">
      <OverviewStats stats={overall} />

      <section>
        <p className="eyebrow">Accuracy Over Time</p>
        <p className="mt-1 text-xs text-muted">Rolling accuracy over your last {TREND_WINDOW} attempts at each point.</p>
        <div className="mt-3">
          <AccuracyTrend points={trend} window={TREND_WINDOW} />
        </div>
      </section>

      <section>
        <p className="eyebrow">
          Accuracy by Concept
        </p>
        <div className="mt-3">
          <ConceptAccuracyBars byConcept={byConcept} />
        </div>
      </section>

      {Object.keys(byDifficulty).length > 0 && (
        <section>
          <p className="eyebrow">
            Accuracy by Difficulty
          </p>
          <div className="mt-3">
            <DifficultyAccuracyBars byDifficulty={byDifficulty} />
          </div>
        </section>
      )}

      {Object.keys(conceptDifficulty).length > 0 && (
        <section>
          <p className="eyebrow">Difficulty Within Each Concept</p>
          <div className="mt-3">
            <ConceptDifficultyView data={conceptDifficulty} />
          </div>
        </section>
      )}

      <section>
        <p className="eyebrow">Real Market Data vs Constructed</p>
        <p className="mt-1 text-xs text-muted">Is real data measurably harder than the hand-built exercises?</p>
        <div className="mt-3">
          <RealVsConstructedView data={realVsConstructed} />
        </div>
      </section>

      {guidedSteps.length > 0 && (
        <section>
          <p className="eyebrow">
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

      {processVsOutcome && (
        <section>
          <p className="eyebrow">Free Trade — Process vs Outcome</p>
          <div className="mt-3">
            <ProcessVsOutcomeView data={processVsOutcome} />
          </div>
        </section>
      )}


      {highlights && (
        <section>
          <p className="eyebrow">
            Strongest &amp; Weakest
          </p>
          <div className="mt-3">
            <ConceptHighlights strongest={highlights.strongest} weakest={highlights.weakest} />
          </div>
        </section>
      )}

      <section>
        <p className="eyebrow">
          Accuracy by Exercise
        </p>
        <p className="mt-1 text-xs text-muted">Most-missed exercises first.</p>
        <div className="mt-4">
          <ExerciseAccuracyList exercises={byExercise} />
        </div>
      </section>

      <section>
        <p className="eyebrow">Response Time</p>
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
