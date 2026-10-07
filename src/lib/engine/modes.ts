// Every training mode, as a configuration of the one engine. A mode is a list
// of stages (a view, an input, a scorer) and a few flags; nothing here is a
// parallel implementation of marking, scoring or replay. Adding a mode is
// adding an entry to this table.

import type { AnnotationKind, ModeConfig, ModeId, Scenario, StageConfig } from "@/lib/engine/types";
import type { Timeframe } from "@/lib/engine/time";

const ALL_TF: Timeframe[] = ["1D", "4H", "1H", "15m", "5m", "1m"];
const HTF: Timeframe[] = ["1D", "4H", "1H"];

const LINE_TOOLS: AnnotationKind[] = ["liquidity", "swing_high", "swing_low", "note"];
const ZONE_TOOLS: AnnotationKind[] = ["fvg", "ob", "zone", "note"];
const ALL_TOOLS: AnnotationKind[] = ["liquidity", "zone", "fvg", "ob", "swing_high", "swing_low", "note"];
const LINE_REFS: AnnotationKind[] = ["liquidity", "swing_high", "swing_low"];
const ZONE_REFS: AnnotationKind[] = ["fvg", "ob", "zone"];

const BIAS_OPTIONS = [
  { value: "bullish", label: "Bullish" },
  { value: "bearish", label: "Bearish" },
  { value: "neutral", label: "Neutral / no bias" },
];

const DECISION_OPTIONS = [
  { value: "long", label: "Long" },
  { value: "short", label: "Short" },
  { value: "wait", label: "Wait" },
  { value: "no_trade", label: "No trade" },
];

const bias = (timeframes: Timeframe[], initial: Timeframe, prompt: string): StageConfig => ({
  id: "bias",
  title: "Bias",
  prompt,
  timeframes,
  initialTimeframe: initial,
  input: { kind: "choice", options: BIAS_OPTIONS },
  scorer: "bias",
  guidance: "full",
});

