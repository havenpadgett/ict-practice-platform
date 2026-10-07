"use client";

import Link from "next/link";
import { LoadingState } from "@/components/loading-state";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useTraining } from "@/hooks/use-training";
import { MASTERY_MIN } from "@/lib/engine/mastery";
import { practiceSetup, SETUPS, setupMastery } from "@/lib/engine/setups";
import { SCENARIO_CATALOG } from "@/lib/engine/store";

export default function SetupsPage() {
  const { user, loading } = useRequireAuth();
  const t = useTraining();
  if (loading || !user || t.loading) return <LoadingState />;
  const attempts = t.attempts ?? [];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <p className="eyebrow">Train</p>
      <h1 className="page-title mt-2">Setups</h1>
      <p className="page-lede mt-2 max-w-2xl">Not an encyclopedia: a short list of situations to practise. Mastery is your average process score on the scenarios that carry it, shown after {MASTERY_MIN} attempts.</p>
      <ul className="mt-6 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {SETUPS.map((s) => {
          const m = setupMastery(s, attempts, SCENARIO_CATALOG);
          const href = practiceSetup(s, attempts, SCENARIO_CATALOG);
          return (
            <li key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">{s.label}</h2>
                <p className="mt-1 text-sm">{s.description}</p>
                <p className="mt-1 text-xs tabular-nums">
                  {m.scenarios} scenario{m.scenarios === 1 ? "" : "s"} · mastery {m.score === null ? `after ${MASTERY_MIN} attempts (${m.items} so far)` : `${Math.round(m.score * 100)}%`}
                </p>
              </div>
              {href ? (
                <Link href={href} className="btn-secondary shrink-0">
                  Practice this setup
                </Link>
              ) : (
                <span className="text-xs">No scenarios yet</span>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
