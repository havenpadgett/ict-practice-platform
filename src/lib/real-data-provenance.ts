// Public-facing counts of how the live real-data scenarios were approved, so
// marketing copy states what's true instead of a hard-coded number that goes
// stale (docs/SCENARIO-VALIDATION.md → Auto-approval).

import { exercises, isPracticeReady } from "@/data/exercises";

export function realApprovalCounts(): { human: number; auto: number; total: number } {
  const live = exercises.filter((e) => e.provenance !== undefined && isPracticeReady(e));
  const human = live.filter((e) => e.provenance!.human_reviewed).length;
  const auto = live.filter((e) => e.provenance!.auto_approved).length;
  return { human, auto, total: live.length };
}

/** One honest sentence for public pages. */
export function realProvenanceSentence(): string {
  const { human, auto } = realApprovalCounts();
  return (
    `${human} of the real-data charts were checked by hand against the written definitions. ` +
    `The other ${auto} were approved automatically from the same detection rules, with explanations written to a fixed style, ` +
    `and are spot-checked after the fact. Every one is graded by an answer key derived by code, never typed in.`
  );
}
