"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { LoadingState } from "@/components/loading-state";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useTraining } from "@/hooks/use-training";
import { MODES } from "@/lib/engine/modes";
import { parsePlan, roleFor, runKindOf, summarizeRun } from "@/lib/engine/run";
import { scenarioMeta } from "@/lib/engine/store";

const TITLE = { ten: "10-minute review", preset: "Practice run", model: "Entry model session" } as const;

function Done() {
  const { user, loading } = useRequireAuth();
  const t = useTraining();
  const params = useSearchParams();
  const run = params.get("run") ?? "";
  const kind = runKindOf(run);
  const plan = useMemo(() => parsePlan(params.get("plan")), [params]);
  const summary = useMemo(
    () => (t.attempts ? summarizeRun({ run, steps: plan.map((p, i) => ({ ...p, role: roleFor(p, kind, i) })), attempts: t.attempts }) : null),
    [t.attempts, run, plan, kind],
  );
  if (loading || !user || t.loading || !summary) return <LoadingState />;

  if (!kind || plan.length === 0) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 pt-10 pb-16">
        <p className="text-sm">That run isn&apos;t available.</p>
        <Link href="/train" className="btn-link mt-3 inline-flex">Back to Train</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <p className="eyebrow">{TITLE[kind]}</p>
      <h1 className="page-title mt-2">
        {summary.completed === 0 ? "Nothing finished yet" : `${summary.completed} of ${plan.length} finished${summary.avgScore !== null ? `, process score ${Math.round(summary.avgScore)}` : ""}`}
      </h1>

      <ol className="mt-6 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {summary.steps.map(({ step, attempt, previousScore }, i) => (
          <li key={`${step.scenarioId}-${i}`} className="flex items-center justify-between gap-3 p-4 text-sm">
            <div className="min-w-0">
              <p className="text-foreground">{scenarioMeta(step.scenarioId)?.title}</p>
              <p className="text-xs">{roleFor(step, kind, i)} · {MODES[step.mode].name}</p>
            </div>
            <p className="shrink-0 text-right tabular-nums">
              {attempt ? <span className="text-foreground">{Math.round(attempt.score)}</span> : <span className="text-muted">not played</span>}
              {attempt && previousScore !== null && <span className="ml-2 text-xs text-muted">was {Math.round(previousScore)}</span>}
            </p>
          </li>
        ))}
      </ol>

      {summary.completed > 0 && (
        <div className="mt-8 space-y-6">
          <section aria-labelledby="r-improved">
            <h2 id="r-improved" className="eyebrow">What improved</h2>
            {summary.improved.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm">{summary.improved.map((x) => <li key={x}>{x}</li>)}</ul>
            ) : (
              <p className="mt-2 text-sm">Nothing to compare against yet: improvement shows once you replay a scenario or move a skill.</p>
            )}
          </section>
          <section aria-labelledby="r-missed">
            <h2 id="r-missed" className="eyebrow">What was still missed</h2>
            {summary.missed.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm">{summary.missed.map((x) => <li key={x}>{x}</li>)}</ul>
            ) : (
              <p className="mt-2 text-sm">No structured mistakes and no part of the process under 55. Nothing flagged.</p>
            )}
          </section>
          {summary.next && (
            <section aria-labelledby="r-next">
              <h2 id="r-next" className="eyebrow">Train next</h2>
              <p className="mt-2 text-sm text-foreground">{summary.next.label}</p>
              <p className="text-xs">{summary.next.why}.</p>
              <Link href={`/train/weakness?skill=${summary.next.skill}`} className="btn-primary mt-3 inline-flex">
                Train {summary.next.label}
              </Link>
            </section>
          )}
        </div>
      )}
      <div className="mt-8 flex flex-wrap gap-4">
        {kind === "ten" && <Link href="/train/ten" className="btn-secondary">Another review</Link>}
        <Link href="/train" className="btn-link">Back to Train</Link>
      </div>
    </main>
  );
}

export default function RunDonePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Done />
    </Suspense>
  );
}
