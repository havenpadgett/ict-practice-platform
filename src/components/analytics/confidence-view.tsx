import Link from "next/link";
import { conceptShortName } from "@/lib/concepts";
import { CONFIDENCE_LEVELS, type ConfidenceSummary } from "@/lib/confidence";
import { MIN_ATTEMPTS_FOR_ACCURACY } from "@/lib/practice-modes";

/** Accuracy at each confidence level, and where the confidently wrong
 * answers came from. Being sure and wrong is the most useful signal a
 * learner gets, so it gets its own line and links to practice on those
 * concepts. */
export function ConfidenceView({ summary }: { summary: ConfidenceSummary }) {
  const total = summary.rated + summary.unrated;
  if (summary.rated === 0) {
    return (
      <p className="text-sm text-muted">
        You haven&apos;t rated your confidence yet. Before you submit an answer you can say how sure you are (it&apos;s optional). Then this shows
        whether feeling sure matches being right.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      {summary.insight && <p className="max-w-2xl text-sm text-foreground">{summary.insight}</p>}

      <ul className="divide-y divide-line border-y border-line" aria-label="Accuracy by confidence">
        {summary.levels.map((l) => {
          const label = CONFIDENCE_LEVELS.find((c) => c.value === l.level)!.label;
          return (
            <li key={l.level} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-3 sm:grid-cols-[10rem_minmax(0,1fr)_14rem]">
              <span className="text-sm text-foreground">{label}</span>
              <span className="order-last col-span-2 sm:order-none sm:col-span-1">
                {l.accuracy !== null ? (
                  <span className="block h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                    <span className="block h-full rounded-full bg-muted" style={{ width: `${Math.round(l.accuracy * 100)}%` }} />
                  </span>
                ) : (
                  <span className="block h-1.5 rounded-full border border-dashed border-line" aria-hidden />
                )}
              </span>
              <span className="text-right text-xs text-muted tabular-nums">
                {l.attempts === 0 ? (
                  "None yet"
                ) : l.accuracy !== null ? (
                  <>
                    <span className="text-sm font-medium text-foreground">{Math.round(l.accuracy * 100)}%</span> right · {l.attempts} answers
                  </>
                ) : (
                  <>
                    {l.attempts} of {MIN_ATTEMPTS_FOR_ACCURACY} answers needed
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted tabular-nums">
        {summary.rated} of {total} answers rated. Unrated ones are left out.
      </p>

      {summary.confidentlyWrong.count > 0 && (
        <div>
          <h4 className="text-sm font-medium text-foreground">
            Certain, and wrong: {summary.confidentlyWrong.count} of {summary.confidentlyWrong.ofCertain} answers you were certain about
          </h4>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {summary.confidentlyWrong.byConcept.slice(0, 4).map((c) => (
              <li key={c.concept} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <span className="text-foreground">
                  {conceptShortName(c.concept)} <span className="text-muted tabular-nums">· {c.count}</span>
                </span>
                <Link href={`/practice?concept=${encodeURIComponent(c.concept)}`} className="btn-link min-h-0 text-xs">
                  Practice {conceptShortName(c.concept)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
