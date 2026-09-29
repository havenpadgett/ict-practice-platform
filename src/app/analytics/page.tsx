"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AccuracyTrend } from "@/components/analytics/accuracy-trend";
import { AdaptiveBreakdown } from "@/components/analytics/adaptive-breakdown";
import { ConceptDifficultyView, ProcessVsOutcomeView, RealVsConstructedView } from "@/components/analytics/depth-views";
import { AnalyticsEmptyState } from "@/components/analytics/empty-state";
import { ExerciseAccuracyList } from "@/components/analytics/exercise-accuracy-list";
import { FreeTradeStatsView } from "@/components/analytics/free-trade-stats";
import { GuidedStepAccuracyBars } from "@/components/analytics/guided-step-accuracy-bars";
import { ErrorBanner } from "@/components/error-banner";
import { LoadingState } from "@/components/loading-state";
import { Menu, MENU_ITEM } from "@/components/menu";
import { MetricStrip } from "@/components/metric-strip";
import { SkillRows } from "@/components/skill-rows";
import { describeError } from "@/lib/errors";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { formatResponseTime, getAccuracyTrend, getFreeTradeStats, getOverallStats } from "@/lib/analytics";
import { analyticsInsight } from "@/lib/analytics-insight";
import { aggregatesFromAttempts, aggregatesFromViews, fetchViewRows, type ViewRows } from "@/lib/analytics-views";
import { fetchAttempts, type DbAttempt } from "@/lib/attempts";
import { CONCEPT_LIST, conceptDisplayName, conceptShortName, DIFFICULTY_LABELS } from "@/lib/concepts";
import { MIN_ATTEMPTS_FOR_ACCURACY } from "@/lib/practice-modes";
import { conceptTrend, filterAttempts, rateByDifficulty, type ModeFilter } from "@/lib/progress";
import { scoreConcepts } from "@/lib/recommendations";

const PERIODS = [
  { days: 7, label: "7 days", phrase: "in the last 7 days" },
  { days: 30, label: "30 days", phrase: "in the last 30 days" },
  { days: null, label: "All time", phrase: "all time" },
] as const;

const MODES: { value: ModeFilter; label: string }[] = [
  { value: "all", label: "All modes" },
  { value: "recognition", label: "Recognition" },
  { value: "guided", label: "Guided Entry" },
  { value: "free", label: "Free Trade" },
];

const TREND_WINDOW = 10;

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
      // raw attempts are still needed for filters, the trend line, Free
      // Trade checks and the recommendation engine.
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

  return (
    <div className="page max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-lede">How your practice is going, and where it isn&apos;t yet.</p>
        </div>
        <Menu
          label="More actions"
          triggerClassName="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted transition-colors hover:text-foreground"
          trigger={
            <svg viewBox="0 0 20 20" width={20} height={20} aria-hidden fill="currentColor">
              <circle cx="4.5" cy="10" r="1.5" />
              <circle cx="10" cy="10" r="1.5" />
              <circle cx="15.5" cy="10" r="1.5" />
            </svg>
          }
        >
          {(close) => (
            <>
              <a href="/api/export/attempts" onClick={close} className={MENU_ITEM}>
                Export attempts (CSV)
              </a>
              <a href="/api/export/sessions" onClick={close} className={MENU_ITEM}>
                Export sessions (CSV)
              </a>
            </>
          )}
        </Menu>
      </div>

      {authLoading || !user || dataLoading ? (
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
        <AnalyticsContent attempts={attempts} viewRows={viewRows} />
      )}
    </div>
  );
}

function Section({ id, title, lede, children }: { id: string; title: string; lede?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-8">
      <h2 id={id} className="text-lg">
        {title}
      </h2>
      {lede && <p className="mt-1 text-sm text-muted">{lede}</p>}
      <div className="mt-5 space-y-8">{children}</div>
    </section>
  );
}

