"use client";

import Link from "next/link";
import { useMemo } from "react";
import { LoadingState } from "@/components/loading-state";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useTraining } from "@/hooks/use-training";
import { MASTERY_MIN } from "@/lib/engine/mastery";
import { buildModelSession, ENTRY_MODELS, modelMastery, modelStatus } from "@/lib/engine/models";
import { newRunId, stepsHref } from "@/lib/engine/run";
import { SCENARIO_CATALOG } from "@/lib/engine/store";

export default function ModelsPage() {
  const { user, loading } = useRequireAuth();
  const t = useTraining();
  const runId = useMemo(() => newRunId("model"), []);
  if (loading || !user || t.loading || !t.vector) return <LoadingState />;
  const attempts = t.attempts ?? [];
  const statuses = ENTRY_MODELS.map((m) => modelStatus(m, SCENARIO_CATALOG));
  const available = statuses.filter((s) => s.available);
  const missing = statuses.filter((s) => !s.available);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <p className="eyebrow">Train</p>
      <h1 className="page-title mt-2">Entry models</h1>
      <p className="page-lede mt-2 max-w-2xl">
        Practise running a model: decide whether it is really there, plan the entry, stop and target, and watch it resolve. A model appears here only when the library has enough scenarios that actually show it.
      </p>

      <ul className="mt-6 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {available.map((s) => {
          const steps = buildModelSession({ status: s, vector: t.vector!, attempts });
          const href = stepsHref(steps, runId);
          const m = modelMastery(s, attempts, SCENARIO_CATALOG);
          return (
            <li key={s.model.id} className="p-5">
              <h2 className="text-base font-semibold text-foreground">{s.model.label}</h2>
              <p className="mt-1 text-sm">{s.model.summary}</p>
              <ol className="mt-3 list-decimal space-y-0.5 pl-5 text-sm">
                {s.model.practice.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
              <p className="mt-3 text-xs tabular-nums">
                {s.pool.length} scenarios ({s.trades} with a trade) · mastery {m.score === null ? `after ${MASTERY_MIN} attempts (${m.items} so far)` : `${Math.round(m.score * 100)}%`}
              </p>
              {href && (
                <Link href={href} className="btn-primary mt-3 inline-flex">
                  Train this model ({steps.length} scenarios)
                </Link>
              )}
            </li>
          );
        })}
        {available.length === 0 && <li className="p-5 text-sm">No model has enough scenarios yet.</li>}
      </ul>

      {missing.length > 0 && (
        <section className="mt-10">
          <h2 className="eyebrow">Not available yet</h2>
          <p className="mt-2 max-w-2xl text-sm">These need scenarios built to their rules. Until then they stay off, rather than being taught from a chart that merely resembles them.</p>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
            {missing.map((s) => (
              <li key={s.model.id} className="px-4 py-3">
                <p className="text-sm text-foreground">{s.model.label}</p>
                <p className="text-xs">{s.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
