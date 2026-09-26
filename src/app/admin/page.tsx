// Product health for whoever runs the app — every user's numbers, unlike
// /analytics which shows the signed-in user their own. src/proxy.ts requires
// a login. Access: REVIEWER_EMAILS (the existing internal-tools allowlist)
// or a row in public.app_admins. The database numbers come from the
// SECURITY DEFINER functions in
// supabase/migrations/20260926140000_admin_functions.sql, which check
// app_admins themselves, so the email allowlist alone never exposes other
// users' data.

import { StatCard } from "@/components/stat-card";
import { CONCEPTS, type Concept } from "@/lib/concepts";
import { reviewProgress, type RuleProgress } from "@/lib/admin/review-progress";
import { getReviewer } from "@/lib/review/access";
import { listScenarios, readReviewLog, staleFor } from "@/lib/review/store";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
  const [reviewer, db] = await Promise.all([getReviewer(), loadDb()]);
  if (!reviewer && !db.isAdmin) {
    return (
      <div className="page">
        <h1 className="page-title">Admin</h1>
        <p className="page-lede">Not authorized.</p>
      </div>
    );
  }
  const review = await loadReview();

  return (
    <div className="page max-w-5xl">
      <h1 className="page-title">Product health</h1>
      <p className="page-lede">Every user, every attempt. Your own progress is on Analytics.</p>

      <DbSections state={db.state} />

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
      not_admin:
        "Database numbers are limited to accounts in public.app_admins. Add yours in the Supabase SQL editor (see docs/SQL-QUERIES.md → Admin functions).",
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
