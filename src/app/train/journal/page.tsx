"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { LoadingState } from "@/components/loading-state";
import { VerdictInline } from "@/components/verdict";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useTraining } from "@/hooks/use-training";
import { MODES } from "@/lib/engine/modes";
import { MISTAKE_LABEL, MISTAKE_TIP } from "@/lib/engine/review";
import { scenarioMeta } from "@/lib/engine/store";
import { MISTAKE_IDS, type ModeId } from "@/lib/engine/types";
import type { StoredScenarioAttempt } from "@/lib/engine/attempt-row";

const OUTCOME: Record<StoredScenarioAttempt["outcome"], string> = {
  no_order: "No trade",
  unfilled: "Never filled",
  stop: "Stopped",
  target: "Target",
  scenario_end: "Open at end",
};

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const r = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}R`;

function Entry({ a }: { a: StoredScenarioAttempt }) {
  const meta = scenarioMeta(a.scenario_id);
  return (
    <li>
      <Link href={`/train/review?id=${encodeURIComponent(a.id)}`} className="block px-4 py-3 transition-colors hover:bg-background">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-foreground">
            {meta?.title ?? a.scenario_id} <span className="text-xs text-muted">· {MODES[a.mode_id]?.name ?? a.mode_id}</span>
          </p>
          <p className="flex items-center gap-3 text-sm tabular-nums">
            <VerdictInline verdict={a.verdict} />
            <span className="text-foreground">{a.score}</span>
          </p>
        </div>
        <p className="mt-1 text-xs tabular-nums">
          {when(a.created_at)} · {a.decision ? a.decision.replace("_", " ") : "read-only exercise"} · {OUTCOME[a.outcome]}
          {a.result_r !== null ? ` · ${r(a.result_r)}` : ""}
          {a.confidence !== null ? ` · confidence ${a.confidence}/5` : ""}
          {a.source === "device" ? " · on this device" : ""}
        </p>
        {a.mistakes.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-1.5">
            {a.mistakes.map((m) => (
              <span key={m} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-foreground">
                {MISTAKE_LABEL[m]}
              </span>
            ))}
          </p>
        )}
      </Link>
    </li>
  );
}

function Journal() {
  const { user, loading } = useRequireAuth();
  const t = useTraining();
  const tab = useSearchParams().get("tab") === "mistakes" ? "mistakes" : "journal";
  const [mode, setMode] = useState<ModeId | "all">("all");

  const rows = useMemo(() => {
    const practice = (t.attempts ?? []).filter((a) => a.mode_id !== "placement");
    return [...practice].filter((a) => mode === "all" || a.mode_id === mode).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [t.attempts, mode]);

  if (loading || !user || t.loading || !t.summary) return <LoadingState />;
  const { summary } = t;

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <p className="eyebrow">Train</p>
      <h1 className="page-title mt-2">Journal</h1>
      <p className="page-lede mt-2 max-w-2xl">Every scenario you finish is here automatically: what you decided, how the process scored, what it returned in R, and the mistakes it named. Open an entry to replay the completed review.</p>

      <div role="tablist" aria-label="Journal sections" className="mt-6 flex gap-2 border-b border-line">
        {(["journal", "mistakes"] as const).map((x) => (
          <Link key={x} role="tab" aria-selected={tab === x} href={`/train/journal${x === "mistakes" ? "?tab=mistakes" : ""}`} className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm ${tab === x ? "border-accent text-foreground" : "border-transparent text-muted hover:text-foreground"}`}>
            {x === "journal" ? `Entries (${summary.total})` : "Mistake library"}
          </Link>
        ))}
      </div>

      {tab === "journal" ? (
        <section className="mt-5">
          {summary.total === 0 ? (
            <p className="text-sm">Nothing here yet. <Link href="/train" className="text-accent underline underline-offset-2">Play a scenario</Link> and it appears on its own.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs tabular-nums">
                  Average process score {summary.avgScore === null ? "—" : Math.round(summary.avgScore)}
                  {summary.recentAvgScore !== null && ` · last 10: ${Math.round(summary.recentAvgScore)}`}
                  {summary.goodProcessLosses > 0 && ` · ${summary.goodProcessLosses} well-made trade${summary.goodProcessLosses === 1 ? "" : "s"} that lost`}
                  {summary.badProcessWins > 0 && ` · ${summary.badProcessWins} poorly-made trade${summary.badProcessWins === 1 ? "" : "s"} that won`}
                </p>
                <label className="flex items-center gap-2 text-xs text-muted">
                  Mode
                  <select value={mode} onChange={(e) => setMode(e.target.value as ModeId | "all")} className="field min-h-11 w-auto py-1">
                    <option value="all">All</option>
                    {Object.keys(summary.byMode).map((m) => (
                      <option key={m} value={m}>
                        {MODES[m as ModeId]?.name ?? m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {rows.map((a) => (
                  <Entry key={a.id} a={a} />
                ))}
              </ul>
            </>
          )}
        </section>
      ) : (
        <section className="mt-5">
          <p className="text-sm">Structured mistakes the engine named, most frequent first. Each entry links to the attempts where it happened.</p>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {[...MISTAKE_IDS]
              .map((id) => ({ id, count: summary.mistakes.find((m) => m.id === id)?.count ?? 0, lastAt: summary.mistakes.find((m) => m.id === id)?.lastAt ?? "" }))
              .sort((a, b) => b.count - a.count)
              .map(({ id, count, lastAt }) => {
                const where = (t.attempts ?? []).filter((a) => a.mode_id !== "placement" && a.mistakes.includes(id)).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
                return (
                  <li key={id} className="px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm text-foreground">{MISTAKE_LABEL[id]}</p>
                      <p className="text-xs tabular-nums">{count === 0 ? "none yet" : `${count} time${count === 1 ? "" : "s"} · last ${when(lastAt)}`}</p>
                    </div>
                    <p className="mt-1 text-xs">{MISTAKE_TIP[id]}</p>
                    {where.length > 0 && (
                      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {where.map((a) => (
                          <Link key={a.id} href={`/train/review?id=${encodeURIComponent(a.id)}`} className="text-accent underline underline-offset-2">
                            {scenarioMeta(a.scenario_id)?.title ?? a.scenario_id}
                          </Link>
                        ))}
                      </p>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      )}
    </main>
  );
}

export default function JournalPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Journal />
    </Suspense>
  );
}
