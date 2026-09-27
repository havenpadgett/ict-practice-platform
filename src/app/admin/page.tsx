// Product health for whoever runs the app — every user's numbers, unlike
// /analytics which shows the signed-in user their own. src/proxy.ts requires
// a login; this page requires the admin role (profiles.role, checked on the
// server, src/lib/review/access.ts). The database numbers come from the
// SECURITY DEFINER functions in
// supabase/migrations/20260926140000_admin_functions.sql, which check the
// role again themselves (is_admin(), redefined in 20260927120000_roles.sql).

import type { Metadata } from "next";
import { resolveReports } from "@/app/admin/actions";
import { StatCard } from "@/components/stat-card";
import { CONCEPTS, type Concept } from "@/lib/concepts";
import { reviewProgress, type RuleProgress } from "@/lib/admin/review-progress";
import { reasonLabel } from "@/lib/report-reasons";
import { getAccess, ROLE_SETUP_HINT } from "@/lib/review/access";
import { listScenarios, readReviewLog, staleFor } from "@/lib/review/store";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  // Internal tooling: keep it out of search results.
  robots: { index: false, follow: false },
};

type Overview = {
  total_users: number;
  active_users_7d: number;
  total_attempts: number;
  attempts_7d: number;
  overall_accuracy: number | null;
  sessions_started: number;
  sessions_completed: number;
  completion_rate: number | null;
  sessions_with_attempts: number;
};
type ExerciseFailure = {
  exercise_id: string;
  concept: string;
  is_real: boolean;
  difficulty: number | null;
  attempts: number;
  users: number;
  success_rate: number;
};
type ConceptRank = { concept: string; attempts: number; users: number; accuracy: number; difficulty_rank: number };

type DbState =
  | { kind: "ok"; overview: Overview; failures: ExerciseFailure[]; concepts: ConceptRank[] }
  | { kind: "not_applied" }
  | { kind: "not_admin" }
  | { kind: "error"; message: string };

const MIN_ATTEMPTS = 5;

type ExerciseReports = {
  exercise_id: string;
  reports: number;
  open_reports: number;
  reporters: number;
  answer_wrong: number;
  chart_unclear: number;
  ambiguous: number;
  technical: number;
  other: number;
  last_reported_at: string;
};
type RecentReport = { id: string; exercise_id: string; reason: string; note: string | null; stage: string; created_at: string };
type ReviewFlag = {
  exercise_id: string;
  concept: string | null;
  attempts: number;
  success_rate: number | null;
  peer_success_rate: number | null;
  open_reports: number;
  flagged_reports: boolean;
  flagged_failure_rate: boolean;
};

type ReportsState =
  | { kind: "ok"; perExercise: ExerciseReports[]; recent: RecentReport[]; flags: ReviewFlag[] }
  | { kind: "not_applied" }
  | { kind: "error"; message: string };

/** Open reports that flag an exercise for re-review. */
const FLAG_MIN_REPORTS = 2;
/** Failure-rate flag: attempts needed, and how far below the rest of its
 * concept the success rate must be (it must also be 2 standard errors
 * below; see admin_review_flags in 20260927150000_question_reports.sql). */
const FLAG_MIN_ATTEMPTS = 10;
const FLAG_MIN_GAP = 0.25;

async function loadReports(): Promise<ReportsState> {
  const supabase = await createClient();
  const [perExercise, recent, flags] = await Promise.all([
    supabase.rpc("admin_exercise_reports"),
    supabase.rpc("admin_recent_reports", { max_rows: 20 }),
    supabase.rpc("admin_review_flags", { min_reports: FLAG_MIN_REPORTS, min_attempts: FLAG_MIN_ATTEMPTS, min_gap: FLAG_MIN_GAP }),
  ]);
  const error = perExercise.error ?? recent.error ?? flags.error;
  if (error) {
    return error.code === "PGRST202" || /admin_(exercise_reports|recent_reports|review_flags)/.test(error.message)
      ? { kind: "not_applied" }
      : { kind: "error", message: error.message };
  }
  return {
    kind: "ok",
    perExercise: perExercise.data as ExerciseReports[],
    recent: recent.data as RecentReport[],
    flags: flags.data as ReviewFlag[],
  };
}

