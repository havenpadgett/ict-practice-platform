import Link from "next/link";
import { CONCEPTS } from "@/lib/concepts";
import type { Recommendation } from "@/lib/recommendations";

const DIFFICULTY_LABELS = { 1: "Easy", 2: "Medium", 3: "Hard" } as const;

/** One-click start for the engine's recommended next session. */
export function RecommendedSession({ recommendation }: { recommendation: Recommendation }) {
  const { concept, difficulty, length, reason, href } = recommendation;
  const label = CONCEPTS[concept].pickerLabel;
  return (
    <div className="card">
      <p className="eyebrow">Recommended next session</p>
      <p className="mt-2 text-base font-semibold text-foreground">
        {label} · {DIFFICULTY_LABELS[difficulty]} · {length === "all" ? "all exercises" : `${length} exercises`}
      </p>
      <p className="mt-1 text-sm text-muted">{reason}</p>
      <Link
        // src=rec marks the session as started from the recommendation
        // (practice_events.source), so follow-through can be measured.
        href={`${href}&src=rec`}
        className="mt-4 btn-primary"
      >
        Start this session
      </Link>
    </div>
  );
}
