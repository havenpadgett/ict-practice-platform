"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { StoredScenarioAttempt } from "@/lib/engine/attempt-row";
import { buildPresetRun, presetStatuses, type Preset } from "@/lib/engine/presets";
import { newRunId, stepsHref } from "@/lib/engine/run";
import type { SkillVector } from "@/lib/engine/skills";
import { SCENARIO_CATALOG } from "@/lib/engine/store";

/** Quick starts for the simulator. Each one picks scenarios through the same
 * rotation and opens the ordinary Simulator; a preset the library can't
 * fill isn't shown. */
export function PresetGrid({ vector, attempts }: { vector: SkillVector; attempts: StoredScenarioAttempt[] }) {
  const router = useRouter();
  const shown = useMemo(() => presetStatuses(SCENARIO_CATALOG, vector).filter((s) => s.available), [vector]);
  if (shown.length === 0) return null;

  function start(preset: Preset) {
    const steps = buildPresetRun({ preset, vector, attempts, catalog: SCENARIO_CATALOG });
    const href = stepsHref(steps, newRunId("preset", preset.id));
    if (href) router.push(href);
  }

  return (
    <section aria-labelledby="presets" className="mt-8">
      <h2 id="presets" className="eyebrow">
        Quick start
      </h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {shown.map(({ preset, pool }) => (
          <li key={preset.id}>
            <button type="button" onClick={() => start(preset)} className="block min-h-11 w-full rounded-lg border border-line bg-surface p-4 text-left transition-colors hover:border-control">
              <span className="block text-sm font-semibold text-foreground">{preset.label}</span>
              <span className="mt-1 block text-sm">{preset.blurb}</span>
              <span className="mt-1 block text-xs tabular-nums text-muted">
                {pool} scenario{pool === 1 ? "" : "s"} · {preset.count === 1 ? "1 chart" : `${preset.count} charts`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
