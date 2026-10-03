// Scenarios that use has flagged: a failure rate far below the rest of their
// concept, or open question reports. This is how a bad answer key in an
// auto-approved scenario surfaces without a person having read it up front.
// The statistics live in the database (admin_review_flags,
// supabase/migrations/20260927150000_question_reports.sql); /admin shows the
// same list for every exercise. Server-only; admins only, because the
// database function requires the admin role.

import { createClient } from "@/lib/supabase/server";

/** Open reports that flag a human-approved exercise for re-review. */
export const FLAG_MIN_REPORTS = 2;
/** An auto-approved scenario no person has read gets the benefit of the doubt
 * once less: a single open report is enough. */
export const FLAG_MIN_REPORTS_AUTO = 1;
/** Failure-rate flag: attempts needed, and how far below the rest of its
 * concept the success rate must be (it must also be 2 standard errors
 * below, see admin_review_flags). */
export const FLAG_MIN_ATTEMPTS = 10;
export const FLAG_MIN_GAP = 0.25;

type FlagRow = {
  exercise_id: string;
  attempts: number;
  success_rate: number | null;
  peer_success_rate: number | null;
  open_reports: number;
  flagged_failure_rate: boolean;
};

export type UseFlags = {
  /** exercise_id → why it's flagged. */
  flags: Map<string, string>;
  /** Why there may be no flags (not an admin, migration not applied). */
  note: string | null;
};

const pct = (x: number | null) => (x === null ? "n/a" : `${Math.round(Number(x) * 100)}%`);

export function describeFlag(f: FlagRow, minReports: number): string | null {
  const parts: string[] = [];
  if (f.open_reports >= minReports) parts.push(`${f.open_reports} open report${f.open_reports === 1 ? "" : "s"}`);
  if (f.flagged_failure_rate) {
    parts.push(`success ${pct(f.success_rate)} over ${f.attempts} attempts vs ${pct(f.peer_success_rate)} for the rest of its concept`);
  }
  return parts.length ? parts.join("; ") : null;
}

export async function loadUseFlags(autoIds: ReadonlySet<string>): Promise<UseFlags> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_review_flags", {
    min_reports: FLAG_MIN_REPORTS_AUTO,
    min_attempts: FLAG_MIN_ATTEMPTS,
    min_gap: FLAG_MIN_GAP,
  });
  if (error) {
    return {
      flags: new Map(),
      note: "Usage flags aren't available here: they need the admin role and supabase/migrations/20260927150000_question_reports.sql applied.",
    };
  }
  const flags = new Map<string, string>();
  for (const f of data as FlagRow[]) {
    const why = describeFlag(f, autoIds.has(f.exercise_id) ? FLAG_MIN_REPORTS_AUTO : FLAG_MIN_REPORTS);
    if (why) flags.set(f.exercise_id, why);
  }
  return { flags, note: null };
}
