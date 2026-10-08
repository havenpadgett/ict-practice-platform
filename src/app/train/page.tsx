"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PresetGrid } from "@/components/train/preset-grid";
import { useTraining } from "@/hooks/use-training";
import { LoadingState } from "@/components/loading-state";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { MODES, TRAINING_MODES } from "@/lib/engine/modes";
import { nextScenarioFor } from "@/lib/engine/pick";
import { SCENARIO_CATALOG, scenariosForMode } from "@/lib/engine/store";
import { SCENARIO_TYPE_LABEL } from "@/lib/engine/types";
import { fetchScenarioAttempts } from "@/lib/scenario-attempts";
import type { StoredScenarioAttempt } from "@/lib/engine/attempt-row";

export default function TrainPage() {
  const { user, loading } = useRequireAuth();
  const [history, setHistory] = useState<StoredScenarioAttempt[] | null>(null);
  const training = useTraining();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetchScenarioAttempts(user.id).then((rows) => {
      if (!cancelled) setHistory(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (loading || !user || history === null) return <LoadingState />;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <p className="eyebrow">Train</p>
      <h1 className="page-title mt-2">Simulate, don&apos;t just recognise</h1>
      <p className="page-lede mt-2 max-w-2xl">
        Charts you read with only what was available at the time, scored on how you read and executed them. A trade that loses can still be a well-made trade, and a winner can be a bad one.
      </p>

      <nav aria-label="Training sections" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <Link href="/train/placement" className="btn-link">
          Placement test
        </Link>
        <Link href="/train/models" className="btn-link">
          Entry models
        </Link>
        <Link href="/train/ten" className="btn-link">
          10-minute review
        </Link>
        <Link href="/train/weakness" className="btn-link">
          Train my weaknesses
        </Link>
        <Link href="/train/skills" className="btn-link">
          Skill tree
        </Link>
        <Link href="/train/setups" className="btn-link">
          Setups
        </Link>
        <Link href="/train/journal" className="btn-link">
          Journal
        </Link>
      </nav>

      {training.vector && <PresetGrid vector={training.vector} attempts={history} />}

      <h2 className="eyebrow mt-10">All modes</h2>
      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {TRAINING_MODES.map((id) => {
          const mode = MODES[id];
          const pool = scenariosForMode(id);
          const next = nextScenarioFor(id, history);
          const done = history.filter((a) => a.mode_id === id).length;
          return (
            <li key={id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">{mode.name}</h2>
                <p className="mt-1 text-sm">{mode.summary}</p>
                <p className="mt-1 text-xs tabular-nums">
                  {pool.length} scenario{pool.length === 1 ? "" : "s"} · {done} attempt{done === 1 ? "" : "s"} so far
                </p>
              </div>
              {next ? (
                <Link href={`/train/play?mode=${id}&scenario=${next.id}`} className={id === "simulator" ? "btn-primary shrink-0" : "btn-secondary shrink-0"}>
                  {done === 0 ? "Start" : "Next scenario"}
                </Link>
              ) : (
                <span className="text-sm">No scenarios yet</span>
              )}
            </li>
          );
        })}
      </ul>

      <section className="mt-12">
        <h2 className="eyebrow">Scenario library</h2>
        <p className="mt-2 text-sm">Every scenario is seeded: a constructed price path, labelled as such, never presented as history. Pick one to replay it in the simulator.</p>
        <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
          {SCENARIO_CATALOG.map((s) => {
            const attempts = history.filter((a) => a.scenario_id === s.id);
            const best = attempts.length ? Math.max(...attempts.map((a) => a.score)) : null;
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="text-foreground">{s.title}</p>
                  <p className="text-xs">
                    {SCENARIO_TYPE_LABEL[s.type]} · {s.difficulty === 3 ? "Advanced" : s.difficulty === 2 ? "Intermediate" : "Foundation"}
                    {best !== null ? ` · best process score ${best}` : ""}
                  </p>
                </div>
                <Link href={`/train/play?mode=simulator&scenario=${s.id}`} className="btn-link">
                  Replay
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
