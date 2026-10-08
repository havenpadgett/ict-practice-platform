"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LoadingState } from "@/components/loading-state";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useTraining } from "@/hooks/use-training";
import { MODES } from "@/lib/engine/modes";
import { buildTenMinuteReview, newRunId, stepsHref } from "@/lib/engine/run";
import { SCENARIO_CATALOG, scenarioMeta } from "@/lib/engine/store";

export default function TenMinuteReviewPage() {
  const { user, loading } = useRequireAuth();
  const t = useTraining();
  const [runId] = useState(() => newRunId("ten"));
  const steps = useMemo(() => (t.vector ? buildTenMinuteReview({ vector: t.vector, attempts: t.attempts ?? [], catalog: SCENARIO_CATALOG }) : []), [t.vector, t.attempts]);
  if (loading || !user || t.loading || !t.vector) return <LoadingState />;
  const href = stepsHref(steps, runId);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <p className="eyebrow">Train</p>
      <h1 className="page-title mt-2">10-minute review</h1>
      <p className="page-lede mt-2 max-w-2xl">
        Two concept checks, two chart reads and one trade, chosen from your own history: what you struggle with, at a difficulty you are ready for, skipping what you did recently. Same scenarios and scoring as everywhere else.
      </p>
      {steps.length === 0 ? (
        <p className="mt-8 text-sm">There aren&apos;t enough scenarios to build a review yet.</p>
      ) : (
        <>
          <ol className="mt-6 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {steps.map((s, i) => (
              <li key={`${s.scenarioId}-${i}`} className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted">
                  {i + 1}. {s.role}
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {scenarioMeta(s.scenarioId)?.title} <span className="text-xs text-muted">· {MODES[s.mode].name}</span>
                </p>
                {s.reason && <p className="mt-1 text-xs">{s.reason}</p>}
              </li>
            ))}
          </ol>
          {steps.length < 5 && <p className="mt-3 text-xs">Only {steps.length} scenarios fit this review right now.</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            {href && (
              <Link href={href} className="btn-primary">
                Start the review
              </Link>
            )}
            <Link href="/train" className="btn-secondary">
              Back to Train
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
