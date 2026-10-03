// Scenario review progress for /admin, from the scenario files and
// docs/review-log.json (the same sources /review and
// docs/SCENARIO-VALIDATION.md use).

import type { RealScenario } from "@/data/real-scenarios";
import type { ReviewLogEntry } from "@/lib/review/store";

export type RuleProgress = {
  rule: string;
  /** Live on a person's approval. */
  live: number;
  /** Live on the pipeline's approval; no person has read it. */
  auto: number;
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
    const settled = (s: RealScenario) => (s.provenance.human_reviewed || s.provenance.auto_approved) && s.provenance.review_status !== "ambiguous";
    const approved = ss.filter(settled);
    const stale = approved.filter(isStale);
    const staleN = stale.length;
    const live = approved.filter((s) => !isStale(s));
    return {
      rule,
      live: live.filter((s) => s.provenance.human_reviewed).length,
      auto: live.filter((s) => s.provenance.auto_approved).length,
      awaiting: ss.length - approved.length - ambiguous.length,
      stale: staleN,
      ambiguous: ambiguous.length,
      // Rejected scenarios are deleted from disk, so they're counted from the log.
      rejected: log.filter((e) => e.rule === rule && e.decision === "rejected").length,
    };
  });
}
