import { confluence, line, px, set, swingRef, zone, type ScenarioSpec } from "../lib";

// Advanced no-trade. A wide, two-sided morning on a Daily and 4H that don't
// agree. Both sides get taken, several gaps print, nothing holds. The skill
// is saying there's no bias to trade yet.
export const sim016: ScenarioSpec = {
  id: "sim-016",
  seed: 16633,
  calendar: { start: [2031, 4, 7], days: 13 },
  startPrice: 20800,
  backdrop: { kind: "range", days: 11, amp: 230 },
  legs: [
    { to: (h) => h.price + 45, until: [11, "03:00"], vol: 1.2, maxDev: 28 },
    { to: (h) => h.price - 70, until: [11, "07:30"], vol: 1.3, maxDev: 30 },
    { to: (h) => h.price + 55, until: [11, "09:30"], vol: 1.5, maxDev: 32 },
    { to: (h) => h.price + 62, until: [11, "09:48"], vol: 1.4 },
    { to: (h) => h.price - 115, until: [11, "10:22"], vol: 1.7 },
    { to: (h) => h.price + 95, until: [11, "10:58"], vol: 1.7 },
    { to: (h) => h.price - 70, until: [11, "11:30"], vol: 1.6 },
    { to: (h) => h.price + 30, until: [11, "12:10"], vol: 1.4, maxDev: 30 },
  ],
  anchorDay: 11,
  decision: [11, "11:35"],
  end: [11, "12:10"],
  build: (c) => {
    const am = c.extremes([11, "09:30"], [11, "11:34"]);
    const overnight = c.extremes([11, "18:00"], [11, "09:29"]);
    const pdh = c.extremes([10, "18:00"], [10, "16:59"]);
    const gapUp = c.fvgIn("5m", "bullish", [11, "09:35"], [11, "10:00"]);
    const gapDown = c.fvgIn("5m", "bearish", [11, "10:00"], [11, "10:30"]);
    const gapUp2 = c.fvgIn("5m", "bullish", [11, "10:30"], [11, "11:10"]);

    return {
      title: "Bias is a coin flip",
      difficulty: 3,
      type: "no_trade",
      instrument: "NQ (seeded)",
      skills: { htf_bias: 0.95, confluence: 0.9, execution: 0.9, liquidity: 0.6, market_structure: 0.7, concept_recognition: 0.4, entry_models: 0.4 },
      tags: ["no-bias", "no-trade", "two-sided", "htf-range", "false-structure"],
      prompt: "It is 11:35 ET. Read the chart and decide.",
      intro: {
        beginner: "A busy morning. Look at what the larger timeframes are doing before you decide whether any of this is tradable.",
        advanced: "11:35 ET.",
      },
      whyNot: [
        { label: "the last leg's direction", why: "The last 30 minutes is a lower high and a lower low on the 5m. That's three candles against a range that's been two-sided for hours and a Daily and 4H that hold no direction." },
        { label: "picking the cleanest gap", why: "There are three clean 5m gaps and each was run through by the next move. A clean gap on a chart with no directional bias isn't a location, it's decoration." },
      ],
      reference: {
        summary: "A wide, two-sided morning: both sides taken, three gaps printed and each one traded through, on a Daily and 4H with no direction. There is no bias to hold and so nothing to align with. No trade.",
        biasTimeframe: "4H",
        bias: set("The Daily and 4H are ranging and this morning swung through both ends of it. Neutral is the read; either direction is a guess.", { neutral: 1, bullish: 0.35, bearish: 0.35 }),
        decision: set("Two-sided, no bias, every gap run through: no trade is the position. Waiting for a clean sweep and displacement from a clear location is defensible too.", { no_trade: 1, wait: 0.85, long: 0.1, short: 0.1 }),
        answers: {
          take: set("Nothing here to take.", { skip: 1, take: 0.05 }),
          draw: set("No consistent draw: price has been drawn both ways.", { unclear: 1 }),
          location: set("Price is back around the middle of a wide range.", { equilibrium: 1, discount: 0.1, premium: 0.1 }),
        },
        annotations: [
          zone("gap-up", "fvg", "trap", "5m bullish FVG at the open", gapUp, "A clean gap that the next move ran straight through.", { candidate: true, whyNot: "A gap with no bias behind it just marks where price was." }),
          zone("gap-down", "fvg", "trap", "5m bearish FVG on the drop", gapDown, "Same: valid in form, and traded through.", { candidate: true }),
          zone("gap-up2", "fvg", "trap", "5m bullish FVG on the recovery", gapUp2, "The third gap in three moves, each reversed.", { candidate: true }),
          swingRef("am-high", "swing_high", "irrelevant", `Morning high ${px(am.high)}`, { price: am.high, t: am.highT }, "Real, and one of two equally obvious extremes.", { priceTolerance: 12, timeTolerance: 90, candidate: true }),
          swingRef("am-low", "swing_low", "irrelevant", `Morning low ${px(am.low)}`, { price: am.low, t: am.lowT }, "The other.", { priceTolerance: 12, timeTolerance: 90, candidate: true }),
          line("overnight-range", "irrelevant", `Overnight high ${px(overnight.high)}`, overnight.high, "Both ends of the overnight range were traded through.", { priceTolerance: 14 }),
        ],
        confluences: [
          confluence("noBias", "strongest", "The Daily and 4H hold no direction", "There is nothing to align with."),
          confluence("twoSided", "strongest", "Both sides of the range were taken this morning", "It's been two-sided, not building."),
          confluence("gaps", "misleading", "Three clean 5m FVGs", "Each was run through."),
          confluence("leg", "misleading", "The last leg is clearly down", "Three candles aren't structure."),
          confluence("time", "irrelevant", "The NY AM window has passed", "Timing isn't the problem."),
        ],
        ranges: {},
        dealingRange: null,
        trade: null,
        lookFor: [
          "Neutral is a read. If you can't state the bias in a sentence, you can't trade with it.",
          "Count how many times each gap held. Zero is the answer.",
          "A busy chart isn't an active setup. Activity without direction is the environment to skip.",
        ],
      },
      trapMistakes: { long: ["FORCED_SETUP"], short: ["FORCED_SETUP"] },
    };
  },
};
