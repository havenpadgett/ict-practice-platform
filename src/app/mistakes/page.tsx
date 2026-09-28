"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChartThumbnail } from "@/components/chart-thumbnail";
import { ErrorBanner } from "@/components/error-banner";
import { LoadingState } from "@/components/loading-state";
import { CandlestickChart } from "@/components/practice/candlestick-chart";
import { ChartFrame } from "@/components/practice/exercise-layout";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { conceptShortName, DIFFICULTY_LABELS } from "@/lib/concepts";
import { describeError } from "@/lib/errors";
import { failureLabel } from "@/lib/failure-labels";
import { MISTAKES_SESSION_CAP } from "@/lib/mistakes";
import { loadMistakes, type MistakeItem, type ReviewChart } from "@/app/mistakes/actions";

type StatusFilter = "open" | "cleared" | "all";
const noop = () => {};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** The full-size chart for one reviewed answer, drawn exactly as in
 * practice: your answer solid, the correct one dashed. */
function ReviewChartView({ chart }: { chart: ReviewChart }) {
  switch (chart.kind) {
    case "zone":
      return (
        <CandlestickChart
          answerType="zone"
          candles={chart.candles}
          interactive={false}
          userRegion={chart.user ? { priceLow: chart.user.low, priceHigh: chart.user.high, candleIndexLow: chart.user.start, candleIndexHigh: chart.user.end } : null}
          onUserRegionChange={noop}
          correctZone={chart.correct}
        />
      );
    case "level":
      return <CandlestickChart answerType="level" candles={chart.candles} interactive={false} userLevel={chart.user} onUserLevelChange={noop} correctLevel={chart.correct} />;
    case "choice":
      return (
        <CandlestickChart
          answerType="choice"
          candles={chart.candles}
          interactive={false}
          fvgZone={chart.fvgZone}
          dealingRange={chart.dealingRange}
          showEquilibrium
        />
      );
    case "guided":
      return (
        <CandlestickChart
          answerType="guided"
          candles={chart.candles}
          interactive={false}
          entryPrice={chart.user.entry}
          stopPrice={chart.user.stop}
          targetPrice={chart.user.target}
          activeField={null}
          onActiveFieldChange={noop}
          correctEntry={chart.correct.entry}
          correctStop={chart.correct.stop}
          correctTarget={chart.correct.target}
        />
      );
    case "free":
      return (
        <CandlestickChart
          answerType="free"
          candles={chart.candles}
          interactive={false}
          extraSlots={0}
          entryPrice={chart.user.entry}
          stopPrice={chart.user.stop}
          targetPrice={chart.user.target}
          activeField={null}
          onActiveFieldChange={noop}
          entryIndex={chart.user.entryIndex}
          exit={chart.user.exit}
          idealEntryZone={chart.ideal.entryZone}
          idealStopZone={chart.ideal.stopZone}
          idealTarget={chart.ideal.target}
        />
      );
  }
}

