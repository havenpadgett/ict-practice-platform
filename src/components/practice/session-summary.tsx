import Link from "next/link";
import { ShareButton } from "@/components/share-button";
import { ShareCard } from "@/components/share-card";
import { getExerciseMeta } from "@/data/catalog";
import { challengePath } from "@/lib/challenge";
import { conceptDisplayName, conceptShortName, DIFFICULTY_LABELS } from "@/lib/concepts";
import { FAILURE_LABELS } from "@/lib/failure-labels";
import { sessionInsight, type SessionOutcome } from "@/lib/session-insight";
import { pickChallengeFromSession, sessionCardRequest } from "@/lib/session-share";
import type { SessionState } from "@/lib/storage";

/** Plain words for a missed exercise; never its database id. */
function describeMissed(id: string): { title: string; detail: string } {
  const meta = getExerciseMeta(id);
  if (!meta) return { title: "An exercise that's no longer available", detail: "" };
  const title = meta.concept === "FreeTrade" ? `Free Trade: ${meta.answerLabel}` : conceptDisplayName(meta.concept);
  return { title, detail: `${DIFFICULTY_LABELS[meta.difficulty]} · ${meta.timeframe} chart` };
}

const STATE_LABEL = { correct: "correct", could_improve: "correct, could improve", incorrect: "missed" } as const;
const STATE_CLASS = {
  correct: "bg-accent",
  could_improve: "bg-warn",
  incorrect: "bg-danger",
} as const;

/** One mark per exercise answered, in order: how the session went at a
 * glance, as shapes as well as colors (a filled bar, a half bar, a hollow
 * bar). Real outcomes only. */
function ResultStrip({ outcomes, skipped }: { outcomes: SessionOutcome[]; skipped: number }) {
  if (outcomes.length === 0) return null;
  return (
    <div>
      <ol className="flex flex-wrap gap-1.5" aria-label="Results, in order">
        {outcomes.map((o, i) => {
          const state = o.verdict ?? (o.correct ? "correct" : "incorrect");
          return (
            <li key={i} title={`${i + 1}: ${STATE_LABEL[state]}`} className="relative h-7 w-3.5 overflow-hidden rounded-sm border border-line">
              <span
                aria-hidden
                className={`absolute inset-x-0 bottom-0 ${STATE_CLASS[state]} ${state === "incorrect" ? "h-1/4 opacity-90" : state === "could_improve" ? "h-3/4" : "h-full"}`}
              />
              <span className="sr-only">
                {i + 1}: {STATE_LABEL[state]}
              </span>
            </li>
          );
        })}
        {Array.from({ length: skipped }, (_, i) => (
          <li key={`s${i}`} title="Skipped" className="h-7 w-3.5 rounded-sm border border-dashed border-line">
            <span className="sr-only">Skipped</span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-muted">Full bar: correct. Short amber bar: correct, could improve. Short red bar: missed.</p>
    </div>
  );
}

/** Per-concept results for the session, from its own outcomes. */
function ConceptBreakdown({ outcomes }: { outcomes: SessionOutcome[] }) {
  const byConcept = new Map<string, { correct: number; total: number }>();
  for (const o of outcomes) {
    const concept = getExerciseMeta(o.exercise_id)?.concept;
    if (!concept) continue;
    const entry = byConcept.get(concept) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (o.correct) entry.correct += 1;
    byConcept.set(concept, entry);
  }
  if (byConcept.size < 2) return null;
  return (
    <section aria-labelledby="summary-concepts" className="mt-8">
      <h2 id="summary-concepts" className="eyebrow">
        By concept
      </h2>
      <ul className="mt-3 divide-y divide-line border-y border-line">
        {[...byConcept.entries()].map(([concept, v]) => (
          <li key={concept} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)_auto]">
            <span className="truncate text-sm text-foreground">{conceptShortName(concept)}</span>
            <span aria-hidden className="order-last col-span-2 mt-1.5 h-1.5 overflow-hidden rounded-full bg-line sm:order-none sm:col-span-1 sm:mt-0">
              <span className="block h-full rounded-full bg-muted" style={{ width: `${(v.correct / v.total) * 100}%` }} />
            </span>
            <span className="text-right text-sm text-foreground tabular-nums">
              {v.correct}
              <span className="text-muted">/{v.total}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
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
  const challengeId = pickChallengeFromSession(session);
  const cardRequest = answered > 0 ? sessionCardRequest(session) : null;
  const couldImprove = outcomes.filter((o) => o.verdict === "could_improve").length;

  return (
    <div className="max-w-5xl">
      <h1 className="eyebrow">Session complete · {title}</h1>

      <div className="mt-4 grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <p className="text-6xl font-semibold leading-none tracking-tight text-foreground tabular-nums sm:text-7xl">
              {session.correct_count}
              <span className="text-muted">/{answered}</span>
            </p>
            <p className="text-2xl text-foreground tabular-nums">{pct}%</p>
          </div>
          <p className="mt-3 text-sm text-muted tabular-nums">
            {session.correct_count} correct
            {couldImprove > 0 && <> ({couldImprove} could improve)</>} · {session.missed_exercise_ids.length} missed
            {skipped > 0 && ` · ${skipped} skipped`}
            {difficulties.length > 0 && ` · ${difficulties.sort().map((d) => DIFFICULTY_LABELS[d]).join(", ")}`}
          </p>

          <div className="mt-6">
            <ResultStrip outcomes={outcomes} skipped={skipped} />
          </div>

          {insight && <p className="mt-6 text-base text-foreground">{insight}</p>}

          <ConceptBreakdown outcomes={outcomes} />

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
        </div>

        {(cardRequest || challengeId) && (
          <aside aria-labelledby="summary-share" className="min-w-0">
            <h2 id="summary-share" className="eyebrow">
              Share
            </h2>
            {cardRequest && (
              <div className="mt-3">
                <ShareCard
                  auto
                  request={cardRequest}
                  filename="ict-practice-session.png"
                  alt={`Share card: ${session.correct_count} of ${answered} correct, ${title}`}
                />
              </div>
            )}
            {challengeId && (
              <div className="mt-4">
                <ShareButton
                  path={challengePath(challengeId)}
                  title={`A chart challenge from ${title}`}
                  text={missed.length > 0 ? "This chart got me. Can you read it?" : "Can you read this chart?"}
                  label="Send a friend a chart from this session"
                />
              </div>
            )}
          </aside>
        )}
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
