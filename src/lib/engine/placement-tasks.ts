// The placement test: fifteen short, interactive chart tasks in order of
// difficulty (docs/ENGINE.md → Placement). Chart interaction over multiple
// choice: most tasks ask for marks, a level or a trade; the few choices are
// single judgments about a chart that is on screen. This file is what the
// browser may see (the question, the chart, the input). The acceptable
// answers live in placement-keys.ts, which only the server imports.

import type { Timeframe } from "@/lib/engine/time";
import type { InputSpec, SkillId } from "@/lib/engine/types";

export type PlacementKind = "recognition" | "context" | "execution";

export type PlacementTask = {
  id: string;
  title: string;
  prompt: string;
  /** The scenario whose chart it uses. */
  scenarioId: string;
  /** Named checkpoint of that scenario ("start" by default). */
  checkpoint?: string;
  timeframes: Timeframe[];
  initialTimeframe: Timeframe;
  input: InputSpec;
  kind: PlacementKind;
  /** Which skills this task is evidence for, and how much each. */
  skills: Partial<Record<SkillId, number>>;
  /** 1 (early) to 5 (advanced). */
  level: 1 | 2 | 3 | 4 | 5;
};

const CHOICE = (options: [string, string][]): InputSpec => ({ kind: "choice", options: options.map(([value, label]) => ({ value, label })) });
const ALL: Timeframe[] = ["1H", "15m", "5m"];

