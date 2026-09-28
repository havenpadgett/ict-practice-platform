import Link from "next/link";
import { getExerciseMeta } from "@/data/catalog";
import { conceptDisplayName, DIFFICULTY_LABELS } from "@/lib/concepts";
import { sessionInsight } from "@/lib/session-insight";
import type { SessionState } from "@/lib/storage";

const FAILURE_LABELS: Record<string, string> = {
  coverage: "Box in the wrong place",
  too_small: "Box too small",
  precision: "Box too wide",
  time: "Wrong candles",
  off_level: "Line outside tolerance",
  wrong_choice: "Wrong choice",
  missed_answer: "Missed a setup that was there",
  false_positive: "Marked a setup that wasn't there",
};

/** Plain words for a missed exercise; never its database id. */
function describeMissed(id: string): { title: string; detail: string } {
  const meta = getExerciseMeta(id);
  if (!meta) return { title: "An exercise that's no longer available", detail: "" };
  const title = meta.concept === "FreeTrade" ? `Free Trade: ${meta.answerLabel}` : conceptDisplayName(meta.concept);
  return { title, detail: `${DIFFICULTY_LABELS[meta.difficulty]} · ${meta.timeframe} chart` };
}

export function SessionSummary({
  session,
  title,
  onReviewMissed,
  onPracticeAgain,
  onAdaptive,
}: {
  session: SessionState;
  /** The session's heading, e.g. "FVG Practice". */
  title: string;
  /** Starts a session of just this session's misses. */
  onReviewMissed: () => void;
  /** Same kind of session again, freshly shuffled. */
  onPracticeAgain: () => void;
  onAdaptive: () => void;
}) {
  const total = session.exercise_order.length;
  const answered = session.correct_count + session.missed_exercise_ids.length;
  const missed = [...new Set(session.missed_exercise_ids)];
  const pct = answered > 0 ? Math.round((session.correct_count / answered) * 100) : 0;
  const outcomes = session.outcomes ?? [];
  const insight = sessionInsight(outcomes, (id) => getExerciseMeta(id)?.concept);
  const failureOf = new Map(outcomes.filter((o) => !o.correct).map((o) => [o.exercise_id, o.failure_reason]));
  const difficulties = [...new Set(session.exercise_order.map((id) => getExerciseMeta(id)?.difficulty).filter(Boolean))] as (1 | 2 | 3)[];
  const skipped = total - answered;

  return (
    <div className="max-w-2xl">
      <h1 className="eyebrow">Session complete · {title}</h1>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-5xl font-semibold tracking-tight text-foreground tabular-nums">
          {session.correct_count}
          <span className="text-muted">/{answered}</span>
        </p>
        <p className="text-lg text-foreground tabular-nums">{pct}%</p>
      </div>
      <p className="mt-2 text-sm text-muted tabular-nums">
        {session.correct_count} correct · {session.missed_exercise_ids.length} missed
        {skipped > 0 && ` · ${skipped} skipped`}
        {difficulties.length > 0 && ` · ${difficulties.sort().map((d) => DIFFICULTY_LABELS[d]).join(", ")}`}
      </p>
      {insight && <p className="mt-5 text-base text-foreground">{insight}</p>}

      <div className="mt-8 flex flex-wrap gap-3">
        {missed.length > 0 ? (
          <>
            <button type="button" onClick={onReviewMissed} className="btn-primary">
              Review {missed.length} mistake{missed.length === 1 ? "" : "s"}
            </button>
            <button type="button" onClick={onPracticeAgain} className="btn-secondary">
              Practice again
            </button>
          </>
        ) : (
          <button type="button" onClick={onPracticeAgain} className="btn-primary">
            Practice again
          </button>
        )}
        <button type="button" onClick={onAdaptive} className="btn-secondary">
          Adaptive mix
        </button>
        <Link href="/dashboard" className="btn-link">
          Dashboard
        </Link>
      </div>

      {missed.length > 0 && (
        <section className="mt-section" aria-labelledby="summary-missed">
          <h2 id="summary-missed" className="text-lg">
            Missed this session
          </h2>
          <p className="mt-1 text-sm text-muted">Each one is saved to Mistakes with the correct answer drawn on the chart.</p>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {missed.map((id) => {
              const { title: name, detail } = describeMissed(id);
              const reason = failureOf.get(id);
              return (
                <li key={id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-3">
                  <span className="text-sm text-foreground">
                    {name}
                    {detail && <span className="ml-2 text-xs text-muted">{detail}</span>}
                  </span>
                  {reason && FAILURE_LABELS[reason] && <span className="text-xs text-muted">{FAILURE_LABELS[reason]}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
