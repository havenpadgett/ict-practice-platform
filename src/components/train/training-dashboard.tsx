"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SkillBars } from "@/components/sim/skill-bars";
import { useTraining } from "@/hooks/use-training";
import { MISTAKE_LABEL } from "@/lib/engine/review";
import { CLASSIFICATION_MEANING } from "@/lib/engine/skill-config";
import { leadSentence, weakestSkills } from "@/lib/engine/skills";
import { SKILL_LABEL, type SkillId } from "@/lib/engine/types";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** The launch cards an advanced trader lands on: the simulator, blind
 * analysis, execution and weakness training. Lessons stay one click away. */
function AdvancedLaunch({ weakest }: { weakest: SkillId | null }) {
  const cards = [
    { href: "/train/play?mode=simulator&scenario=sim-001", title: "Simulator", body: "Replay a chart candle by candle and commit with only what existed at the time." },
    { href: "/train/start?mode=blind_chart", title: "Blind analysis", body: "No concept named, no setup hinted, no guarantee one exists." },
    { href: `/train/weakness?skill=execution`, title: "Execution", body: "Entries, stops, targets and standing aside." },
    { href: weakest ? `/train/weakness?skill=${weakest}` : "/train/weakness", title: "Weakness training", body: weakest ? `Scenarios picked for ${SKILL_LABEL[weakest]}, your weakest skill.` : "Scenarios picked for your weakest skills." },
  ];
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {cards.map((c) => (
        <li key={c.title}>
          <Link href={c.href} className="block h-full rounded-lg border border-line bg-surface p-4 transition-colors hover:border-control">
            <p className="text-sm font-semibold text-foreground">{c.title}</p>
            <p className="mt-1 text-sm">{c.body}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The dashboard's training section: driven by the skill vector, not the
 * overall label. One dominant recommendation names the specific weakness. */
export function TrainingDashboard() {
  const t = useTraining();
  const weak = useMemo(() => (t.vector ? weakestSkills(t.vector, 1)[0] : undefined), [t.vector]);

  if (t.loading || !t.vector || !t.classification || !t.summary) return null;
  const { vector, classification, summary } = t;
  const advanced = classification.level === "advanced";
  const lead = leadSentence(vector);
  const placed = classification.level !== null;
  const anyAttempts = summary.total > 0 || t.attempts?.some((a) => a.mode_id === "placement");

  return (
    <section aria-labelledby="dash-train" className="space-y-4">
      <h2 id="dash-train" className="sr-only">
        Training
      </h2>

      {!anyAttempts ? (
        <div className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="eyebrow">Train</p>
            <h3 className="mt-1 text-lg">Find out where you stand</h3>
            <p className="mt-1 text-sm">Fifteen short chart tasks, easy to hard. You get seven separate skills, not one score, and a dashboard that trains the weakest one.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link href="/train/placement" className="btn-primary">
              Take the placement test
            </Link>
            <Link href="/train" className="btn-secondary">
              Open the simulator
            </Link>
          </div>
        </div>
      ) : advanced ? (
        <div className="space-y-3">
          <div>
            <p className="eyebrow">Advanced · {CLASSIFICATION_MEANING.advanced.toLowerCase()}</p>
            <p className="mt-1 text-base text-foreground">{lead.text}</p>
          </div>
          <AdvancedLaunch weakest={weak?.skill ?? null} />
        </div>
      ) : (
        <div className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="eyebrow">{placed ? `${classification.label} · ${CLASSIFICATION_MEANING[classification.level!].toLowerCase()}` : "Not placed yet"}</p>
            <p className="mt-1 text-lg text-foreground">{placed || weak ? lead.text : "A few more scenarios, or the placement test, and this will name where to work."}</p>
            {classification.nextStep && <p className="mt-1 text-sm">{classification.nextStep}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            {lead.skill ? (
              <Link href={`/train/weakness?skill=${lead.skill}`} className="btn-primary">
                Train {SKILL_LABEL[lead.skill]}
              </Link>
            ) : (
              <Link href="/train/placement" className="btn-primary">
                Take the placement test
              </Link>
            )}
            <Link href="/train" className="btn-secondary">
              Simulator
            </Link>
          </div>
        </div>
      )}

      {anyAttempts && (
        <>
          <SkillBars vector={vector} />
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {summary.topMistake && (
              <p>
                Most frequent mistake:{" "}
                <Link href="/train/journal?tab=mistakes" className="text-foreground underline underline-offset-2">
                  {MISTAKE_LABEL[summary.topMistake.id]}
                </Link>{" "}
                <span className="tabular-nums">· {summary.topMistake.count} time{summary.topMistake.count === 1 ? "" : "s"}</span>
              </p>
            )}
            {summary.avoidance.rate !== null && (
              <p>
                Correct avoidance: <span className="text-foreground tabular-nums">{pct(summary.avoidance.rate)}</span> of no-trade charts ({summary.avoidance.avoided} of {summary.avoidance.noTradeAttempts})
              </p>
            )}
            <Link href="/train/journal" className="btn-link">
              Journal
            </Link>
            <Link href="/train/placement" className="btn-link">
              {placed ? "Retake placement" : "Placement test"}
            </Link>
          </div>
          {summary.calibration.insight && <p className="text-sm">{summary.calibration.insight}</p>}
        </>
      )}
    </section>
  );
}

/** Lessons and concept practice stay available to everyone. For an Advanced
 * trader they step back behind a disclosure, so the first thing on screen is
 * the simulator, blind analysis, execution and weakness training. */
export function LessonsGate({ children }: { children: React.ReactNode }) {
  const t = useTraining();
  if (t.classification?.level !== "advanced") return <>{children}</>;
  return (
    <details className="rounded-lg border border-line px-5 py-3">
      <summary className="cursor-pointer text-sm font-medium text-foreground">Lessons and concept practice</summary>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  );
}
