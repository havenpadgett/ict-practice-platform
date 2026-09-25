// Internal scenario review (docs/SCENARIO-VALIDATION.md, steps 5-6). Not
// user-facing: signed-in users whose email is in REVIEWER_EMAILS see every
// unreviewed real scenario with its chart, detected answer key and
// provenance, and approve or reject it. src/proxy.ts requires a login; the
// reviewer check happens here and again inside each Server Action.

import { ReviewChart } from "@/app/review/review-chart";
import { ReviewForms } from "@/app/review/review-forms";
import { getReviewer } from "@/lib/review/access";
import { canWrite, listScenarios } from "@/lib/review/store";

export const dynamic = "force-dynamic";

const DRAFT_PREFIX = /^\[DRAFT[^\]]*\]\s*/;

export default async function ReviewPage() {
  const reviewer = await getReviewer();
  if (!reviewer) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 text-sm text-muted">
        <h1 className="text-lg font-semibold text-foreground">Scenario review</h1>
        <p className="mt-2">Not authorized. Add your account email to REVIEWER_EMAILS in .env.local and restart the dev server.</p>
      </div>
    );
  }

  const scenarios = await listScenarios();
  const pending = scenarios.filter((s) => !s.provenance.human_reviewed);
  const writable = canWrite();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-lg font-semibold text-foreground">Scenario review</h1>
      <p className="mt-1 text-sm text-muted">
        {pending.length} awaiting review · {scenarios.length - pending.length} approved · signed in as {reviewer.email}
      </p>
      <p className="mt-1 text-sm text-muted">
        Check each against the checklist in docs/SCENARIO-VALIDATION.md. Approving edits the scenario file; rejecting deletes
        it. Both add a Review Log row. Commit the changes to make them live.
      </p>
      {!writable && (
        <p className="mt-2 text-sm" style={{ color: "#e2685f" }}>
          Read-only: reviews edit repo files, so they can only be saved from the local dev server.
        </p>
      )}

      {pending.length === 0 && <p className="mt-8 text-sm text-muted">Nothing to review.</p>}

      {pending.map((s) => {
        const p = s.provenance;
        return (
          <section key={s.exercise_id} className="mt-8 rounded-lg border border-line bg-surface p-4">
            <h2 className="text-base font-semibold text-foreground">
              {s.exercise_id} · {s.concept} · {p.timeframe} · difficulty {s.difficulty}
            </h2>
            <p className="mt-1 text-sm text-foreground">{s.prompt}</p>
            <div className="mt-3 overflow-hidden rounded border border-line p-2">
              <ReviewChart exercise={s} />
            </div>
            <div className="mt-4 grid gap-4 text-xs sm:grid-cols-2">
              <div>
                <h3 className="font-semibold text-muted">Detected answer key</h3>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-foreground">
                  {JSON.stringify(s.answer, null, 2)}
                </pre>
                <p className="mt-2 text-muted">Detector: {p.detection_notes}</p>
              </div>
              <div>
                <h3 className="font-semibold text-muted">Provenance</h3>
                <dl className="mt-1 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-foreground">
                  <dt className="text-muted">Source</dt><dd>{p.data_source}</dd>
                  <dt className="text-muted">Trading date</dt><dd>{p.trading_date}</dd>
                  <dt className="text-muted">Window</dt><dd>{p.date_range.start} → {p.date_range.end}</dd>
                  <dt className="text-muted">Session</dt><dd>{p.session}{p.context_start ? ` (structure from ${p.context_start})` : ""}</dd>
                  <dt className="text-muted">Timeframe</dt><dd>{p.timeframe}</dd>
                  <dt className="text-muted">Rule</dt><dd>{p.detection_rule} · {p.candidate_id}</dd>
                  <dt className="text-muted">Params</dt><dd>{JSON.stringify(p.detection_params)}</dd>
                  <dt className="text-muted">Input sha256</dt><dd className="break-all">{p.input_sha256}</dd>
                  <dt className="text-muted">Reviewed</dt><dd>{String(p.human_reviewed)}</dd>
                </dl>
              </div>
            </div>
            <ReviewForms
              id={s.exercise_id}
              draftExplanation={s.explanation.replace(DRAFT_PREFIX, "")}
              disabled={!writable}
            />
          </section>
        );
      })}
    </div>
  );
}