function MistakeRow({ item }: { item: MistakeItem }) {
  const [open, setOpen] = useState(false);
  const why = failureLabel(item.failureReason, item.answerType);
  const panelId = `mistake-${item.exercise_id}`;
  return (
    <li className="py-4">
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className="w-28 shrink-0 overflow-hidden rounded-md border border-line bg-surface transition-colors hover:border-control sm:w-40"
        >
          <span className="sr-only">{open ? "Hide" : "Show"} the full chart for this mistake</span>
          <ChartThumbnail chart={item.chart} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {item.answerType === "free" ? `Free Trade: ${item.answerLabel}` : item.conceptLabel}
          </p>
          <p className="mt-0.5 text-xs text-muted tabular-nums">
            {DIFFICULTY_LABELS[item.difficulty]}
            {why && <> · {why}</>}
            {" · "}
            {item.status === "cleared"
              ? `Cleared ${item.clearedAt ? formatDate(item.clearedAt) : ""}`
              : `Missed ${item.missed === 1 ? "once" : `${item.missed} times`}, last ${formatDate(item.lastMissedAt)}`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4">
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={panelId} className="btn-link">
              {open ? "Hide review" : "Review"}
            </button>
            {item.retryable ? (
              <Link href={`/practice?retry=${encodeURIComponent(item.exercise_id)}`} className="btn-link">
                {item.status === "cleared" ? "Practice again" : "Retry"}
              </Link>
            ) : (
              <span className="text-xs text-muted">Withdrawn, can&apos;t be retried</span>
            )}
          </div>
        </div>
      </div>
      {open && (
        <div id={panelId} className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <ChartFrame>
            <ReviewChartView chart={item.chart} />
          </ChartFrame>
          <div className="text-sm">
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[7rem_1fr] lg:grid-cols-1">
              <dt className="text-muted">Your answer</dt>
              <dd className="text-foreground">{item.yourAnswer}</dd>
              <dt className="text-muted">Correct answer</dt>
              <dd className="text-foreground">{item.correctAnswer}</dd>
            </dl>
            <p className="mt-4 text-muted">{item.explanation}</p>
          </div>
        </div>
      )}
    </li>
  );
}

export default function MistakesPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [items, setItems] = useState<MistakeItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>("open");
  const [concept, setConcept] = useState("all");
  const [difficulty, setDifficulty] = useState("all");

  async function load() {
    setError(null);
    try {
      const res = await loadMistakes();
      if (res.ok) setItems(res.items);
      else setError(res.error);
    } catch (err) {
      setError(describeError(err, "load your mistakes").message);
    }
  }

  // Fetching from the server is the external sync this effect exists for.
  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [user]);

  const open = items?.filter((i) => i.status === "open") ?? [];
  const cleared = items?.filter((i) => i.status === "cleared") ?? [];
  const retryableOpen = open.filter((i) => i.retryable).length;
  const concepts = useMemo(() => [...new Set((items ?? []).map((i) => i.concept))], [items]);
  const shown = (items ?? []).filter(
    (i) =>
      (status === "all" || i.status === status) &&
      (concept === "all" || i.concept === concept) &&
      (difficulty === "all" || String(i.difficulty) === difficulty),
  );

  return (
    <div className="page max-w-5xl">
      <h1 className="page-title">Mistakes</h1>
      <p className="page-lede">Every chart you&apos;ve answered incorrectly, with your answer beside the correct one.</p>

      {authLoading || !user || (items === null && !error) ? (
        <div className="mt-8">
          <LoadingState label="Loading your mistakes…" variant="stats" />
        </div>
      ) : error ? (
        <div className="mt-8">
          <ErrorBanner message={error} onRetry={load} />
        </div>
      ) : items && items.length === 0 ? (
        <div className="mt-8 max-w-xl">
          <p className="text-base text-foreground">Nothing to review yet.</p>
          <p className="mt-1 text-sm text-muted">
            When you miss an exercise it shows up here, drawn with your answer and the correct one, so you can retry it.
          </p>
          <Link href="/practice" className="mt-5 btn-primary">
            Start practicing
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            {retryableOpen > 0 && (
              <Link href="/practice?mode=mistakes" className="btn-primary">
                Review {Math.min(retryableOpen, MISTAKES_SESSION_CAP)} mistake{retryableOpen === 1 ? "" : "s"}
              </Link>
            )}
            <p className="text-sm text-muted tabular-nums">
              {open.length} to review · {cleared.length} cleared
            </p>
          </div>
          <p className="mt-3 text-xs text-muted">
            A mistake is cleared when your latest answer on that chart is correct. Mistake review sessions count toward your
            stats; &ldquo;Retry this chart&rdquo; right after an answer doesn&apos;t.
          </p>

          <div className="mt-8 flex flex-wrap items-end gap-3 border-b border-line pb-4" role="group" aria-label="Filter mistakes">
            <div className="flex gap-2" role="group" aria-label="Status">
              {(
                [
                  ["open", `To review (${open.length})`],
                  ["cleared", `Cleared (${cleared.length})`],
                  ["all", "All"],
                ] as [StatusFilter, string][]
              ).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className="btn-option px-3 text-xs">
                  {label}
                </button>
              ))}
            </div>
            <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto">
            <label className="text-xs text-muted">
              <span className="sr-only">Concept</span>
              <select value={concept} onChange={(e) => setConcept(e.target.value)} className="field mt-0 w-full sm:w-auto">
                <option value="all">All concepts</option>
                {concepts.map((c) => (
                  <option key={c} value={c}>
                    {conceptShortName(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              <span className="sr-only">Difficulty</span>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="field mt-0 w-full sm:w-auto">
                <option value="all">All difficulties</option>
                <option value="1">Easy</option>
                <option value="2">Medium</option>
                <option value="3">Hard</option>
              </select>
            </label>
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="mt-6 text-sm text-muted">
              {status === "open" && open.length === 0 ? "Nothing left to review. Every mistake has been cleared." : "No mistakes match these filters."}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((item) => (
                <MistakeRow key={item.exercise_id} item={item} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
