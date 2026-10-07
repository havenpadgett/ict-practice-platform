import { band, confluence, line, px, set, swingRef, zone, type ScenarioSpec } from "../lib";

// Advanced valid long in the London session. The Asia low is swept at 03:05,
// price displaces up, retraces into the gap and runs to the Asia high. Same
// model, different window and different pools.
export const sim024: ScenarioSpec = {
  id: "sim-024",
  seed: 24300,
  calendar: { start: [2031, 12, 1], days: 13 },
  startPrice: 19100,
  backdrop: { kind: "uptrend", days: 11, amp: 185 },
  legs: [
    { to: (h) => h.price + 34, until: [11, "00:30"], vol: 0.9, maxDev: 20 },
    { to: (h) => h.price - 112, until: [11, "02:45"], vol: 1.0 },
    { to: (h) => h.lo([11, "18:00"], [11, "02:45"]) - 12, until: [11, "03:05"], vol: 1.4 },
    { to: (h) => h.price + 56, until: [11, "03:11"], vol: 0.7 },
    { to: (h) => h.price - 4, until: [11, "03:18"], vol: 1.0 },
    { to: (h) => h.price + 30, until: [11, "03:27"], vol: 1.1 },
    { to: (h) => h.price - 58, until: [11, "03:40"], vol: 1.1 },
    { to: (h) => h.hi([11, "18:00"], [11, "00:30"]) + 6, until: [11, "05:30"], vol: 1.3 },
    { to: (h) => h.price - 20, until: [11, "06:00"], vol: 1.1 },
  ],
  anchorDay: 11,
  decision: [11, "03:30"],
  end: [11, "06:00"],
  checkpoints: { confirm: [11, "03:42"] },
  ideal: (c) => {
    const fvg = c.fvg("5m", [11, "03:00"], "bullish", 2);
    return { expect: "target", order: { direction: "long", entry: (fvg.priceHigh + fvg.priceLow) / 2 + 3, stop: c.extremes([11, "02:55"], [11, "03:08"]).low - 5, target: c.extremes([11, "18:00"], [11, "00:30"]).high - 2, placedAt: c.revealedAfter([11, "03:29"]) } };
  },
  build: (c) => {
    const fvg = c.fvg("5m", [11, "03:00"], "bullish", 2);
    const sweep = c.extremes([11, "02:55"], [11, "03:08"]);
    const asiaLow = c.extremes([11, "18:00"], [11, "02:50"]);
    const asiaHigh = c.extremes([11, "18:00"], [11, "00:30"]);
    const pdh = c.extremes([10, "18:00"], [10, "16:59"]);
    const bearGap = c.fvgIn("5m", "bearish", [11, "03:28"], [11, "03:50"]);

    return {
      title: "London sweeps Asia",
      difficulty: 3,
      type: "valid_setup",
      instrument: "NQ (seeded)",
      skills: { liquidity: 0.9, entry_models: 0.8, confluence: 0.7, htf_bias: 0.7, execution: 0.6, market_structure: 0.5, concept_recognition: 0.2 },
      tags: ["sweep", "displacement", "fvg", "london", "asia-range", "session-liquidity"],
      prompt: "It is 03:30 ET. Read the chart and decide.",
      intro: {
        beginner: "The Asia session has finished and London is open. The same ideas apply, with different pools of liquidity.",
        advanced: "03:30 ET.",
      },
      whyNot: [
        { label: "waiting for the NY open", why: "The sequence has already happened: Asia low swept, displacement, retrace into the gap. The New York open might be another opportunity; it isn't a reason to wait on this one." },
        { label: "the bearish 5m gap in the pullback", why: "It's the retrace itself, against the move." },
      ],
      reference: {
        summary: "London sweeps the Asia low at 03:05, displaces up through the last 5m high, and retraces into the gap it left. The Asia high is the draw. A valid long outside the New York window.",
        biasTimeframe: "4H",
        bias: set("Higher highs and higher lows on the Daily and 4H; the Asia selloff was a pullback.", { bullish: 1, neutral: 0.4 }),
        decision: set("Asia low swept, displacement and a defined entry with a clear draw: a valid long. Waiting for the retrace into the gap is just as sound.", { long: 1, wait: 0.75, no_trade: 0.1 }),
        answers: {
          take: set("Liquidity taken, displacement, a defined entry and a draw.", { take: 1, skip: 0.3 }),
          draw: set("The Asia high is the pool above.", { buy_side: 1, unclear: 0.3 }),
        },
        annotations: [
          line("asia-low", "key", `Asia low ${px(asiaLow.low)}`, asiaLow.low, "The obvious sell-side liquidity: the session's low, taken at 03:05.", { priceTolerance: 14 }),
          line("asia-high", "key", `Asia high ${px(asiaHigh.high)}`, asiaHigh.high, "The pool above and the draw.", { scope: "external", priceTolerance: 14, decisionNote: "Sets the target and the reward for the whole trade." }),
          swingRef("sweep-low", "swing_low", "supporting", `Sweep low ${px(sweep.low)}`, { price: sweep.low, t: sweep.lowT }, "The invalidation.", { priceTolerance: 10, timeTolerance: 20 }),
          zone("fvg-5m", "fvg", "key", "5m bullish FVG from the displacement", fvg, "The entry model.", { candidate: true }),
          zone("bear-gap", "fvg", "trap", "5m bearish FVG in the pullback", bearGap, "The retrace itself.", { candidate: true, whyNot: "A gap against displacement is the pullback." }),
          line("pdh", "irrelevant", `Previous day high ${px(pdh.high)}`, pdh.high, "Far above; not this move's target.", { priceTolerance: 14, candidate: true }),
        ],
        confluences: [
          confluence("sweep", "strongest", "The Asia low swept", "Liquidity taken."),
          confluence("displace", "strongest", "Displacement through the last 5m high", "The shift in structure."),
          confluence("fvg", "supporting", "Entry from the displacement gap", "A defined area."),
          confluence("htf", "supporting", "Daily and 4H trending up", "With the higher timeframe."),
          confluence("london", "irrelevant", "It's London, not New York", "The model works in any window."),
          confluence("pdh", "irrelevant", "Previous day high far above", "Not the target."),
        ],
        ranges: { expected_target: [band("Asia high", asiaHigh.high - 8, asiaHigh.high + 8, 25, { ideal: asiaHigh.high })] },
        dealingRange: null,
        trade: {
          direction: "long",
          entry: [band("the 5m FVG", fvg.priceLow, fvg.priceHigh, 8, { ideal: (fvg.priceLow + fvg.priceHigh) / 2 })],
          confirmedAtRevealed: c.revealedAtClose("5m", [11, "03:05"]),
          confirmationLabel: "the displacement that closed above the last 5m high",
          stop: { invalidation: sweep.low, buffer: 8 },
          targets: [band("Asia high", asiaHigh.high - 8, asiaHigh.high + 8, 25, { ideal: asiaHigh.high })],
          minRR: 2,
        },
        lookFor: [
          "Every session has its own pools: here the Asia range's low and high.",
          "The sequence is what matters, not the clock.",
        ],
      },
      trapMistakes: { short: ["AGAINST_HTF_BIAS"] },
    };
  },
};
