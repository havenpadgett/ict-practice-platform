import type { ReactNode } from "react";

/** The shared frame for every exercise mode. On a phone: prompt, chart,
 * controls, stacked. From lg up the chart takes the wide left column and
 * the prompt and controls sit in a narrower column beside it, so the chart
 * gets the space and the controls stay next to it instead of below the
 * fold. */
export function ExerciseLayout({ prompt, chart, controls }: { prompt?: ReactNode; chart: ReactNode; controls: ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr] lg:gap-x-8 lg:gap-y-5">
      {prompt && <div className="lg:col-start-2 lg:row-start-1">{prompt}</div>}
      <div className="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-1">{chart}</div>
      <div className={`min-w-0 lg:col-start-2 ${prompt ? "lg:row-start-2" : "lg:row-span-2 lg:row-start-1"}`}>{controls}</div>
    </div>
  );
}

/** The bordered surface a chart sits on. */
export function ChartFrame({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-lg border border-line bg-surface p-2 sm:p-3">{children}</div>;
}
