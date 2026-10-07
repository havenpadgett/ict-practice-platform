"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LoadingState } from "@/components/loading-state";
import { SkillBars } from "@/components/sim/skill-bars";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useTraining } from "@/hooks/use-training";
import { MODES } from "@/lib/engine/modes";
import { SCENARIO_CATALOG } from "@/lib/engine/store";
import { pickWeaknessScenarios } from "@/lib/engine/weakness";
import { SKILLS, SKILL_LABEL, type SkillId } from "@/lib/engine/types";

function Weakness() {
  const { user, loading } = useRequireAuth();
  const t = useTraining();
  const param = useSearchParams().get("skill");
  const skill = SKILLS.includes(param as SkillId) ? (param as SkillId) : undefined;

  if (loading || !user || t.loading || !t.vector) return <LoadingState />;

  const picks = pickWeaknessScenarios({ vector: t.vector, attempts: t.attempts ?? [], catalog: SCENARIO_CATALOG, count: 3, skill });

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <p className="eyebrow">Train my weaknesses</p>
      <h1 className="page-title mt-2">{skill ? `Train ${SKILL_LABEL[skill]}` : "Your weakest skills"}</h1>
      <p className="page-lede mt-2 max-w-2xl">
        Picked from your skill vector, skipping what you did recently, at a difficulty that matches how each skill is going. No guesswork on our side: the same history always gives the same picks.
      </p>

      <div className="mt-6">
        <SkillBars vector={t.vector} />
      </div>

      <section className="mt-8">
        <h2 className="eyebrow">Next up</h2>
        {picks.length === 0 ? (
          <p className="mt-2 text-sm">Nothing to pick from yet: no skill is measured. Take the placement test or play a scenario first.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {picks.map((p, i) => (
              <li key={p.scenario.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-foreground">
                    {i + 1}. {p.scenario.title} <span className="text-xs text-muted">· {MODES[p.mode].name}</span>
                  </p>
                  <p className="mt-1 text-xs">{p.reason}</p>
                </div>
                <Link href={`/train/play?mode=${p.mode}&scenario=${p.scenario.id}`} className={i === 0 ? "btn-primary shrink-0" : "btn-secondary shrink-0"}>
                  Start
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-4">
          <Link href="/train/placement" className="btn-link">
            Retake placement
          </Link>
          {skill && (
            <Link href={`/train/placement?skill=${skill}`} className="btn-link">
              Test out of {SKILL_LABEL[skill]}
            </Link>
          )}
          <Link href="/train" className="btn-link">
            All modes
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function WeaknessPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Weakness />
    </Suspense>
  );
}
