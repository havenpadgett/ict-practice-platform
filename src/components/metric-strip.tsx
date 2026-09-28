export type Metric = { label: string; value: string; detail?: string };

/** A row of headline numbers, divided by rules rather than boxed as
 * separate cards. Two columns on a phone, one row from sm up. */
export function MetricStrip({ metrics }: { metrics: Metric[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1 sm:grid-flow-col sm:auto-cols-fr sm:grid-cols-none">
      {metrics.map((m) => (
        <div key={m.label} className="bg-background px-4 py-4 sm:px-5">
          <dt className="eyebrow">{m.label}</dt>
          <dd className="mt-1.5 text-2xl font-semibold text-foreground tabular-nums">{m.value}</dd>
          {m.detail && <dd className="mt-0.5 text-xs text-muted tabular-nums">{m.detail}</dd>}
        </div>
      ))}
    </dl>
  );
}
