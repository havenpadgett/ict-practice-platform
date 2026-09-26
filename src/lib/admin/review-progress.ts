// Scenario review progress for /admin, from the scenario files and
// docs/review-log.json (the same sources /review and
// docs/SCENARIO-VALIDATION.md use).

import type { RealScenario } from "@/data/real-scenarios";
import type { ReviewLogEntry } from "@/lib/review/store";

export type RuleProgress = {
  rule: string;
  live: number;
  awaiting: number;
  stale: number;
  ambiguous: number;
  rejected: number;
};

export function reviewProgress(
  scenarios: RealScenario[],
  log: ReviewLogEntry[],
  isStale: (s: RealScenario) => boolean,
): RuleProgress[] {
  const rules = Array.from(new Set([...scenarios.map((s) => s.provenance.detection_rule), ...log.map((e) => e.rule)])).sort();
  return rules.map((rule) => {
    const ss = scenarios.filter((s) => s.provenance.detection_rule === rule);
    const ambiguous = ss.filter((s) => s.provenance.review_status === "ambiguous");
    const reviewed = ss.filter((s) => s.provenance.human_reviewed && s.provenance.review_status !== "ambiguous");
    const stale = reviewed.filter(isStale).length;
    return {
      rule,
      live: reviewed.length - stale,
      awaiting: ss.length - reviewed.length - ambiguous.length,
      stale,
      ambiguous: ambiguous.length,
      // Rejected scenarios are deleted from disk, so they're counted from the log.
      rejected: log.filter((e) => e.rule === rule && e.decision === "rejected").length,
    };
  });
}
