import { AccuracyBar } from "@/components/analytics/accuracy-bar";
import type { ProcessVsOutcome, RateCount, RealVsConstructed } from "@/lib/analytics";
import { getConceptMeta } from "@/lib/concepts";

const DIFFICULTY = { 1: "Easy", 2: "Medium", 3: "Hard" } as const;

/** Accuracy by difficulty, one block per concept. */
export function ConceptDifficultyView({ data }: { data: Record<string, Partial<Record<1 | 2 | 3, RateCount>>> }) {
  const concepts = Object.keys(data);
  if (concepts.length === 0) return <p className="text-sm text-muted">No difficulty recorded yet.</p>;
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {concepts.map((concept) => (
        <div key={concept}>
          <p className="text-sm font-medium text-foreground">{getConceptMeta(concept).pickerLabel}</p>
          <div className="mt-2 space-y-3">
            {([1, 2, 3] as const).map((d) => {
              const r = data[concept][d];
              return r ? (
                <AccuracyBar key={d} label={DIFFICULTY[d]} accuracy={r.accuracy} sublabel={`${r.count} tries`} />
              ) : null;
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function RealVsConstructedView({ data }: { data: RealVsConstructed }) {
  if (!data.real) {
    return <p className="text-sm text-muted">No real-data scenarios attempted yet. They appear once reviewed and approved.</p>;
  }
  return (
    <div className="space-y-4">
      <AccuracyBar label="Real market data" accuracy={data.real.accuracy} sublabel={`${data.real.count} tries`} />
      {data.constructed && (
        <AccuracyBar label="Constructed" accuracy={data.constructed.accuracy} sublabel={`${data.constructed.count} tries`} />
      )}
      {data.byConcept.length > 0 && (
        <div className="pt-2">
          <p className="text-xs text-muted">Same concept, both kinds (the fair comparison):</p>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {data.byConcept.map((c) => {
              const diff = c.real.accuracy - c.constructed.accuracy;
              return (
                <li key={c.concept}>
                  {getConceptMeta(c.concept).pickerLabel}: real {c.real.accuracy}% ({c.real.count}) vs constructed{" "}
                  {c.constructed.accuracy}% ({c.constructed.count}) ·{" "}
                  <span className="text-muted">{diff === 0 ? "no difference" : `${Math.abs(diff)} points ${diff < 0 ? "harder" : "easier"} on real data`}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Process pass rate next to win rate, plus the 2x2 that shows why they differ. */
export function ProcessVsOutcomeView({ data }: { data: ProcessVsOutcome }) {
  const { cells } = data;
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <AccuracyBar label="Process pass rate" accuracy={data.processPassRate.accuracy} sublabel={`${data.processPassRate.count} scenarios`} />
        {data.winRate ? (
          <AccuracyBar label="Win rate" accuracy={data.winRate.accuracy} sublabel={`${data.winRate.count} closed trades`} />
        ) : (
          <p className="text-sm text-muted">Win rate: no closed trades yet.</p>
        )}
      </div>
      <p className="mt-4 text-xs text-muted">
        These measure different things. Good process can lose, since a valid setup is a probability, not a promise. A win can
        still come from bad process, which is luck and won&apos;t repeat. Grading follows the process.
      </p>
      <table className="mt-3 text-sm">
        <thead className="text-xs text-muted">
          <tr>
            <th className="py-1 pr-4 text-left font-medium" />
            <th className="py-1 pr-4 text-left font-medium">Won</th>
            <th className="py-1 text-left font-medium">Lost</th>
          </tr>
        </thead>
        <tbody className="text-foreground">
          <tr>
            <td className="py-1 pr-4 text-muted">Good process</td>
            <td className="py-1 pr-4">{cells.goodWin}</td>
            <td className="py-1">{cells.goodLoss}</td>
          </tr>
          <tr>
            <td className="py-1 pr-4 text-muted">Bad process</td>
            <td className="py-1 pr-4">{cells.badWin}</td>
            <td className="py-1">{cells.badLoss}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
