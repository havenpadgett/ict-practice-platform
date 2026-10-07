import { confluence, line, px, set, zone, type ScenarioSpec } from "../lib";

// No-trade environment. A tight range in the middle of nowhere: no liquidity
// is taken, nothing displaces, and the higher timeframe has no opinion.
export const sim005: ScenarioSpec = {
  id: "sim-005",
  seed: 5521,
  calendar: { start: [2030, 5, 6], days: 13 },
  startPrice: 20500,
  backdrop: { kind: "range", days: 11, amp: 150 },
  legs: [
    { to: (h) => h.price + 8, until: [11, "03:00"], vol: 0.9, maxDev: 14 },
    { to: (h) => h.price - 10, until: [11, "08:00"], vol: 1.0, maxDev: 18 },
    { to: (h) => h.price + 12, until: [11, "09:30"], vol: 1.2, maxDev: 20 },
    { to: (h) => h.price - 20, until: [11, "10:00"], vol: 1.5, maxDev: 24 },
    { to: (h) => h.price + 22, until: [11, "10:30"], vol: 1.5, maxDev: 24 },
    { to: (h) => h.price - 16, until: [11, "11:00"], vol: 1.5, maxDev: 24 },
    { to: (h) => h.price + 10, until: [11, "11:40"], vol: 1.4, maxDev: 24 },
  ],
  anchorDay: 11,
  decision: [11, "10:15"],
  end: [11, "11:40"],
  build: (c) => {
    const morningHigh = c.extremes([11, "09:30"], [11, "10:14"]);
    const asia = c.extremes([11, "18:00"], [11, "03:00"]);
    const pdh = c.extremes([10, "18:00"], [10, "16:59"]);
    const smallGap = c.fvg("5m", [11, "10:00"], "bullish", 12);

    return {
      title: "Nothing to do here",
      difficulty: 2,
      type: "no_trade",
      instrument: "NQ (seeded)",
      skills: { execution: 0.9, confluence: 0.9, htf_bias: 0.5, liquidity: 0.4, market_structure: 0.4, concept_recognition: 0.2, entry_models: 0.3 },
      tags: ["no-trade", "chop", "range"],
      prompt: "It is 10:15 ET. Read the chart and decide.",
      intro: {
        beginner: "Not every chart has a trade in it. Look at what price is doing and what it has taken. Then decide whether there is anything to act on at all.",
        advanced: "10:15 ET. Read it and decide.",
      },
      whyNot: [
        { label: "trading the range edges", why: "A tight range with no liquidity taken and no displacement has no edge at the edges. Every move out of it is as likely to fail as to run." },
        { label: "forcing a bias from the last candles", why: "Three candles up is not structure. The Daily and 4H have no direction here, so there's nothing for a lower-timeframe entry to align with." },
      ],
      reference: {
        summary: "A tight, overlapping range with equal highs and lows inside it. No external liquidity was taken, nothing displaced and the higher timeframe is flat. Standing aside is the position.",
        biasTimeframe: "4H",
        bias: set("The Daily and 4H are ranging: overlapping candles, no higher highs or lower lows to speak of.", { neutral: 1, bullish: 0.3, bearish: 0.3 }),
        decision: set("No sweep, no displacement, no bias. There is nothing to wait for either: this is a day to not trade until the chart changes.", { no_trade: 1, wait: 0.8, long: 0.1, short: 0.1 }),
        answers: {
          take: set("There's no setup to take.", { skip: 1, take: 0.05 }),
          draw: set("There's no clear pool price is being drawn to.", { unclear: 1 }),
          location: set("Price is in the middle of its range.", { equilibrium: 1 }),
        },
        annotations: [
          line("morning-high", "trap", `Morning range high ${px(morningHigh.high)}`, morningHigh.high, "Equal highs inside a range look like liquidity. With no move towards them and nothing displacing, they are noise.", { priceTolerance: 10, scope: "internal", candidate: true, whyNot: "Internal liquidity in a chop isn't a draw. Wait until price actually leaves the range." }),
          line("asia-high", "irrelevant", `Asia high ${px(asia.high)}`, asia.high, "Real, inside the same range, and untouched.", { priceTolerance: 12, candidate: true }),
          zone("small-gap", "fvg", "irrelevant", "Small 5m gap", smallGap, "A gap too small to carry a trade in a market that isn't moving.", { candidate: true }),
          line("pdh", "irrelevant", `Previous day high ${px(pdh.high)}`, pdh.high, "Far above, and price shows no interest in it.", { priceTolerance: 14, scope: "external", candidate: true }),
        ],
        confluences: [
          confluence("range", "strongest", "Overlapping, directionless candles", "That is the whole picture: there's no edge in the middle of a range."),
          confluence("htf", "supporting", "Higher timeframe has no direction", "Nothing for a lower-timeframe entry to align with."),
          confluence("eq", "misleading", "Equal highs inside the range", "Internal liquidity in a chop isn't a reason to trade."),
          confluence("gap", "irrelevant", "A small 5m FVG", "Too small to matter."),
          confluence("session", "irrelevant", "Inside the NY AM window", "Being in the right window isn't a setup."),
        ],
        ranges: {},
        dealingRange: null,
        trade: null,
        lookFor: [
          "Ask first whether there's anything to trade. Taking nothing is a result.",
          "Equal highs inside a range aren't a target until price leaves it.",
          "Wait for a sweep of something external and displacement, not for boredom to end.",
        ],
      },
      trapMistakes: { long: ["FORCED_SETUP"], short: ["FORCED_SETUP"] },
    };
  },
};