function pct(x: number | null | undefined): string {
  return x === null || x === undefined ? "—" : `${Math.round(Number(x) * 100)}%`;
}

function conceptLabel(concept: string): string {
  return CONCEPTS[concept as Concept]?.pickerLabel ?? concept;
}

async function loadDb(): Promise<{ isAdmin: boolean; state: DbState }> {
  const supabase = await createClient();
  const admin = await supabase.rpc("is_admin");
  if (admin.error) {
    // PGRST202: the function doesn't exist, i.e. the migration isn't applied.
    return admin.error.code === "PGRST202" || /is_admin/.test(admin.error.message)
      ? { isAdmin: false, state: { kind: "not_applied" } }
      : { isAdmin: false, state: { kind: "error", message: admin.error.message } };
  }
  if (admin.data !== true) return { isAdmin: false, state: { kind: "not_admin" } };
  const [overview, failures, concepts] = await Promise.all([
    supabase.rpc("admin_overview"),
    supabase.rpc("admin_exercise_failures", { min_attempts: MIN_ATTEMPTS, max_rows: 15 }),
    supabase.rpc("admin_concept_ranking"),
  ]);
  const error = overview.error ?? failures.error ?? concepts.error;
  if (error) return { isAdmin: true, state: { kind: "error", message: error.message } };
  return {
    isAdmin: true,
    state: {
      kind: "ok",
      overview: (overview.data as Overview[])[0],
      failures: failures.data as ExerciseFailure[],
      concepts: concepts.data as ConceptRank[],
    },
  };
}