export const PLACEMENT_TASKS: PlacementTask[] = [
  // Early: recognition.
  { id: "p01", title: "Find the gap", prompt: "Mark the Fair Value Gap that the displacement left.", scenarioId: "sim-001", timeframes: ALL, initialTimeframe: "5m", input: { kind: "mark", tools: ["fvg", "zone", "note"], refKinds: ["fvg"] }, kind: "recognition", skills: { concept_recognition: 1 }, level: 1 },
  { id: "p02", title: "Find the liquidity", prompt: "Mark the liquidity that was taken at the open, and the pool above it that price is being drawn toward.", scenarioId: "sim-001", timeframes: ["1H", "15m", "5m"], initialTimeframe: "15m", input: { kind: "mark", tools: ["liquidity", "swing_high", "swing_low", "note"], refKinds: ["liquidity", "swing_high", "swing_low"] }, kind: "recognition", skills: { liquidity: 1, concept_recognition: 0.3 }, level: 1 },
  { id: "p03", title: "Swing points", prompt: "Mark the swing low that the sweep made.", scenarioId: "sim-004", timeframes: ALL, initialTimeframe: "5m", input: { kind: "mark", tools: ["swing_high", "swing_low", "note"], refKinds: ["swing_high", "swing_low"] }, kind: "recognition", skills: { market_structure: 1, concept_recognition: 0.4 }, level: 1 },
  { id: "p04", title: "Displacement or drift", prompt: "How would you describe the move that followed the sweep?", scenarioId: "sim-003", timeframes: ALL, initialTimeframe: "5m", input: CHOICE([["displacement", "Displacement: it took out structure with a body close"], ["drift", "Drift: it bounced without taking out structure"], ["none", "Nothing happened"]]), kind: "recognition", skills: { concept_recognition: 0.8, market_structure: 0.5 }, level: 2 },
  { id: "p05", title: "Order block", prompt: "Mark the order block: the last down candle before the move that took the liquidity.", scenarioId: "sim-015", timeframes: ALL, initialTimeframe: "5m", input: { kind: "mark", tools: ["ob", "fvg", "zone", "note"], refKinds: ["ob", "fvg"] }, kind: "recognition", skills: { concept_recognition: 1, entry_models: 0.4 }, level: 2 },
  // Middle.
  { id: "p06", title: "Sweep", prompt: "What did price take at the open?", scenarioId: "sim-002", timeframes: ALL, initialTimeframe: "15m", input: CHOICE([["sell_side", "Sell-side liquidity: it took a low"], ["buy_side", "Buy-side liquidity: it took a high"], ["nothing", "Neither"]]), kind: "context", skills: { liquidity: 0.7, market_structure: 0.7 }, level: 2 },
  { id: "p07", title: "Shift in structure?", prompt: "Has the market structure shifted up, as of now?", scenarioId: "sim-003", timeframes: ALL, initialTimeframe: "5m", input: CHOICE([["yes", "Yes: a body closed above the last swing high"], ["no", "Not yet: only a wick has gone through"], ["unclear", "Can't tell"]]), kind: "context", skills: { market_structure: 1, confluence: 0.4 }, level: 3 },
  { id: "p08", title: "Premium or discount", prompt: "Against yesterday's range, where is price?", scenarioId: "sim-011", timeframes: ["1D", "4H", "1H"], initialTimeframe: "1H", input: CHOICE([["premium", "Premium"], ["discount", "Discount"], ["equilibrium", "Equilibrium"]]), kind: "context", skills: { htf_bias: 0.8, liquidity: 0.3 }, level: 3 },
  { id: "p09", title: "Which gap matters", prompt: "Mark the Fair Value Gap that carries this trade, and only that one.", scenarioId: "sim-007", timeframes: ALL, initialTimeframe: "5m", input: { kind: "mark", tools: ["fvg", "ob", "zone", "note"], refKinds: ["fvg"] }, kind: "context", skills: { entry_models: 0.9, confluence: 0.7, concept_recognition: 0.4 }, level: 3 },
  { id: "p10", title: "The draw", prompt: "Where is price most likely being drawn next? Click the chart or type a price.", scenarioId: "sim-008", checkpoint: "start", timeframes: ["1H", "15m", "5m"], initialTimeframe: "5m", input: { kind: "price", side: "target" }, kind: "context", skills: { liquidity: 1, execution: 0.3 }, level: 3 },
  // Advanced.
  { id: "p11", title: "Bias on a big chart", prompt: "Commit to a higher-timeframe bias.", scenarioId: "sim-016", timeframes: ["1D", "4H", "1H"], initialTimeframe: "4H", input: CHOICE([["bullish", "Bullish"], ["bearish", "Bearish"], ["neutral", "Neutral / no bias"]]), kind: "context", skills: { htf_bias: 1, confluence: 0.3 }, level: 4 },
  { id: "p12", title: "Take it or skip it", prompt: "The pattern on the 5m is clean. Take it, or skip it?", scenarioId: "sim-011", timeframes: ["1D", "4H", "1H", "15m", "5m"], initialTimeframe: "1H", input: CHOICE([["take", "Take it"], ["skip", "Skip it"]]), kind: "execution", skills: { confluence: 0.9, execution: 0.8 }, level: 4 },
  { id: "p13", title: "Does the higher timeframe agree?", prompt: "Does the higher timeframe support the long on the 5m?", scenarioId: "sim-006", timeframes: ["1D", "4H", "1H", "15m", "5m"], initialTimeframe: "4H", input: CHOICE([["aligned", "Yes: it supports it"], ["conflict", "No: it conflicts with it"], ["neutral", "It has no opinion"]]), kind: "context", skills: { htf_bias: 1, confluence: 0.5 }, level: 4 },
  { id: "p14", title: "Build the trade", prompt: "Take the setup, or don't. If you do, set the entry, stop and target.", scenarioId: "sim-001", checkpoint: "confirm", timeframes: ["1H", "15m", "5m", "1m"], initialTimeframe: "5m", input: { kind: "trade", allowNoTrade: true }, kind: "execution", skills: { execution: 1, entry_models: 0.9, confluence: 0.5 }, level: 5 },
  { id: "p15", title: "Is there a trade?", prompt: "Decide: long, short, wait, or no trade.", scenarioId: "sim-005", timeframes: ["1D", "4H", "1H", "15m", "5m"], initialTimeframe: "15m", input: CHOICE([["long", "Long"], ["short", "Short"], ["wait", "Wait"], ["no_trade", "No trade"]]), kind: "execution", skills: { execution: 1, confluence: 0.6 }, level: 5 },
];

export function getPlacementTask(id: unknown): PlacementTask | null {
  return typeof id === "string" ? (PLACEMENT_TASKS.find((t) => t.id === id) ?? null) : null;
}

/** Tasks for one skill's test-out: its own tasks, hardest first. */
export function tasksForSkill(skill: SkillId): PlacementTask[] {
  return PLACEMENT_TASKS.filter((t) => (t.skills[skill] ?? 0) >= 0.7).sort((a, b) => b.level - a.level);
}
