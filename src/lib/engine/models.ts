// Entry model training: practice at running a model, not a lesson about it.
// A model here is a filter over the scenario catalog plus the order in which
// to practise it (decide whether it is valid, plan the trade, watch it
// resolve). It is offered only when the library holds enough scenarios that
// actually exhibit it; a model whose name exists but whose scenarios don't
// is listed as unavailable with the reason, not padded with a weak example.
// Nothing here scores or replays anything: every step is an existing mode.

import type { StoredScenarioAttempt } from "@/lib/engine/attempt-row";
import { attemptsOn, masteryFrom, scoresFor, type Mastery } from "@/lib/engine/mastery";
import type { RunStep } from "@/lib/engine/run";
import type { ScenarioMeta } from "@/lib/engine/store";
import { pickWeaknessScenarios, type Seen } from "@/lib/engine/weakness";
import type { SkillVector } from "@/lib/engine/skills";
import type { ModeId, SkillId } from "@/lib/engine/types";

/** Fewest scenarios before a model is offered, and fewest that carry a real
 * trade (the rest may be near misses). */
export const MIN_MODEL_SCENARIOS = 4;
export const MIN_MODEL_TRADES = 3;

export type EntryModel = {
  id: string;
  label: string;
  summary: string;
  /** What you have to do, in the order the session asks it. */
  practice: string[];
  /** Which catalog scenarios exhibit it (valid, failed, or a near miss). */
  matches: (m: ScenarioMeta) => boolean;
  /** Why it is not offered when the library falls short. */
  gap: string;
};

const has = (m: ScenarioMeta, ...tags: string[]) => tags.every((t) => m.tags.includes(t));
const hasAny = (m: ScenarioMeta, ...tags: string[]) => tags.some((t) => m.tags.includes(t));

export const ENTRY_MODELS: EntryModel[] = [
  {
    id: "sweep-mss-fvg",
    label: "Liquidity sweep, displacement, FVG retrace",
    summary: "Liquidity is taken, price displaces through structure, and the entry is the retrace into the gap it left. Also the shape of the \"2022 model\" and of sweep, displacement, retracement.",
    practice: ["Find the liquidity and decide whether it was really taken", "Decide whether the shift is valid or a wick", "Pick the gap that matters", "Wait for confirmation, then choose long, short, wait or no trade", "Entry, stop and target; watch it resolve"],
    matches: (m) => hasAny(m, "sweep") && hasAny(m, "fvg", "displacement", "mss"),
    gap: "",
  },
  {
    id: "order-block",
    label: "Order block entry",
    summary: "When the move is steady rather than explosive, the origin candle is the area.",
    practice: ["Find the origin candle", "Decide whether it is the area or the gap is", "Entry, stop and target"],
    matches: (m) => has(m, "order-block"),
    gap: "Only one scenario in the library is built around an order block.",
  },
  {
    id: "ifvg-continuation",
    label: "IFVG continuation",
    summary: "An FVG that is traded through and then respected from the other side, with the trend.",
    practice: [],
    matches: (m) => has(m, "ifvg"),
    gap: "No scenario is built around an inverted FVG, so there is nothing real to practise it on.",
  },
  {
    id: "ifvg-reversal",
    label: "IFVG reversal",
    summary: "An FVG that is traded through and then respected from the other side, against the trend.",
    practice: [],
    matches: (m) => has(m, "ifvg", "reversal"),
    gap: "No scenario is built around an inverted FVG.",
  },
  {
    id: "breaker",
    label: "Breaker",
    summary: "An order block that failed, then acts as an area from the other side.",
    practice: [],
    matches: (m) => has(m, "breaker"),
    gap: "No scenario contains a breaker whose answer key was derived from the candles.",
  },
  {
    id: "unicorn",
    label: "Unicorn",
    summary: "A breaker and an FVG overlapping at the same price.",
    practice: [],
    matches: (m) => has(m, "unicorn"),
    gap: "Needs breaker scenarios first; none exist.",
  },
  {
    id: "silver-bullet",
    label: "Silver Bullet",
    summary: "A time-window model: an FVG entry inside a fixed hour after liquidity is taken.",
    practice: [],
    matches: (m) => has(m, "silver-bullet"),
    gap: "No scenario is authored to the window's rules; sampling the existing NY AM scenarios would teach a rule they weren't built to.",
  },
  {
    id: "judas-swing",
    label: "Judas swing",
    summary: "A false move at the session open that takes liquidity before the real move.",
    practice: [],
    matches: (m) => has(m, "judas"),
    gap: "No scenario is built around a session-open false move.",
  },
  {
    id: "amd",
    label: "AMD / Power of Three",
    summary: "Accumulation, manipulation, distribution across a session.",
    practice: [],
    matches: (m) => has(m, "asia-range", "london"),
    gap: "Only one scenario (London sweeps Asia) shows the pattern.",
  },
];

export type ModelStatus = {
  model: EntryModel;
  pool: ScenarioMeta[];
  trades: number;
  available: boolean;
  /** Why not, when unavailable. */
  reason: string | null;
};

export function modelStatus(model: EntryModel, catalog: ScenarioMeta[]): ModelStatus {
  const pool = catalog.filter(model.matches);
  const trades = pool.filter((m) => !m.noTrade).length;
  const available = model.practice.length > 0 && pool.length >= MIN_MODEL_SCENARIOS && trades >= MIN_MODEL_TRADES;
  return {
    model,
    pool,
    trades,
    available,
    reason: available ? null : model.gap || `Only ${pool.length} scenarios (${trades} with a trade) fit; at least ${MIN_MODEL_SCENARIOS} (${MIN_MODEL_TRADES} with a trade) are needed.`,
  };
}

export function modelMastery(status: ModelStatus, attempts: StoredScenarioAttempt[], catalog: ScenarioMeta[]): Mastery {
  const ids = new Set(status.pool.map((m) => m.id));
  return masteryFrom(scoresFor(attemptsOn(attempts, catalog, (m) => ids.has(m.id)), []));
}

/** The steps of a model session, as roles shared by every model. */
export const MODEL_SLOTS: { role: string; mode: ModeId; skills: SkillId[]; trade: boolean | null }[] = [
  { role: "Valid or not?", mode: "setup_or_trap", skills: ["confluence", "execution"], trade: null },
  { role: "Plan the trade", mode: "htf_to_ltf", skills: ["entry_models", "htf_bias"], trade: true },
  { role: "Run it", mode: "simulator", skills: ["entry_models", "execution"], trade: true },
  { role: "Near miss", mode: "blind_chart", skills: ["confluence", "execution"], trade: false },
];

/** Up to four steps from the model's own pool, through the usual rotation
 * (new before repeated, weak before strong), using each step's mode. */
export function buildModelSession(args: { status: ModelStatus; vector: SkillVector; attempts: Seen[] }): RunStep[] {
  const inPool = new Set(args.status.pool.map((m) => m.id));
  const steps: RunStep[] = [];
  const used: string[] = [];
  for (const [slot, def] of MODEL_SLOTS.entries()) {
    const picks = pickWeaknessScenarios({
      vector: args.vector,
      attempts: args.attempts,
      catalog: args.status.pool,
      count: 1,
      skills: def.skills,
      modes: [def.mode],
      exclude: used,
      filter: (m) => inPool.has(m.id) && (def.trade === null || m.noTrade === !def.trade),
    });
    for (const p of picks) {
      steps.push({ scenarioId: p.scenario.id, mode: def.mode, role: def.role, reason: p.reason, slot });
      used.push(p.scenario.id);
    }
  }
  return steps;
}