function Sub({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="eyebrow">{title}</h3>
      {note && <p className="mt-1 text-xs text-muted">{note}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function AnalyticsContent({ attempts, viewRows }: { attempts: DbAttempt[]; viewRows: ViewRows | null }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(PERIODS[2]);
  const [mode, setMode] = useState<ModeFilter>("all");
  const [concept, setConcept] = useState("all");

  const unfiltered = period.days === null && mode === "all" && concept === "all";
  const filtered = useMemo(() => filterAttempts(attempts, { days: period.days, mode, concept }), [attempts, period, mode, concept]);
  // The SQL views cover all-time, all-mode numbers; any filter is computed
  // here from the same attempts (tests/sql/parity.test.ts keeps them equal).
  const aggregates = unfiltered && viewRows ? aggregatesFromViews(viewRows) : aggregatesFromAttempts(filtered);
  const practicedConcepts = CONCEPT_LIST.filter((c) => attempts.some((a) => a.concept === c));

  const overall = getOverallStats(filtered);
  const scores = scoreConcepts(filtered).concepts;
  const freeTrade = getFreeTradeStats(filtered);
  const trend = getAccuracyTrend(filtered, TREND_WINDOW);
  const difficulty = rateByDifficulty(filtered);
  const hasTrade = filtered.some((a) => a.concept === "GuidedEntry" || a.concept === "FreeTrade");
  const hasReal = aggregates.realVsConstructed.real !== null;

  return (
    <div className="mt-8 space-y-10">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filter analytics">
        <div className="flex gap-2" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p.label} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)} className="btn-option px-3 text-xs">
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto">
          <label>
            <span className="sr-only">Practice mode</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as ModeFilter)} className="field mt-0 w-full sm:w-auto">
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Concept</span>
            <select value={concept} onChange={(e) => setConcept(e.target.value)} className="field mt-0 w-full sm:w-auto">
              <option value="all">All concepts</option>
              {practicedConcepts.map((c) => (
                <option key={c} value={c}>
                  {conceptShortName(c)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className="max-w-3xl text-lg leading-snug text-foreground">{analyticsInsight(filtered, period.phrase)}</p>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">Nothing matches these filters. Try a longer period or all modes.</p>
      ) : (
        <>
          <Section id="an-overview" title="Overview">
            <MetricStrip
              metrics={[
                {
                  label: "Accuracy",
                  value: filtered.length >= MIN_ATTEMPTS_FOR_ACCURACY && overall.accuracy !== null ? `${overall.accuracy}%` : "—",
                  detail: `${overall.totalExercises} attempt${overall.totalExercises === 1 ? "" : "s"}`,
                },
                { label: "Sessions", value: String(overall.totalSessions), detail: period.label === "All time" ? "all time" : `last ${period.label}` },
                {
                  label: "Typical answer time",
                  value: aggregates.responseTime.avgCorrectMs === null ? "—" : formatResponseTime(aggregates.responseTime.avgCorrectMs),
                  detail: "on correct answers",
                },
              ]}
            />
            {trend.length >= TREND_WINDOW && (
              <Sub title="Accuracy over time" note={`Each point is your accuracy over the ${TREND_WINDOW} attempts up to it.`}>
                <AccuracyTrend points={trend} window={TREND_WINDOW} />
              </Sub>
            )}
          </Section>

          <Section id="an-concepts" title="Concepts" lede={`Accuracy shows once a concept has ${MIN_ATTEMPTS_FOR_ACCURACY} attempts in this view.`}>
            <SkillRows
              rows={scores
                .slice()
                .sort((a, b) => CONCEPT_LIST.indexOf(a.concept) - CONCEPT_LIST.indexOf(b.concept))
                .map((c) => ({
                  key: c.concept,
                  label: conceptDisplayName(c.concept),
                  shortLabel: conceptShortName(c.concept),
                  attempts: c.attempts,
                  accuracy: c.accuracy,
                  couldImprove: (aggregates.couldImproveByConcept[c.concept] ?? 0) / 100,
                  trend: conceptTrend(filtered.filter((a) => a.concept === c.concept)),
                }))}
            />
            {difficulty.length > 1 && (
              <Sub title="By difficulty">
                <SkillRows
                  rows={difficulty.map((d) => ({ key: String(d.level), label: DIFFICULTY_LABELS[d.level], attempts: d.attempts, accuracy: d.accuracy }))}
                />
              </Sub>
            )}
          </Section>

          {hasTrade && (
            <Section id="an-trade" title="Trade practice" lede="Graded on process, not on whether the trade won.">
              {aggregates.guidedSteps.length > 0 && (
                <Sub title="Guided Entry, by step" note="A step only counts where you reached it.">
                  <GuidedStepAccuracyBars steps={aggregates.guidedSteps} />
                </Sub>
              )}
              {freeTrade && (
                <Sub title="Free Trade, process checks" note="Each check only counts where it applied.">
                  <FreeTradeStatsView stats={freeTrade} />
                </Sub>
              )}
              {aggregates.processVsOutcome && (
                <Sub title="Process vs outcome">
                  <ProcessVsOutcomeView data={aggregates.processVsOutcome} />
                </Sub>
              )}
            </Section>
          )}

          <section aria-labelledby="an-details" className="border-t border-line pt-8">
            <h2 id="an-details" className="text-lg">
              Details
            </h2>
            <div className="mt-3 divide-y divide-line">
              <Details title="Most-missed exercises">
                <ExerciseAccuracyList exercises={aggregates.byExercise.slice(0, 12)} />
              </Details>
              {Object.keys(aggregates.conceptDifficulty).length > 0 && (
                <Details title="Difficulty within each concept">
                  <ConceptDifficultyView data={aggregates.conceptDifficulty} />
                </Details>
              )}
              <Details title="Answer time">
                <p className="text-sm text-foreground tabular-nums">
                  Correct answers:{" "}
                  {aggregates.responseTime.avgCorrectMs === null ? "—" : formatResponseTime(aggregates.responseTime.avgCorrectMs)} on average ·
                  incorrect: {aggregates.responseTime.avgIncorrectMs === null ? "—" : formatResponseTime(aggregates.responseTime.avgIncorrectMs)}
                </p>
                <p className="mt-2 text-xs text-muted">
                  For reference only. Faster isn&apos;t better: taking time to check the rule is the point of practice.
                </p>
              </Details>
              <Details title="How recommendations are chosen">
                <AdaptiveBreakdown attempts={filtered} />
              </Details>
              {hasReal && (
                <Details title="Real market data vs constructed">
                  <RealVsConstructedView data={aggregates.realVsConstructed} />
                </Details>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Details({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group py-2">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
        {title}
        <svg viewBox="0 0 16 16" width={16} height={16} aria-hidden className="text-muted transition-transform group-open:rotate-180">
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="pt-2 pb-4">{children}</div>
    </details>
  );
}
