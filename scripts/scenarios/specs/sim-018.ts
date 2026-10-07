import { band, confluence, line, px, set, swingRef, zone, type ScenarioSpec } from "../lib";

// Advanced short with two valid targets, both reached. The equal lows printed
// on the way down (internal) are taken first for a clean 2R; the previous day
// low (external) follows. Either is a defensible draw; neither is wrong.
export const sim018: ScenarioSpec = {
  id: "sim-018",
  seed: 18855,
  calendar: { start: [2031, 7, 1], days: 13 },
  startPrice: 23100,
  backdrop: { kind: "downtrend", days: 11, amp: 200 },
  legs: [
    { to: (h) => h.price + 150, until: [11, "03:00"], vol: 1.4 },
    { to: (h) => h.price - 20, until: [11, "07:30"], vol: 1.4 },
    { to: (h) => h.price + 45, until: [11, "09:15"], vol: 1.6 },
    { to: (h) => h.hi([11, "18:00"], [11, "09:15"]) + 14, until: [11, "09:34"], vol: 2 },
    { to: (h) => h.price - 64, until: [11, "09:40"], vol: 0.8 },
    { to: (h) => h.price + 5, until: [11, "09:47"], vol: 1.3 },
    { to: (h) => h.price - 108, until: [11, "09:55"], vol: 1.2 },
    { to: (h) => h.price + 12, until: [11, "10:00"], vol: 1.0 },
    { to: (h) => h.lo([11, "09:47"], [11, "09:56"]) - 1, until: [11, "10:08"], vol: 1.0 },
    { to: (h) => h.price + 134, until: [11, "10:22"], vol: 1.5 },
    { to: (h) => h.lo([11, "09:47"], [11, "10:09"]), until: [11, "10:52"], vol: 1.6 },
    { to: (h) => h.lo([10, "18:00"], [10, "16:59"]) + 6, until: [11, "12:05"], vol: 1.8 },
  ],
  anchorDay: 11,
  decision: [11, "10:20"],
  end: [11, "12:25"],
  checkpoints: { confirm: [11, "10:24"] },
  ideal: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bearish", 2);
    const eq = c.extremes([11, "09:47"], [11, "10:09"]);
    return { expect: "target", order: { direction: "short", entry: (fvg.priceHigh + fvg.priceLow) / 2 - 4, stop: c.extremes([11, "09:25"], [11, "09:38"]).high + 6, target: eq.low + 3, placedAt: c.revealedAfter([11, "10:19"]) } };
  },
  build: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bearish", 2);
    const ob = c.candle("5m", [11, "09:25"]);
    const sweep = c.extremes([11, "09:25"], [11, "09:38"]);
    const overnight = c.extremes([11, "18:00"], [11, "09:20"]);
    const eq = c.extremes([11, "09:47"], [11, "10:09"]);
    const pdl = c.extremes([10, "18:00"], [10, "16:59"]);
    if (c.extremes([11, "10:50"], [11, "12:25"]).low > pdl.low + 14) throw new Error("price never reached the previous day low");

    return {
      title: "Two pools, both reached",
      difficulty: 3,
      type: "internal_external",
      instrument: "NQ (seeded)",
      skills: { liquidity: 0.95, execution: 0.85, entry_models: 0.6, htf_bias: 0.5, confluence: 0.5, market_structure: 0.5, concept_recognition: 0.2 },
      tags: ["internal-liquidity", "external-liquidity", "equal-lows", "target", "multiple-valid", "short"],
      prompt: "It is 10:20 ET. Read the chart and decide.",
      intro: {
        beginner: "Two pools of liquidity sit below price. Consider what each target would risk and reward, and whether one is the only right answer.",
        advanced: "10:20 ET.",
      },
      whyNot: [
        { label: "only calling one target right", why: "Both pools are reached here. The equal lows give a clean 2R, and the previous day low follows for much more. A target at either is defensible; the process question is whether you chose one deliberately." },
      ],
      reference: {
        summary: "A valid short with two acceptable targets, both reached: the equal lows printed on the way down (internal, a clean 2R) and the previous day low (external, a much larger move). Either is a defensible draw.",
        biasTimeframe: "4H",
        bias: set("Lower highs and lower lows on the Daily and 4H; the overnight rally was a retrace.", { bearish: 1, neutral: 0.4 }),
        decision: set("Sweep, displacement and a retrace into the gap: a valid short.", { short: 1, wait: 0.7, no_trade: 0.1 }),
        answers: {
          take: set("Valid, with a choice of targets.", { take: 1, skip: 0.3 }),
          draw: set("Equal lows just below are the nearest pool; the previous day low is the farther one.", { sell_side: 1, unclear: 0.3 }),
        },
        annotations: [
          line("eq-lows", "valid", `Equal lows ${px(eq.low)}`, eq.low, "Internal liquidity: two lows at the same price, close and obvious. A clean first target.", { scope: "internal", group: "draw", priceTolerance: 10, decisionNote: "A 2R at a pool price has just printed." }),
          line("pdl", "valid", `Previous day low ${px(pdl.low)}`, pdl.low, "External liquidity: the larger pool, reached after the internal one.", { scope: "external", group: "draw", priceTolerance: 14, decisionNote: "The runner if you hold past the first pool." }),
          line("overnight-high", "key", `Overnight high ${px(overnight.high)}`, overnight.high, "Buy-side liquidity swept at the open.", { priceTolerance: 14 }),
          swingRef("sweep-high", "swing_high", "supporting", `Sweep high ${px(sweep.high)}`, { price: sweep.high, t: sweep.highT }, "The invalidation.", { priceTolerance: 10, timeTolerance: 20 }),
          zone("fvg-5m", "fvg", "key", "5m bearish FVG from the displacement", fvg, "The entry model.", { group: "poi", candidate: true }),
          zone("ob-5m", "ob", "valid", "5m order block above the gap", ob, "An acceptable alternative.", { group: "poi", candidate: true }),
        ],
        confluences: [
          confluence("sweep", "strongest", "Buy-side liquidity swept", "Liquidity taken."),
          confluence("displace", "strongest", "Displacement below the last 5m low", "The shift in structure."),
          confluence("eq", "supporting", "Equal lows close below", "A clean first target."),
          confluence("pdl", "supporting", "Previous day low further below", "The larger draw."),
          confluence("htf", "supporting", "Daily and 4H trending down", "With the higher timeframe."),
        ],
        ranges: {
          expected_target: [band("equal lows", eq.low - 6, eq.low + 8, 22, { ideal: eq.low }), band("previous day low", pdl.low - 8, pdl.low + 8, 25, { ideal: pdl.low, credit: 0.9 })],
        },
        dealingRange: null,
        trade: {
          direction: "short",
          entry: [band("the 5m FVG", fvg.priceLow, fvg.priceHigh, 8, { ideal: (fvg.priceLow + fvg.priceHigh) / 2 }), band("the order block above it", ob.priceLow, ob.priceHigh, 6, { credit: 0.9 })],
          confirmedAtRevealed: c.revealedAtClose("5m", [11, "09:35"]),
          confirmationLabel: "the displacement that closed below the last 5m low",
          stop: { invalidation: sweep.high, buffer: 9 },
          targets: [band("the equal lows", eq.low - 6, eq.low + 8, 22, { ideal: eq.low }), band("the previous day low", pdl.low - 8, pdl.low + 8, 25, { ideal: pdl.low, credit: 0.9 })],
          minRR: 2,
        },
        lookFor: [
          "More than one target can be right. Say which pool you're after and why, then stay with it.",
          "A near target gives certainty and a far one gives size. Both are decisions about what the move is for.",
        ],
      },
      trapMistakes: { long: ["AGAINST_HTF_BIAS"] },
    };
  },
};
