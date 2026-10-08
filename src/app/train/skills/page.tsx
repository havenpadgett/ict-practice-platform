"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { KnowledgeVsApplication } from "@/components/train/knowledge-vs-application";
import { LoadingState } from "@/components/loading-state";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useTraining } from "@/hooks/use-training";
import { DASHBOARD_COLUMNS, fetchAttempts } from "@/lib/attempts";
import { scoreConcepts } from "@/lib/recommendations";
import { conceptMastery, practiceFor, SKILL_TREE } from "@/lib/engine/skill-tree";
import { MASTERY_MIN } from "@/lib/engine/mastery";
import { SCENARIO_CATALOG } from "@/lib/engine/store";

export default function SkillsPage() {
  const { user, loading } = useRequireAuth();
  const t = useTraining();
  const [recognition, setRecognition] = useState<{ concept: string; attempts: number; accuracy: number }[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetchAttempts(user.id, DASHBOARD_COLUMNS)
      .then((rows) => {
        if (!cancelled) setRecognition(scoreConcepts(rows).concepts.map((c) => ({ concept: c.concept, attempts: c.attempts, accuracy: c.accuracy })));
      })
      .catch(() => {
        if (!cancelled) setRecognition([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const attempts = useMemo(() => t.attempts ?? [], [t.attempts]);

  if (loading || !user || t.loading || recognition === null) return <LoadingState />;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <p className="eyebrow">Train</p>
      <h1 className="page-title mt-2">Skill tree</h1>
      <p className="page-lede mt-2 max-w-2xl">
        Each concept has a mastery bar built from the scenarios that exercise it (and, where there are any, the recognition exercises that train it). Select a bar to practise it. A percentage appears after {MASTERY_MIN} attempts.
      </p>

      {t.vector && (
        <div className="mt-8">
          <KnowledgeVsApplication vector={t.vector} />
        </div>
      )}

      <div className="mt-8 space-y-8">
        {SKILL_TREE.map((group) => (
          <section key={group.id} aria-labelledby={`g-${group.id}`}>
            <h2 id={`g-${group.id}`} className="text-base">
              {group.label}
            </h2>
            <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {group.concepts.map((c) => {
                const m = conceptMastery(c, attempts, SCENARIO_CATALOG, recognition);
                const launch = practiceFor(c, attempts, SCENARIO_CATALOG);
                const pct = m.score === null ? null : Math.round(m.score * 100);
                const body = (
                  <div className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr_9rem] sm:items-center sm:gap-4">
                    <div>
                      <p className="text-sm text-foreground">{c.label}</p>
                      <p className="text-xs">{c.blurb}</p>
                    </div>
                    {c.comingLater ? (
                      <p className="text-xs">Coming later. Excluded from mastery.</p>
                    ) : (
                      <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden>
                        {pct !== null ? <div className="h-full bg-foreground/80" style={{ width: `${pct}%` }} /> : <div className="h-full w-full border border-dashed border-control" />}
                      </div>
                    )}
                    <p className="text-xs tabular-nums sm:text-right">
                      {c.comingLater ? "" : pct !== null ? <span className="text-sm text-foreground">{pct}%</span> : m.scenarios + m.recognitionAttempts === 0 ? "no scenarios yet" : `${m.items} of ${MASTERY_MIN} attempts`}
                      {!c.comingLater && m.scenarios > 0 ? ` · ${m.scenarios} scenario${m.scenarios === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>
                );
                return (
                  <li key={c.id}>
                    {launch ? (
                      <Link href={launch.href} aria-label={`${launch.label}${pct !== null ? `, mastery ${pct}%` : ""}`} className="block transition-colors hover:bg-background">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
