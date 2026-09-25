import { RecommendedSession } from "@/components/recommended-session";
import type { DbAttempt } from "@/lib/attempts";
import { CONCEPTS } from "@/lib/concepts";
import {
  getSubSkill,
  isWeak,
  recommendSession,
  RECENT_WINDOW,
  MIN_ATTEMPTS_FOR_WEAK,
  scoreConcepts,
  WEAK_THRESHOLD,
} from "@/lib/recommendations";

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** The engine's full reasoning: every practiced concept's score, weakest
 * first, and the session it recommends. */
export function AdaptiveBreakdown({ attempts }: { attempts: DbAttempt[] }) {
  const { concepts } = scoreConcepts(attempts);
  return (
    <div className="space-y-4">
      <RecommendedSession recommendation={recommendSession(attempts)} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="py-2 pr-3 font-medium">Concept</th>
              <th className="py-2 pr-3 font-medium">Attempts</th>
              <th className="py-2 pr-3 font-medium">All-time</th>
              <th className="py-2 pr-3 font-medium">Last {RECENT_WINDOW}</th>
              <th className="py-2 pr-3 font-medium">Skill score</th>
              <th className="py-2 font-medium">Weakest step</th>
            </tr>
          </thead>
          <tbody>
            {concepts.map((c) => {
              const sub = getSubSkill(c.concept, attempts);
              return (
                <tr key={c.concept} className="border-t border-line">
                  <td className="py-2 pr-3 text-foreground">{CONCEPTS[c.concept].pickerLabel}</td>
                  <td className="py-2 pr-3 text-muted">{c.attempts}</td>
                  <td className="py-2 pr-3 text-muted">{pct(c.accuracy)}</td>
                  <td className="py-2 pr-3 text-muted">{pct(c.recentAccuracy)}</td>
                  <td className={`py-2 pr-3 font-medium ${isWeak(c) ? "text-danger" : "text-foreground"}`}>
                    {pct(c.score)}
                    {isWeak(c) && <span className="ml-1.5 text-xs">weak</span>}
                  </td>
                  <td className="py-2 text-muted">{sub ? `${sub.name} (${pct(sub.accuracy)})` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Skill score weights recent attempts more (an attempt 10 back counts half as much as your latest) and pulls concepts
        with few attempts toward your overall accuracy, so one miss can&apos;t make a concept look weak. Below{" "}
        {pct(WEAK_THRESHOLD)} counts as weak once a concept has {MIN_ATTEMPTS_FOR_WEAK}+ attempts.
      </p>
    </div>
  );
}
