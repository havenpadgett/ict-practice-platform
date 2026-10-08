"use client";

import Link from "next/link";
import { useState } from "react";
import { ScenarioChart } from "@/components/sim/scenario-chart";
import type { LandingSample } from "@/lib/landing-sample";

const STEPS = [
  { name: "Read the chart", line: "Daily and 4H set the bias; this is the 5m at 09:50 ET. Nothing after this candle exists yet." },
  { name: "Mark it up", line: "Liquidity swept at the open, and the gap the displacement left. Marks are anchored in price and time." },
  { name: "Plan the trade", line: "Entry from the gap, stop beyond what proves the idea wrong, target at the draw. Or wait. Or take no trade." },
  { name: "Watch it resolve", line: "Price runs until the stop or the target is hit. Nothing is revealed early." },
  { name: "Get scored on process", line: "Bias, liquidity, entry area, stop, target and the decision are scored apart. The result in R never enters the score." },
  { name: "Find the weak part", line: "The weakest part of the process is named, and the trainer queues scenarios for it." },
] as const;

const noop = () => {};

/** The Simulator, in miniature: one seeded scenario stepped through the way a
 * session goes, with the result a real attempt gets from the real scorer. */
export function TrainingPreview({ sample }: { sample: LandingSample }) {
  const [step, setStep] = useState(0);
  const resolved = step >= 3;
  const showMarks = step >= 1;
  const showPlan = step === 2;

  return (
    <div>
      <div role="group" aria-label="Steps of a training session" className="flex flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <button key={s.name} type="button" aria-pressed={step === i} onClick={() => setStep(i)} className="btn-option min-h-11 px-3 text-xs">
            <span className="tabular-nums text-muted">{i + 1}</span> {s.name}
          </button>
        ))}
      </div>

      <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface p-2">
          <ScenarioChart
            series={resolved ? sample.after : sample.before}
            tf="5m"
            tool="cursor"
            interactive={false}
            annotations={showMarks ? sample.marks : []}
            selectedId={null}
            onSelect={noop}
            onCreate={noop}
            onNote={noop}
            plan={showPlan ? sample.plan : null}
            planEditable={false}
            planT={sample.decisionT}
            onPlanChange={noop}
            trade={resolved ? sample.trade : null}
            defaultBars={70}
            momentT={sample.decisionT}
            momentLabel={resolved ? "YOU DECIDED" : "NOW"}
            futureSlots={resolved ? 3 : 10}
            label={`Sample chart: ${STEPS[step].name}`}
          />
        </div>

        <div className="min-w-0">
          <p className="text-sm text-foreground" aria-live="polite">
            {STEPS[step].line}
          </p>

          {step >= 4 && (
            <div className="mt-4 rounded-lg border border-line bg-surface p-4">
              <p className="eyebrow">Sample attempt · scored by the same scorer</p>
              <p className="mt-1 text-4xl font-semibold tabular-nums text-foreground">{sample.score}</p>
              <p className="text-xs">{sample.outcome}. Process score only; the result never feeds it.</p>
              <ul className="mt-3 space-y-1.5">
                {sample.dimensions.map((d) => (
                  <li key={d.label} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-2 text-xs">
                    <span className={step === 5 && sample.weakest?.label === d.label ? "text-foreground" : ""}>{d.label}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                      <span className="block h-full bg-muted" style={{ width: `${d.score}%` }} />
                    </span>
                    <span className="text-right tabular-nums text-foreground">{d.score}</span>
                  </li>
                ))}
              </ul>
              {step === 5 && sample.weakest && (
                <p className="mt-3 border-l-2 border-line pl-3 text-xs">
                  <span className="text-foreground">{sample.weakest.label}.</span> {sample.weakest.note}
                </p>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {step < STEPS.length - 1 ? (
              <button type="button" className="btn-secondary" onClick={() => setStep(step + 1)}>
                Next: {STEPS[step + 1].name}
              </button>
            ) : (
              <Link href="/login?mode=signup" className="btn-primary">
                Train your own
              </Link>
            )}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs">A sample attempt on a seeded scenario: a constructed price path, not market history.</p>
    </div>
  );
}