async function loadReview(): Promise<{ rows: RuleProgress[]; error: string | null }> {
  try {
    const [{ scenarios }, log] = await Promise.all([listScenarios(), readReviewLog()]);
    return { rows: reviewProgress(scenarios, log, (s) => staleFor(s).length > 0), error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function AdminPage() {
  const access = await getAccess();
  if (access.kind !== "ok" || access.role !== "admin") {
    return (
      <div className="page">
        <h1 className="page-title">Admin</h1>
        <p className="page-lede">Not authorized. {ROLE_SETUP_HINT}</p>
      </div>
    );
  }
  const [db, review, reports] = await Promise.all([loadDb(), loadReview(), loadReports()]);

  return (
    <div className="page max-w-5xl">
      <h1 className="page-title">Product health</h1>
      <p className="page-lede">Every user, every attempt. Your own progress is on Analytics.</p>

      <DbSections state={db.state} />

      <ReportSections state={reports} />

      <section className="mt-section">
        <p className="eyebrow">Real scenario review</p>
        <p className="mt-1 text-xs text-muted">
          From the scenario files and docs/review-log.json. Live scenarios are approved under the current curriculum.
          Stale ones were approved under a definition that has since changed and need re-review.
        </p>
        {review.error ? (
          <p className="text-error mt-3 text-sm">Couldn&apos;t read the scenario files: {review.error}</p>
        ) : (
          <ReviewTable rows={review.rows} />
        )}
      </section>
    </div>
  );
}

function DbSections({ state }: { state: DbState }) {
  if (state.kind !== "ok") {
    const message = {
      not_applied:
        "Database numbers need supabase/migrations/20260926140000_admin_functions.sql (and the two migrations before it) applied.",
      not_admin: "The database didn't confirm the admin role for this account.",
      error: `Couldn't load database numbers: ${state.kind === "error" ? state.message : ""}`,
    }[state.kind];
    return (
      <div className="card mt-8 text-sm" role="status">
        <p className={state.kind === "error" ? "text-danger" : "text-muted"}>{message}</p>
      </div>
    );
  }
  const { overview: o, failures, concepts } = state;
  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Users" value={`${o.total_users}`} />
        <StatCard label="Active, 7 days" value={`${o.active_users_7d}`} />
        <StatCard label="Attempts" value={`${o.total_attempts}`} />
        <StatCard label="Accuracy" value={pct(o.overall_accuracy)} />
        <StatCard label="Sessions started" value={`${o.sessions_started}`} />
        <StatCard label="Sessions completed" value={`${o.sessions_completed}`} />
        <StatCard label="Completion rate" value={pct(o.completion_rate)} />
        <StatCard label="Attempts, 7 days" value={`${o.attempts_7d}`} />
      </div>
      <p className="mt-2 text-xs text-muted">
        Sessions are counted from event tracking. {o.sessions_with_attempts} sessions appear in attempts, including
        ones from before tracking began.
      </p>

      <section className="mt-section">
        <p className="eyebrow">Most-failed exercises</p>
        <p className="mt-1 text-xs text-muted">
          Lowest success rate across all users, with at least {MIN_ATTEMPTS} attempts. Check the answer key of one far below
          others of its concept before blaming the users.
        </p>
        {failures.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No exercise has {MIN_ATTEMPTS}+ attempts yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Exercise</th>
                  <th className="py-2 pr-3 font-medium">Concept</th>
                  <th className="py-2 pr-3 font-medium">Difficulty</th>
                  <th className="py-2 pr-3 font-medium">Attempts</th>
                  <th className="py-2 pr-3 font-medium">Users</th>
                  <th className="py-2 font-medium">Success</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((f) => (
                  <tr key={f.exercise_id} className="border-t border-line">
                    <td className="py-2 pr-3 font-mono text-foreground">{f.exercise_id}</td>
                    <td className="py-2 pr-3 text-muted">
                      {conceptLabel(f.concept)}
                      {f.is_real && <span className="ml-1.5 text-xs">real</span>}
                    </td>
                    <td className="py-2 pr-3 text-muted">{f.difficulty ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted">{f.attempts}</td>
                    <td className="py-2 pr-3 text-muted">{f.users}</td>
                    <td className="py-2 font-medium text-foreground">{pct(f.success_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-section">
        <p className="eyebrow">Concept difficulty</p>
        <p className="mt-1 text-xs text-muted">Hardest first, by accuracy across all users. Read accuracy with its attempt count.</p>
        {concepts.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No attempts yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Rank</th>
                  <th className="py-2 pr-3 font-medium">Concept</th>
                  <th className="py-2 pr-3 font-medium">Attempts</th>
                  <th className="py-2 pr-3 font-medium">Users</th>
                  <th className="py-2 font-medium">Accuracy</th>
                </tr>
              </thead>
              <tbody>
                {concepts.map((c) => (
                  <tr key={c.concept} className="border-t border-line">
                    <td className="py-2 pr-3 text-muted">{c.difficulty_rank}</td>
                    <td className="py-2 pr-3 text-foreground">{conceptLabel(c.concept)}</td>
                    <td className="py-2 pr-3 text-muted">{c.attempts}</td>
                    <td className="py-2 pr-3 text-muted">{c.users}</td>
                    <td className="py-2 font-medium text-foreground">{pct(c.accuracy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function ReviewTable({ rows }: { rows: RuleProgress[] }) {
  if (rows.length === 0) return <p className="mt-3 text-sm text-muted">No real scenarios built yet.</p>;
  const total = (k: keyof Omit<RuleProgress, "rule">) => rows.reduce((n, r) => n + r[k], 0);
  const cols: [keyof Omit<RuleProgress, "rule">, string][] = [
    ["live", "Live"],
    ["awaiting", "Awaiting review"],
    ["stale", "Stale"],
    ["ambiguous", "Ambiguous"],
    ["rejected", "Rejected"],
  ];
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="py-2 pr-3 font-medium">Rule</th>
            {cols.map(([k, label]) => (
              <th key={k} className="py-2 pr-3 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rule} className="border-t border-line">
              <td className="py-2 pr-3 font-mono text-foreground">{r.rule}</td>
              {cols.map(([k]) => (
                <td key={k} className="py-2 pr-3 text-muted">
                  {r[k]}
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-line font-medium text-foreground">
            <td className="py-2 pr-3">Total</td>
            {cols.map(([k]) => (
              <td key={k} className="py-2 pr-3">
                {total(k)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ReportSections({ state }: { state: ReportsState }) {
  if (state.kind !== "ok") {
    return (
      <section className="mt-section">
        <p className="eyebrow">Question reports</p>
        <div className="card mt-3 text-sm" role="status">
          <p className={state.kind === "error" ? "text-danger" : "text-muted"}>
            {state.kind === "error"
              ? `Couldn't load reports: ${state.message}`
              : "Reports need supabase/migrations/20260927150000_question_reports.sql applied."}
          </p>
        </div>
      </section>
    );
  }
  const { perExercise, recent, flags } = state;
  return (
    <>
      <section className="mt-section">
        <p className="eyebrow">Flagged for re-review</p>
        <p className="mt-1 text-xs text-muted">
          {FLAG_MIN_REPORTS}+ open reports, or a success rate at least {Math.round(FLAG_MIN_GAP * 100)} points below the
          rest of its concept over {FLAG_MIN_ATTEMPTS}+ attempts (and clear of chance). Re-review the answer key and chart,
          then mark it re-reviewed to close its reports.
        </p>
        {flags.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing flagged.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Exercise</th>
                  <th className="py-2 pr-3 font-medium">Why</th>
                  <th className="py-2 pr-3 font-medium">Open reports</th>
                  <th className="py-2 pr-3 font-medium">Success</th>
                  <th className="py-2 pr-3 font-medium">Rest of concept</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {flags.map((f) => (
                  <tr key={f.exercise_id} className="border-t border-line">
                    <td className="py-2 pr-3 font-mono text-foreground">{f.exercise_id}</td>
                    <td className="py-2 pr-3 text-muted">
                      {[f.flagged_reports && "Reports", f.flagged_failure_rate && "Failure rate"].filter(Boolean).join(" + ")}
                    </td>
                    <td className="py-2 pr-3 text-muted">{f.open_reports}</td>
                    <td className="py-2 pr-3 text-muted">
                      {pct(f.success_rate)} {f.attempts > 0 && <span className="text-xs">of {f.attempts}</span>}
                    </td>
                    <td className="py-2 pr-3 text-muted">{pct(f.peer_success_rate)}</td>
                    <td className="py-2 text-right">
                      {f.open_reports > 0 && (
                        <form action={resolveReports}>
                          <input type="hidden" name="exerciseId" value={f.exercise_id} />
                          <button type="submit" className="btn-link">
                            Mark re-reviewed
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-section">
        <p className="eyebrow">Question reports</p>
        <p className="mt-1 text-xs text-muted">Every exercise users have reported, most open reports first.</p>
        {perExercise.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No reports yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Exercise</th>
                  <th className="py-2 pr-3 font-medium">Open</th>
                  <th className="py-2 pr-3 font-medium">Total</th>
                  <th className="py-2 pr-3 font-medium">Users</th>
                  <th className="py-2 pr-3 font-medium">Answer wrong</th>
                  <th className="py-2 pr-3 font-medium">Chart unclear</th>
                  <th className="py-2 pr-3 font-medium">Ambiguous</th>
                  <th className="py-2 pr-3 font-medium">Technical</th>
                  <th className="py-2 font-medium">Other</th>
                </tr>
              </thead>
              <tbody>
                {perExercise.map((r) => (
                  <tr key={r.exercise_id} className="border-t border-line">
                    <td className="py-2 pr-3 font-mono text-foreground">{r.exercise_id}</td>
                    <td className="py-2 pr-3 font-medium text-foreground">{r.open_reports}</td>
                    <td className="py-2 pr-3 text-muted">{r.reports}</td>
                    <td className="py-2 pr-3 text-muted">{r.reporters}</td>
                    <td className="py-2 pr-3 text-muted">{r.answer_wrong}</td>
                    <td className="py-2 pr-3 text-muted">{r.chart_unclear}</td>
                    <td className="py-2 pr-3 text-muted">{r.ambiguous}</td>
                    <td className="py-2 pr-3 text-muted">{r.technical}</td>
                    <td className="py-2 text-muted">{r.other}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {recent.length > 0 && (
          <>
            <p className="eyebrow mt-6">Latest open reports</p>
            <ul className="mt-3 space-y-2 text-sm">
              {recent.map((r) => (
                <li key={r.id} className="border-t border-line pt-2">
                  <span className="font-mono text-foreground">{r.exercise_id}</span>
                  <span className="text-muted">
                    {" "}
                    · {reasonLabel(r.reason)} · {r.stage === "feedback" ? "after answering" : "while answering"} ·{" "}
                    {new Date(r.created_at).toISOString().slice(0, 10)}
                  </span>
                  {r.note && <p className="mt-1 text-muted">&ldquo;{r.note}&rdquo;</p>}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
