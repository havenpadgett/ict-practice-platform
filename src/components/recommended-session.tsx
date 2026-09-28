import Link from "next/link";
import { getPracticeCatalog } from "@/data/catalog";
import { conceptDisplayName, conceptShortName, DIFFICULTY_LABELS } from "@/lib/concepts";
import { estimateConceptMinutes } from "@/lib/practice-modes";
import type { Recommendation } from "@/lib/recommendations";

/** The engine's recommended next session: what, why, how long, one click
 * to start. Used on the dashboard and at the top of the practice picker. */
export function RecommendedSession({
  recommendation,
  headingLevel = 2,
  primary = true,
}: {
  recommendation: Recommendation;
  headingLevel?: 2 | 3;
  /** False when something else on the screen is the one primary action
   * (e.g. Continue session). */
  primary?: boolean;
}) {
  const { concept, difficulty, length, reason, href } = recommendation;
  const count = length === "all" ? getPracticeCatalog(concept).length : length;
  const minutes = estimateConceptMinutes(concept, count);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section className="card" aria-labelledby="recommended-heading">
      <p className="eyebrow">Recommended next</p>
      <Heading id="recommended-heading" className="mt-2 text-xl">
        {conceptDisplayName(concept)}
      </Heading>
      <p className="mt-1 text-sm text-foreground tabular-nums">
        {DIFFICULTY_LABELS[difficulty]} · {count} exercise{count === 1 ? "" : "s"} · about {minutes} min
      </p>
      <p className="mt-3 max-w-2xl text-sm text-muted">{reason}</p>
      <Link
        // src=rec marks the session as started from the recommendation
        // (practice_events.source), so follow-through can be measured.
        href={`${href}&src=rec`}
        className={`mt-5 ${primary ? "btn-primary" : "btn-secondary"}`}
      >
        Start {conceptShortName(concept)} practice
      </Link>
    </section>
  );
}
