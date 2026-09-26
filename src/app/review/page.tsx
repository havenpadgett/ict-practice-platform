// Internal scenario review (docs/SCENARIO-VALIDATION.md, steps 5-6). Not
// user-facing: signed-in users whose email is in REVIEWER_EMAILS work
// through unreviewed real scenarios one rule at a time, with the curriculum
// definition beside each chart. src/proxy.ts requires a login; the reviewer
// check happens here and again inside each Server Action.

import { promises as fs } from "fs";
import path from "path";
import { ReviewQueue, type QueueGroup } from "@/app/review/review-queue";
import { invalidRealScenarios, reviewTexts, type RealScenario } from "@/data/real-scenarios";
import { getReviewer } from "@/lib/review/access";
import { canWrite, listScenarios, readReviewLog, staleFor } from "@/lib/review/store";
import { DEFINITIONS, definitionsForRule, splitSections } from "@/lib/curriculum";

export const dynamic = "force-dynamic";

const DRAFT_PREFIX = /^\[DRAFT[^\]]*\]\s*/;

const RULE_LABELS: Record<string, string> = {
  fvg: "FVG",
  equal_highs: "Equal highs",
  equal_lows: "Equal lows",
  mss: "MSS",
  order_block: "Order blocks",
  dealing_range: "Premium / discount",
  guided_setup: "Guided Entry",
  free_trade_setup: "Free Trade",
};

async function curriculumSections(): Promise<Record<string, string>> {
  try {
    return splitSections(await fs.readFile(path.join(process.cwd(), "docs", "CURRICULUM.md"), "utf8"));
  } catch {
    return {};
  }
}

export default async function ReviewPage() {
  const reviewer = await getReviewer();
  if (!reviewer) {
    return (
      <div className="page">
        <h1 className="page-title">Scenario review</h1>
        <p className="page-lede">Not authorized. Add your account email to REVIEWER_EMAILS in .env.local and restart the dev server.</p>
      </div>
    );
  }

  const [{ scenarios, broken }, log, sections] = await Promise.all([listScenarios(), readReviewLog(), curriculumSections()]);
  const writable = canWrite();
  // Awaiting a first review, or approved under a definition that has since
  // changed (re-review).
  const isPending = (s: RealScenario) =>
    s.provenance.review_status !== "ambiguous" && (!s.provenance.human_reviewed || staleFor(s).length > 0);
  const ambiguous = scenarios.filter((s) => s.provenance.review_status === "ambiguous");

  const rules = Array.from(new Set([...scenarios.map((s) => s.provenance.detection_rule), ...log.map((e) => e.rule)]));
  const order = Object.keys(RULE_LABELS);
  rules.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));

  const groups: QueueGroup[] = rules.map((rule) => ({
    rule,
    label: RULE_LABELS[rule] ?? rule,
    reviewed: log.filter((e) => e.rule === rule).length,
    items: scenarios
      .filter((s) => s.provenance.detection_rule === rule && isPending(s))
      .map((s) => ({
        scenario: s,
        texts: reviewTexts(s).map((t) => ({ key: t.key, label: t.label, draft: t.value.replace(DRAFT_PREFIX, "") })),
        stale: staleFor(s).length
          ? staleFor(s)
              .map((id) => `${DEFINITIONS[id].section} changed (built under v${s.provenance.curriculum_versions?.[id] ?? 0}, now v${DEFINITIONS[id].version})`)
              .join("; ")
          : null,
      })),
    definitions: definitionsForRule(rule).map((id) => ({
      id,
      title: DEFINITIONS[id].section,
      version: DEFINITIONS[id].version,
      markdown: sections[DEFINITIONS[id].section] ?? "(Definition text unavailable — docs/CURRICULUM.md isn't readable here.)",
    })),
  }));

  return (
    <div className="page max-w-6xl">
      <h1 className="page-title">Scenario review</h1>
      <p className="page-lede">
        One rule at a time. Check each chart against the definition on the right and the checklist in
        docs/SCENARIO-VALIDATION.md. Approving edits the scenario file, rejecting deletes it, flagging keeps it out of practice.
        Every decision is logged. Commit the changes to make them live. Signed in as {reviewer.email}.
      </p>
      {!writable && <p className="text-error mt-2">Read-only: reviews edit repo files, so they can only be saved from the local dev server.</p>}

      {broken.length > 0 && (
        <div className="card mt-6 text-sm" role="alert">
          <p className="text-danger">{broken.length} scenario file(s) on disk can&apos;t be read:</p>
          <ul className="mt-2 list-disc pl-5">
            {broken.map((b) => (
              <li key={b.file}>
                {b.file}: {b.error}
              </li>
            ))}
          </ul>
        </div>
      )}
      {invalidRealScenarios.length > 0 && (
        <div className="card mt-6 text-sm" role="alert">
          <p className="text-danger">{invalidRealScenarios.length} registered scenario file(s) failed validation and are hidden everywhere:</p>
          <ul className="mt-2 list-disc pl-5">
            {invalidRealScenarios.map((s) => (
              <li key={s.id}>{s.error}</li>
            ))}
          </ul>
        </div>
      )}

      <ReviewQueue groups={groups} disabled={!writable} />

      {ambiguous.length > 0 && (
        <section className="mt-section">
          <p className="eyebrow">Flagged ambiguous · not exercises</p>
          <ul className="mt-3 space-y-1 text-sm">
            {ambiguous.map((s) => (
              <li key={s.exercise_id}>
                <span className="font-mono text-foreground">{s.exercise_id}</span> · {s.provenance.detection_rule} ·{" "}
                {s.provenance.review_notes}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
