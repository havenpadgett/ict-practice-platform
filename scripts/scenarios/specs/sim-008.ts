import { band, confluence, line, px, set, swingRef, zone, type ScenarioSpec } from "../lib";

// Internal versus external liquidity. Price retraces into the gap and rallies
// to the equal highs it printed on the way up (internal), takes them, and
// rolls over without ever reaching the previous day high (external). A target
// at the far pool turns a good trade into a stop-out.
export const sim008: ScenarioSpec = {
  id: "sim-008",
  seed: 8855,
  calendar: { start: [2030, 8, 5], days: 13 },
  startPrice: 17600,
  backdrop: { kind: "uptrend", days: 11, amp: 185 },
  legs: [
    { to: (h) => h.price - 150, until: [11, "03:00"], vol: 1.4 },
    { to: (h) => h.price + 20, until: [11, "07:30"], vol: 1.4 },
    { to: (h) => h.price - 45, until: [11, "09:15"], vol: 1.6 },
    { to: (h) => h.lo([11, "18:00"], [11, "09:15"]) - 14, until: [11, "09:34"], vol: 2 },
    { to: (h) => h.price + 64, until: [11, "09:40"], vol: 0.8 },
    { to: (h) => h.price - 5, until: [11, "09:47"], vol: 1.3 },
    { to: (h) => h.price + 104, until: [11, "09:55"], vol: 1.2 },
    { to: (h) => h.price - 12, until: [11, "10:00"], vol: 1.0 },
    // The second touch of the same high: equal highs.
    { to: (h) => h.hi([11, "09:47"], [11, "09:56"]) + 1, until: [11, "10:08"], vol: 1.0 },
    { to: (h) => h.price - 128, until: [11, "10:22"], vol: 1.5 },
    { to: (h) => h.hi([11, "09:47"], [11, "10:09"]), until: [11, "10:52"], vol: 1.6 },
    { to: (h) => h.lo([11, "18:00"], [11, "09:15"]) - 40, until: [11, "11:35"], vol: 1.8 },
  ],
  anchorDay: 11,
  decision: [11, "10:20"],
  end: [11, "11:50"],
  checkpoints: { confirm: [11, "10:24"] },
  ideal: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bullish", 2);
    const eq = c.extremes([11, "09:47"], [11, "10:09"]);
    return { expect: "target", order: { direction: "long", entry: (fvg.priceHigh + fvg.priceLow) / 2 + 4, stop: c.extremes([11, "09:25"], [11, "09:38"]).low - 6, target: eq.high - 3, placedAt: c.revealedAfter([11, "10:19"]) } };
  },
  build: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bullish", 2);
    const ob = c.candle("5m", [11, "09:25"]);
    const sweep = c.extremes([11, "09:25"], [11, "09:38"]);
    const overnight = c.extremes([11, "18:00"], [11, "09:20"]);
    const eq = c.extremes([11, "09:47"], [11, "10:09"]);
    const pdh = c.extremes([10, "18:00"], [10, "16:59"]);
    if (c.extremes([11, "10:09"], [11, "11:50"]).high >= pdh.high) throw new Error("price reached the previous day high: the external target would have worked");

    return {
      title: "Internal first, external never",
      difficulty: 2,
      type: "internal_external",
      instrument: "NQ (seeded)",
      skills: { liquidity: 0.95, execution: 0.8, entry_models: 0.6, htf_bias: 0.5, confluence: 0.5, market_structure: 0.5, concept_recognition: 0.3 },
      tags: ["internal-liquidity", "external-liquidity", "equal-highs", "target", "draw"],
      prompt: "It is 10:20 ET. Read the chart and decide.",
      intro: {
        beginner: "Two pools of liquidity sit above price: a nearer one and a farther one. A target belongs at the one price is actually drawn to next.",
        advanced: "10:20 ET. Internal or external: which is the draw, and what does that do to the target?",
      },
      whyNot: [
        { label: "the previous day high as the target", why: "It's real and external, and price has two nearer, obvious highs to take first. Internal liquidity (inside the current range) usually trades before external (beyond it). Targeting the far pool means holding through the exact reversal that follows the near one." },
      ],
      reference: {
        summary: "A valid long whose draw is the equal highs printed on the way up (internal liquidity). Price takes them and rolls over; the previous day high (external) is never reached. The trade works with the internal target and fails with the external one.",
        biasTimeframe: "4H",
        bias: set("Higher highs and higher lows on the Daily and 4H; the overnight dip was a pullback.", { bullish: 1, neutral: 0.4 }),
        decision: set("Sweep, displacement and a retrace into the gap: a valid long. The skill is picking the right target.", { long: 1, wait: 0.7, no_trade: 0.1 }),
        answers: {
          take: set("Valid, with the target placed at the internal pool.", { take: 1, skip: 0.3 }),
          draw: set("The equal highs just above are the nearest pool and the first draw.", { buy_side: 1, unclear: 0.3 }),
        },
        annotations: [
          line("eq-highs", "key", `Equal highs ${px(eq.high)}`, eq.high, "Two highs at the same price just above: an obvious pool, close, and exactly where the retrace is aimed.", { scope: "internal", priceTolerance: 10, decisionNote: "The first draw and the target. Close enough to give a clean 2R." }),
          line("overnight-low", "key", `Overnight low ${px(overnight.low)}`, overnight.low, "The sell-side liquidity swept at the open.", { priceTolerance: 14 }),
          line("pdh", "trap", `Previous day high ${px(pdh.high)}`, pdh.high, "The external pool. Real, and not reached: price rolls over from the internal highs.", { scope: "external", priceTolerance: 14, candidate: true, whyNot: "External liquidity is the next draw after the internal one is taken. Here it never is." }),
          swingRef("sweep-low", "swing_low", "supporting", `Sweep low ${px(sweep.low)}`, { price: sweep.low, t: sweep.lowT }, "The invalidation.", { priceTolerance: 10, timeTolerance: 20 }),
          zone("fvg-5m", "fvg", "key", "5m bullish FVG from the displacement", fvg, "The entry model.", { group: "poi", candidate: true }),
          zone("ob-5m", "ob", "valid", "5m order block under the gap", ob, "An acceptable alternative.", { group: "poi", candidate: true }),
        ],
        confluences: [
          confluence("sweep", "strongest", "Sell-side liquidity swept", "The reason to look for longs."),
          confluence("eq", "strongest", "Equal highs close above", "The nearest pool and the draw."),
          confluence("fvg", "supporting", "Entry from the displacement gap", "A defined area."),
          confluence("htf", "supporting", "Daily and 4H trending up", "With the higher timeframe."),
          confluence("pdh", "misleading", "Previous day high as the target", "External: price is drawn to the internal pool first and rolls over from it."),
        ],
        ranges: { expected_target: [band("the equal highs", eq.high - 8, eq.high + 6, 22, { ideal: eq.high })] },
        dealingRange: null,
        trade: {
          direction: "long",
          entry: [band("the 5m FVG", fvg.priceLow, fvg.priceHigh, 8, { ideal: (fvg.priceLow + fvg.priceHigh) / 2 }), band("the order block under it", ob.priceLow, ob.priceHigh, 6, { credit: 0.9 })],
          confirmedAtRevealed: c.revealedAtClose("5m", [11, "09:35"]),
          confirmationLabel: "the displacement that closed above the last 5m high",
          stop: { invalidation: sweep.low, buffer: 9 },
          targets: [band("the equal highs", eq.high - 8, eq.high + 6, 22, { ideal: eq.high })],
          minRR: 2,
        },
        lookFor: [
          "Name the nearest pool before you name the farthest. Internal liquidity is usually taken first.",
          "A target at a pool price never reaches is a stop-out in waiting.",
          "Ask: is this target inside the current range or beyond it? Beyond needs a reason.",
        ],
      },
      trapMistakes: { short: ["AGAINST_HTF_BIAS"] },
    };
  },
};
