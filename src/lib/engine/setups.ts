// The setup library, kept minimal on purpose: practice-first, not an
// encyclopedia. Each setup is a short description, a mastery figure, how many
// scenarios carry it, and a way to practise it. A setup is a cluster of
// scenarios by tag, so adding a scenario with the right tags adds it here.

import type { StoredScenarioAttempt } from "@/lib/engine/attempt-row";
import { attemptsOn, masteryFrom, pickLeastRecent, scoresFor, type Mastery } from "@/lib/engine/mastery";
import type { ScenarioMeta } from "@/lib/engine/store";

export type Setup = { id: string; label: string; description: string; tags: string[] };

export const SETUPS: Setup[] = [
  { id: "sweep-displace", label: "Sweep, displace, retrace", description: "Liquidity taken, displacement through a swing, then a retrace into the gap it left. Long or short.", tags: ["displacement"] },
  { id: "order-block", label: "Order block entry", description: "When the move is steady rather than explosive, the origin candle is the area.", tags: ["order-block"] },
  { id: "session", label: "Session sweeps", description: "The same model in London and the afternoon, against that session's highs and lows.", tags: ["session-liquidity", "session-high", "london", "pm-session"] },
  { id: "reversal", label: "Reversal at a major low", description: "A sweep of the week's low, and a counter-trend long with a plan that survives being wrong.", tags: ["reversal", "weekly-low"] },
  { id: "patience", label: "Late entries and second chances", description: "The move already left. Wait with a resting order or move on; don't chase.", tags: ["late-entry", "second-chance", "patience", "limit-order"] },
  { id: "failed", label: "Sound setups that fail", description: "A well-made trade that loses: scored on process, not result.", tags: ["failed-setup"] },
  { id: "no-trade", label: "No-trade environments", description: "Chop, no bias, rest after a move, sweeps with nothing behind them.", tags: ["no-trade", "chop", "consolidation", "no-bias"] },
  { id: "location", label: "Right pattern, wrong place", description: "Textbook structure where there is no room to the draw.", tags: ["location", "room-to-draw"] },
  { id: "conflict", label: "Higher timeframe disagrees", description: "A clean lower-timeframe model running into supply, against the trend.", tags: ["conflict", "supply", "counter-trend", "htf-bias"] },
  { id: "liquidity-scope", label: "Internal versus external liquidity", description: "Which pool is the draw, and what that does to the target.", tags: ["internal-liquidity", "external-liquidity"] },
];

export const scenariosForSetup = (setup: Setup, catalog: ScenarioMeta[]): ScenarioMeta[] => catalog.filter((m) => m.tags.some((t) => setup.tags.includes(t)));

export function setupMastery(setup: Setup, attempts: StoredScenarioAttempt[], catalog: ScenarioMeta[]): Mastery & { scenarios: number } {
  const pool = scenariosForSetup(setup, catalog);
  return { ...masteryFrom(scoresFor(attemptsOn(attempts, catalog, (m) => pool.some((p) => p.id === m.id)), [])), scenarios: pool.length };
}

export function practiceSetup(setup: Setup, attempts: StoredScenarioAttempt[], catalog: ScenarioMeta[]): string | null {
  const pick = pickLeastRecent(scenariosForSetup(setup, catalog), attempts);
  if (!pick) return null;
  return `/train/play?mode=${pick.modes.includes("simulator") ? "simulator" : pick.modes[0]}&scenario=${pick.id}`;
}
