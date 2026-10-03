// Internal scenario review (docs/SCENARIO-VALIDATION.md). Not user-facing:
// signed-in users with the reviewer or admin role work through real
// scenarios one rule at a time, with the curriculum definition beside each
// chart. New scenarios are auto-approved by the pipeline, so this is mostly
// retroactive spot-checking: ?view=auto lists auto-approved scenarios,
// ?view=flagged those that use has flagged (failure rate or reports),
// default is whatever still needs a first human look. src/proxy.ts requires
// a login; the reviewer check happens here and again inside each Server
// Action.

import type { Metadata } from "next";
import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";
import { ReviewQueue, type QueueGroup } from "@/app/review/review-queue";
import { invalidRealScenarios, reviewTexts, type RealScenario } from "@/data/real-scenarios";
import { getReviewer, ROLE_SETUP_HINT } from "@/lib/review/access";
import { canWrite, listScenarios, readReviewLog, staleFor } from "@/lib/review/store";
import { DEFINITIONS, definitionsForRule, splitSections } from "@/lib/curriculum";
import { loadUseFlags } from "@/lib/review/use-flags";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scenario review",
  // Internal tooling: keep it out of search results.
  robots: { index: false, follow: false },
};

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

const VIEWS = [
  { id: "pending", label: "Needs a first look" },
  { id: "auto", label: "Auto-approved" },
  { id: "flagged", label: "Flagged by use" },
] as const;
type View = (typeof VIEWS)[number]["id"];

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const requested = (await searchParams).view;
  const view: View = VIEWS.find((v) => v.id === requested)?.id ?? "pending";
  const reviewer = await getReviewer();
  if (!reviewer) {
    return (
      <div className="page">
        <h1 className="page-title">Scenario review</h1>
        <p className="page-lede">Not authorized. {ROLE_SETUP_HINT}</p>
      </div>
    );
  }

  const [{ scenarios, broken }, log, sections] = await Promise.all([listScenarios(), readReviewLog(), curriculumSections()]);
  const useFlags = await loadUseFlags(new Set(scenarios.filter((s) => s.provenance.auto_approved).map((s) => s.exercise_id)));
  const writable = canWrite();
  // Awaiting a first review, or approved under a definition that has since
  // changed (re-review).
  const isPending = (s: RealScenario) =>
    s.provenance.review_status !== "ambiguous" &&
    !s.provenance.auto_approved &&
    (!s.provenance.human_reviewed || staleFor(s).length > 0);
  const isAuto = (s: RealScenario) =>
    s.provenance.review_status !== "ambiguous" && s.provenance.auto_approved === true && staleFor(s).length === 0;
  const flagText = (s: RealScenario) => useFlags.flags.get(s.exercise_id) ?? null;
  // Flagged by use, and still open to a decision here (a person already
  // approved the rest; those are re-checked by hand from /admin).
  const isFlaggedOpen = (s: RealScenario) =>
    flagText(s) !== null && s.provenance.review_status !== "ambiguous" && !(s.provenance.human_reviewed && staleFor(s).length === 0);
  const flaggedHuman = scenarios.filter((s) => flagText(s) !== null && s.provenance.human_reviewed && staleFor(s).length === 0);
  const inView: Record<View, (s: RealScenario) => boolean> = { pending: isPending, auto: isAuto, flagged: isFlaggedOpen };
  const counts = Object.fromEntries(VIEWS.map((v) => [v.id, scenarios.filter(inView[v.id]).length])) as Record<View, number>;
  const ambiguous = scenarios.filter((s) => s.provenance.review_status === "ambiguous");

  const rules = Array.from(new Set([...scenarios.map((s) => s.provenance.detection_rule), ...log.map((e) => e.rule)]));
  const order = Object.keys(RULE_LABELS);
  rules.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));

  const groups: QueueGroup[] = rules.map((rule) => ({
    rule,
    label: RULE_LABELS[rule] ?? rule,
    reviewed: log.filter((e) => e.rule === rule).length,
    items: scenarios
      .filter((s) => s.provenance.detection_rule === rule && inView[view](s))
      // Flagged first, so the likeliest bad answer keys are checked first.
      .sort((a, b) => Number(flagText(b) !== null) - Number(flagText(a) !== null))
      .map((s) => ({
        scenario: s,
        auto: s.provenance.auto_approved === true,
        flag: flagText(s),
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
        docs/SCENARIO-VALIDATION.md. Approving edits the scenario file (and records you, not &quot;auto&quot;, as the reviewer),
        rejecting deletes it, flagging ambiguous keeps it out of practice. Every decision is logged. Commit the changes to make
        them live. New scenarios go live auto-approved; the Auto-approved and Flagged by use views are for checking them after
        the fact. Signed in as {reviewer.email}.
      </p>
      <nav aria-label="Review views" className="mt-4 flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <Link key={v.id} href={v.id === "pending" ? "/review" : `/review?view=${v.id}`} aria-current={v.id === view ? "page" : undefined} className="btn-option px-3" aria-pressed={v.id === view}>
            {v.label}
            <span className="tabular-nums text-xs opacity-80">{counts[v.id]}</span>
          </Link>
        ))}
      </nav>
      {useFlags.note && <p className="mt-2 text-xs">{useFlags.note}</p>}
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

      <ReviewQueue
        key={view}
        groups={groups}
        disabled={!writable}
        remainingLabel={view === "auto" ? "auto-approved to spot-check" : view === "flagged" ? "flagged by use" : "remaining"}
      />

      {view === "flagged" && flaggedHuman.length > 0 && (
        <section className="mt-section">
          <p className="eyebrow">Flagged by use · already human-approved</p>
          <p className="mt-1 text-xs">Re-check the answer key by hand, then mark it re-reviewed on /admin.</p>
          <ul className="mt-3 space-y-1 text-sm">
            {flaggedHuman.map((s) => (
              <li key={s.exercise_id}>
                <span className="font-mono text-foreground">{s.exercise_id}</span> · {s.provenance.detection_rule} · {flagText(s)}
              </li>
            ))}
          </ul>
        </section>
      )}

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
