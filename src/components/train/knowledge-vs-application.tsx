"use client";

import Link from "next/link";
import { useMemo } from "react";
import { applicationLayers, knowledgeGap } from "@/lib/engine/application";
import type { SkillVector } from "@/lib/engine/skills";

/** Five layers from knowing the terms to executing the trade, read off the
 * skill vector. An unmeasured layer says so; no placeholder numbers. */
export function KnowledgeVsApplication({ vector }: { vector: SkillVector }) {
  const layers = useMemo(() => applicationLayers(vector), [vector]);
  const measured = layers.filter((l) => l.score !== null);
  if (measured.length === 0) return null;
  const gap = knowledgeGap(layers);
  return (
    <section aria-labelledby="kva" className="space-y-3">
      <div>
        <h2 id="kva" className="text-lg">
          Knowledge versus application
        </h2>
        <p className="mt-1 text-sm text-muted">{gap ?? "Knowing ICT terminology is not the same as applying it. Each layer is scored separately from your skill vector."}</p>
      </div>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {layers.map((l) => {
          const pct = l.score === null ? null : Math.round(l.score * 100);
          return (
            <li key={l.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr_auto] sm:items-center sm:gap-4">
              <div>
                <p className="text-sm text-foreground">{l.label}</p>
                <p className="text-xs">{l.blurb}</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-line" aria-hidden>
                {pct !== null ? <div className="h-full bg-foreground/80" style={{ width: `${pct}%` }} /> : <div className="h-full w-full border border-dashed border-control" />}
              </div>
              <p className="w-32 text-sm tabular-nums sm:text-right">
                {pct !== null ? (
                  <>
                    <span className="text-foreground">{pct}%</span> <span className="text-xs text-muted">· {l.items} items</span>
                  </>
                ) : (
                  <span className="text-muted">not measured</span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
      <Link href="/train/weakness" className="btn-link">
        Train the weakest
      </Link>
    </section>
  );
}
