// Replay session presets: quick starts for the simulator. A preset is a
// filter over the scenario catalog (and a count), nothing more. Every step it
// produces is the ordinary Simulator on an ordinary scenario, picked through
// the same rotation as everything else, so there is one replay, one scorer
// and one history. A preset is shown only when the library holds enough
// scenarios for it to be worth starting.

import type { RunStep } from "@/lib/engine/run";
import type { ScenarioMeta } from "@/lib/engine/store";
import { measuredSkills, type SkillVector } from "@/lib/engine/skills";
import { pickWeaknessScenarios, recentScenarioIds, type Seen } from "@/lib/engine/weakness";
import type { SkillId } from "@/lib/engine/types";

/** Fewest matching scenarios before a preset is offered. */
export const MIN_PRESET_POOL = 4;

export type Preset = {
  id: string;
  label: string;
  blurb: string;
  filter: (m: ScenarioMeta) => boolean;
  /** Scenarios per run. */
  count: number;
  /** Skills the rotation orders by; unmeasured ones are still eligible. */
  skills: SkillId[];
  /** Pick at random (from what wasn't played recently) instead of by need. */
  random?: boolean;
  /** Needs the learner's own history to mean anything. */
  needsHistory?: boolean;
};

const ALL_SKILLS: SkillId[] = ["htf_bias", "liquidity", "entry_models", "confluence", "execution", "market_structure"];
const tag = (m: ScenarioMeta, ...t: string[]) => t.some((x) => m.tags.includes(x));

export const PRESETS: Preset[] = [
  { id: "ny-am", label: "NY AM practice", blurb: "Decisions made inside the New York morning session.", filter: (m) => m.session === "ny_am", count: 3, skills: ALL_SKILLS },
  { id: "sweep", label: "Liquidity sweep practice", blurb: "Charts where liquidity is taken, or looks like it was.", filter: (m) => tag(m, "sweep", "fake-sweep"), count: 3, skills: ["liquidity", "confluence", "entry_models"] },
  { id: "htf-bias", label: "HTF bias practice", blurb: "Charts where the higher timeframe decides the trade.", filter: (m) => (m.skills.htf_bias ?? 0) >= 0.7, count: 3, skills: ["htf_bias"] },
  { id: "no-trade", label: "No-trade practice", blurb: "Charts with nothing defensible to take. Standing aside is the skill.", filter: (m) => m.noTrade, count: 3, skills: ["confluence", "execution"] },
  { id: "mss-fvg", label: "MSS + FVG practice", blurb: "A shift in structure that leaves a gap to trade from.", filter: (m) => tag(m, "fvg") && tag(m, "mss", "displacement"), count: 3, skills: ["entry_models", "market_structure", "confluence"] },
  { id: "advanced-random", label: "Random advanced scenario", blurb: "One advanced chart you haven't just played.", filter: (m) => m.difficulty === 3, count: 1, skills: ALL_SKILLS, random: true },
  { id: "weaknesses", label: "Train my weaknesses", blurb: "Your weakest skills, at a difficulty you're ready for.", filter: () => true, count: 3, skills: ALL_SKILLS, needsHistory: true },
];

export type PresetStatus = { preset: Preset; pool: number; available: boolean; reason: string | null };

export function presetStatuses(catalog: ScenarioMeta[], vector: SkillVector | null): PresetStatus[] {
  return PRESETS.map((preset) => {
    const pool = catalog.filter((m) => preset.filter(m) && m.modes.includes("simulator")).length;
    if (pool < MIN_PRESET_POOL && !(preset.id === "advanced-random" && pool >= 3)) return { preset, pool, available: false, reason: `Only ${pool} matching scenarios.` };
    if (preset.needsHistory && (!vector || measuredSkills(vector).length === 0)) return { preset, pool, available: false, reason: "Needs a measured skill: take the placement test or play a few scenarios." };
    return { preset, pool, available: true, reason: null };
  });
}

/** The steps of a preset run. Always the Simulator. `rand` is injectable for tests. */
export function buildPresetRun(args: { preset: Preset; vector: SkillVector; attempts: Seen[]; catalog: ScenarioMeta[]; rand?: () => number }): RunStep[] {
  const { preset, vector, attempts, catalog } = args;
  const pool = catalog.filter((m) => preset.filter(m) && m.modes.includes("simulator"));
  if (preset.random) {
    const recent = new Set(recentScenarioIds(attempts.filter((a) => a.mode_id !== "placement"), 6));
    const fresh = pool.filter((m) => !recent.has(m.id));
    const from = fresh.length > 0 ? fresh : pool;
    const pick = from[Math.floor((args.rand ?? Math.random)() * from.length)];
    return pick ? [{ scenarioId: pick.id, mode: "simulator", role: "Random advanced", reason: "Picked at random from the advanced scenarios you haven't just played." }] : [];
  }
  return pickWeaknessScenarios({ vector, attempts, catalog, count: preset.count, skills: preset.needsHistory ? undefined : preset.skills, modes: ["simulator"], filter: (m) => preset.filter(m) }).map((p, i) => ({
    scenarioId: p.scenario.id,
    mode: "simulator" as const,
    role: `${preset.label} ${i + 1}`,
    reason: p.reason,
  }));
}