export const MODES: Record<ModeId, ModeConfig> = {
  simulator: {
    id: "simulator",
    name: "Simulator",
    summary: "Replay a chart candle by candle, mark it up, and commit to a trade with only the information that existed at the time.",
    stages: [
      {
        id: "replay",
        title: "Replay",
        prompt: "Read the chart, mark it up, then commit: long, short, wait or no trade.",
        timeframes: ALL_TF,
        initialTimeframe: "1H",
        input: { kind: "replay", playback: true },
        scorer: "replay",
        guidance: "minimal",
      },
    ],
    feedback: "end",
    asksConfidence: true,
    trains: ["htf_bias", "liquidity", "entry_models", "confluence", "execution"],
  },

  build_your_bias: {
    id: "build_your_bias",
    name: "Build Your Bias",
    summary: "Daily, 4H and 1H first. Commit to a bias, then build the case, before any lower-timeframe price is shown.",
    stages: [
      bias(HTF, "4H", "Commit to a higher-timeframe bias."),
      {
        id: "location",
        title: "Premium or discount",
        prompt: "Where is price inside its dealing range?",
        timeframes: HTF,
        initialTimeframe: "4H",
        input: {
          kind: "choice",
          options: [
            { value: "premium", label: "Premium" },
            { value: "discount", label: "Discount" },
            { value: "equilibrium", label: "Equilibrium" },
          ],
        },
        scorer: "answer_set",
        answerKey: "location",
        dimension: "htf_bias",
        guidance: "full",
      },
      {
        id: "draw",
        title: "Draw on liquidity",
        prompt: "Which side of the range is price being drawn to?",
        timeframes: HTF,
        initialTimeframe: "4H",
        input: {
          kind: "choice",
          options: [
            { value: "buy_side", label: "Buy-side (above)" },
            { value: "sell_side", label: "Sell-side (below)" },
            { value: "unclear", label: "Unclear" },
          ],
        },
        scorer: "answer_set",
        answerKey: "draw",
        dimension: "liquidity_read",
        guidance: "full",
      },
      {
        id: "htf_liquidity",
        title: "HTF liquidity",
        prompt: "Mark the higher-timeframe liquidity that matters.",
        timeframes: HTF,
        initialTimeframe: "1H",
        input: { kind: "mark", tools: LINE_TOOLS, refKinds: LINE_REFS },
        scorer: "marks_liquidity",
        guidance: "full",
      },
      {
        id: "pd_arrays",
        title: "PD arrays",
        prompt: "Mark the PD arrays you'd care about.",
        timeframes: HTF,
        initialTimeframe: "1H",
        input: { kind: "mark", tools: ZONE_TOOLS, refKinds: ZONE_REFS },
        scorer: "marks_poi",
        guidance: "full",
      },
      {
        id: "target",
        title: "Expected target",
        prompt: "Where do you expect price to be drawn next?",
        timeframes: HTF,
        initialTimeframe: "1H",
        input: { kind: "price", side: "target" },
        scorer: "price_range",
        answerKey: "expected_target",
        dimension: "target_selection",
        guidance: "full",
      },
    ],
    feedback: "end",
    asksConfidence: true,
    trains: ["htf_bias", "liquidity"],
  },

  htf_to_ltf: {
    id: "htf_to_ltf",
    name: "HTF to LTF",
    summary: "Daily and 4H for bias, 1H for the draw, 15m for the area to wait for, 5m and 1m for confirmation, then act.",
    stages: [
      bias(["1D", "4H"], "4H", "Daily and 4H: what is your bias?"),
      {
        id: "draw",
        title: "Draw (1H)",
        prompt: "On the 1H, which side of the range is price drawn to?",
        timeframes: ["4H", "1H"],
        initialTimeframe: "1H",
        input: {
          kind: "choice",
          options: [
            { value: "buy_side", label: "Buy-side (above)" },
            { value: "sell_side", label: "Sell-side (below)" },
            { value: "unclear", label: "Unclear" },
          ],
        },
        scorer: "answer_set",
        answerKey: "draw",
        dimension: "liquidity_read",
        guidance: "full",
      },
      {
        id: "area",
        title: "Area to wait for (15m)",
        prompt: "Mark the area you would wait for price to reach.",
        timeframes: ["1H", "15m"],
        initialTimeframe: "15m",
        input: { kind: "mark", tools: ZONE_TOOLS, refKinds: ZONE_REFS },
        scorer: "marks_poi",
        guidance: "full",
      },
      {
        id: "act",
        title: "Confirmation (5m / 1m)",
        prompt: "Price has reached the area. Enter long, enter short, wait, or take no trade.",
        timeframes: ["15m", "5m", "1m"],
        initialTimeframe: "5m",
        checkpoint: "confirm",
        input: { kind: "trade", allowNoTrade: true },
        scorer: "trade",
        guidance: "full",
      },
    ],
    feedback: "end",
    asksConfidence: true,
    trains: ["htf_bias", "entry_models", "confluence", "execution"],
  },

  confluence: {
    id: "confluence",
    name: "Confluence Trainer",
    summary: "Pick which confluences actually support the setup, then decide whether to take it. More labels is not a better setup.",
    stages: [
      {
        id: "confluences",
        title: "Confluences",
        prompt: "Select the confluences that actually support a trade here.",
        timeframes: ALL_TF,
        initialTimeframe: "15m",
        input: { kind: "multi", options: "confluences" },
        scorer: "confluence",
        guidance: "minimal",
      },
      {
        id: "take",
        title: "Decision",
        prompt: "Do you take it?",
        timeframes: ALL_TF,
        initialTimeframe: "15m",
        input: { kind: "choice", options: DECISION_OPTIONS },
        scorer: "decision",
        guidance: "minimal",
      },
    ],
    feedback: "end",
    asksConfidence: true,
    trains: ["confluence"],
  },

  setup_or_trap: {
    id: "setup_or_trap",
    name: "Setup or Trap",
    summary: "Take it or skip it. Strong setups are mixed with beautiful traps; a correct skip scores the same as a correct take.",
    stages: [
      {
        id: "take",
        title: "Take or skip",
        prompt: "Is this a setup to take, or a trap to skip?",
        timeframes: ALL_TF,
        initialTimeframe: "15m",
        input: {
          kind: "choice",
          options: [
            { value: "take", label: "Take it" },
            { value: "skip", label: "Skip it" },
          ],
        },
        scorer: "answer_set",
        answerKey: "take",
        dimension: "trade_selection",
        guidance: "none",
      },
    ],
    feedback: "end",
    asksConfidence: true,
    trains: ["confluence", "execution"],
  },

  find_everything: {
    id: "find_everything",
    name: "Find Everything",
    summary: "Mark every relevant structure. Correct finds, misses and false positives all count.",
    stages: [
      {
        id: "mark",
        title: "Mark everything relevant",
        prompt: "Mark every swing, liquidity level, FVG and order block that matters.",
        timeframes: ["1H", "15m", "5m"],
        initialTimeframe: "15m",
        input: { kind: "mark", tools: ALL_TOOLS, refKinds: [...LINE_REFS, ...ZONE_REFS], allowNone: true },
        scorer: "marks_all",
        guidance: "minimal",
      },
    ],
    feedback: "end",
    asksConfidence: true,
    trains: ["concept_recognition", "market_structure", "liquidity"],
  },

  blind_chart: {
    id: "blind_chart",
    name: "Blind Chart",
    summary: "No concept named, no setup hinted, no guarantee one exists. Mark what matters, then commit.",
    stages: [
      {
        id: "replay",
        title: "Blind analysis",
        prompt: "Mark what matters. Then bias, entry, stop, target, or no trade.",
        timeframes: ALL_TF,
        initialTimeframe: "1H",
        input: { kind: "replay", playback: false },
        scorer: "replay",
        guidance: "none",
      },
    ],
    feedback: "end",
    asksConfidence: true,
    trains: ["htf_bias", "liquidity", "entry_models", "confluence", "execution"],
  },

  false_positive: {
    id: "false_positive",
    name: "Does it matter?",
    summary: "Weak versus true displacement, random gaps versus meaningful FVGs, ordinary swings versus real liquidity. Judge each one.",
    stages: [
      {
        id: "filter",
        title: "Does this actually matter?",
        prompt: "Tick every highlighted structure that actually matters for the next move.",
        timeframes: ["1H", "15m", "5m"],
        initialTimeframe: "15m",
        input: { kind: "multi", options: "candidates" },
        scorer: "candidates",
        guidance: "none",
      },
    ],
    feedback: "end",
    asksConfidence: true,
    trains: ["concept_recognition", "confluence"],
  },

  placement: {
    id: "placement",
    name: "Placement test",
    summary: "Short interactive chart tasks that place you across the seven skills.",
    stages: [],
    feedback: "end",
    asksConfidence: false,
    trains: ["concept_recognition", "market_structure", "liquidity", "htf_bias", "entry_models", "confluence", "execution"],
  },
};

