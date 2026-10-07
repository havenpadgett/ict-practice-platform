import { confluence, line, px, set, swingRef, type ScenarioSpec } from "../lib";

// Chop with fake sweeps. Both sides of the range get swept and neither move
// displaces: price just returns to the middle. A sweep with nothing behind it
// is a probe, and trading the second one is a coin flip.
export const sim010: ScenarioSpec = {
  id: "sim-010",
  seed: 10077,
  calendar: { start: [2030, 10, 7], days: 13 },
  startPrice: 20100,
  backdrop: { kind: "range", days: 11, amp: 140 },
  legs: [
    { to: (h) => h.price + 20, until: [11, "03:00"], vol: 0.9, maxDev: 16 },
    { to: (h) => h.price - 12, until: [11, "06:00"], vol: 1.0, maxDev: 18 },
    { to: (h) => h.price + 16, until: [11, "08:30"], vol: 1.1, maxDev: 18 },
    { to: (h) => h.price - 8, until: [11, "09:30"], vol: 1.3, maxDev: 18 },
    // Sweep of the range high, back inside within minutes.
    { to: (h) => h.hi([11, "18:00"], [11, "09:30"]) + 12, until: [11, "09:52"], vol: 1.2 },
    { to: (h) => h.price - 36, until: [11, "10:08"], vol: 1.2 },
    // Sweep of the range low, same story.
    { to: (h) => h.lo([11, "18:00"], [11, "10:08"]) - 12, until: [11, "10:28"], vol: 1.2 },
    { to: (h) => h.price + 34, until: [11, "10:44"], vol: 1.2 },
    { to: (h) => h.price - 6, until: [11, "11:40"], vol: 1.2, maxDev: 20 },
  ],
  anchorDay: 11,
  decision: [11, "10:46"],
  end: [11, "11:40"],
  build: (c) => {
    const rangeHigh = c.extremes([11, "18:00"], [11, "09:30"]);
    const sweepHigh = c.extremes([11, "09:40"], [11, "10:00"]);
    const sweepLow = c.extremes([11, "10:15"], [11, "10:36"]);
    if (sweepHigh.high <= rangeHigh.high || sweepLow.low >= c.extremes([11, "18:00"], [11, "10:08"]).low) throw new Error("the sweeps didn't take their levels");

    return {
      title: "Two sweeps, no move",
      difficulty: 2,
      type: "chop",
      instrument: "NQ (seeded)",
      skills: { confluence: 0.9, execution: 0.9, market_structure: 0.6, liquidity: 0.5, concept_recognition: 0.4, htf_bias: 0.4, entry_models: 0.3 },
      tags: ["chop", "fake-sweep", "no-displacement", "no-trade"],
      prompt: "It is 10:46 ET. Read the chart and decide.",
      intro: {
        beginner: "Price has taken a high and a low in the last hour. Ask what each of those moves did afterwards before you act on either.",
        advanced: "10:46 ET. Both sides taken. What followed each?",
      },
      whyNot: [
        { label: "buying the sweep of the low", why: "It's the second sweep in 45 minutes and it didn't displace. The first one reversed straight back, so a long here is the same coin flip with the order reversed." },
        { label: "selling the first sweep", why: "That one is over: it swept the high and drifted back, with no break of structure. It was never a signal, and the second sweep just showed it." },
      ],
      reference: {
        summary: "A range with both its high and its low taken inside an hour, and no displacement after either. A sweep is a reason to look; without displacement it's not a reason to act. No trade.",
        biasTimeframe: "4H",
        bias: set("The Daily and 4H are ranging; this morning is the same range.", { neutral: 1, bullish: 0.25, bearish: 0.25 }),
        decision: set("Two sweeps without displacement is chop. Nothing here has an edge.", { no_trade: 1, wait: 0.85, long: 0.1, short: 0.1 }),
        answers: {
          take: set("A sweep without displacement isn't a setup.", { skip: 1, take: 0.1 }),
          draw: set("No clear draw: price took both sides and returned to the middle.", { unclear: 1 }),
          location: set("Price is back in the middle of the range.", { equilibrium: 1 }),
        },
        annotations: [
          swingRef("sweep-high", "swing_high", "trap", `Swept high ${px(sweepHigh.high)}`, { price: sweepHigh.high, t: sweepHigh.highT }, "Took the range high and was back inside within minutes, with no break of structure after it.", { priceTolerance: 10, timeTolerance: 30, candidate: true, whyNot: "A sweep needs displacement behind it. This had none." }),
          swingRef("sweep-low", "swing_low", "trap", `Swept low ${px(sweepLow.low)}`, { price: sweepLow.low, t: sweepLow.lowT }, "The second sweep, same pattern: through the level, then a drift back.", { priceTolerance: 10, timeTolerance: 30, candidate: true, whyNot: "Two failed sweeps in a row is a market that's not moving." }),
          line("range-high", "irrelevant", `Range high ${px(rangeHigh.high)}`, rangeHigh.high, "The level that was swept, and nothing else came of it.", { priceTolerance: 10, candidate: true }),
        ],
        confluences: [
          confluence("nodisplace", "strongest", "No displacement after either sweep", "That's what makes them probes, not setups."),
          confluence("range", "strongest", "Price is back in the middle of the range", "No edge from here."),
          confluence("sweepl", "misleading", "Sell-side liquidity just swept", "True, and it didn't do anything."),
          confluence("sweeph", "misleading", "Buy-side liquidity swept earlier", "Also true, and also didn't."),
          confluence("session", "irrelevant", "NY AM window", "Timing doesn't change the picture."),
        ],
        ranges: {},
        dealingRange: null,
        trade: null,
        lookFor: [
          "After a sweep, watch what happens next. Displacement and a break of structure make it a setup; a drift back makes it a probe.",
          "Count the failed sweeps. Each one lowers the odds that the next is the real one.",
          "A market that takes both sides and goes nowhere is telling you to wait.",
        ],
      },
      trapMistakes: { long: ["NO_CONFIRMATION"], short: ["NO_CONFIRMATION"] },
    };
  },
};