export const TRAINING_MODES: ModeId[] = ["simulator", "build_your_bias", "htf_to_ltf", "confluence", "setup_or_trap", "find_everything", "blind_chart", "false_positive"];

export function getMode(id: string): ModeConfig | null {
  return Object.prototype.hasOwnProperty.call(MODES, id) ? MODES[id as ModeId] : null;
}

export function isModeId(x: unknown): x is ModeId {
  return typeof x === "string" && Object.prototype.hasOwnProperty.call(MODES, x);
}

/** Which modes a scenario carries enough reference material for. Every
 * mode reads the same scenario; this only asks whether the pieces it scores
 * exist (a mode that needs a premium/discount answer is not offered on a
 * scenario without one). */
export function supportedModes(s: Pick<Scenario, "reference" | "checkpoints">): ModeId[] {
  const r = s.reference;
  const out: ModeId[] = ["simulator", "blind_chart"];
  const hasLines = r.annotations.some((a) => a.role === "key" && (a.kind === "liquidity" || a.kind === "swing_high" || a.kind === "swing_low"));
  if (r.answers.location && r.answers.draw && r.ranges.expected_target && hasLines) out.push("build_your_bias");
  if (r.trade && s.checkpoints.confirm !== undefined && r.answers.draw) out.push("htf_to_ltf");
  if (r.confluences.length >= 4) out.push("confluence");
  if (r.answers.take) out.push("setup_or_trap");
  if (r.annotations.filter((a) => a.role === "key" || a.role === "valid").length >= 2) out.push("find_everything");
  if (r.annotations.filter((a) => a.candidate).length >= 3) out.push("false_positive");
  return out;
}
