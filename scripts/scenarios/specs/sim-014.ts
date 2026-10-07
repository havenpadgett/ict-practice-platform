import { band, confluence, line, px, set, swingRef, sweepSkeleton, zone, type ScenarioSpec } from "../lib";

// Failed short that worked first. The trade runs well past 1R, turns, and
// takes the stop. Process was sound the whole way; holding to the plan is
// what a stop-out looks like.
export const sim014: ScenarioSpec = {
  id: "sim-014",
  seed: 14411,
  calendar: { start: [2031, 2, 4], days: 13 },
  startPrice: 21100,
  backdrop: { kind: "downtrend", days: 11, amp: 185 },
  legs: sweepSkeleton({
    day: 11,
    sign: -1,
    overnight: 108,
    approach: 46,
    displace: 60,
    retrace: 46,
    end: (h) => h.price,
    endAt: "10:30",
    finish: [
      { to: (h) => h.price - 70, until: [11, "10:26"], vol: 1.6 },
      { to: (h) => h.hi([11, "18:00"], [11, "09:15"]) + 36, until: [11, "11:05"], vol: 2.0 },
    ],
  }),
  anchorDay: 11,
  decision: [11, "09:50"],
  end: [11, "11:40"],
  checkpoints: { confirm: [11, "10:14"] },
  ideal: (c) => ({
    expect: "stop",
    order: { direction: "short", entry: (c.fvg("5m", [11, "09:30"], "bearish", 2).priceLow + c.fvg("5m", [11, "09:30"], "bearish", 2).priceHigh) / 2, stop: c.extremes([11, "09:25"], [11, "09:38"]).high + 6, target: c.extremes([10, "18:00"], [10, "16:59"]).low + 2, placedAt: c.revealedAfter([11, "09:49"]) },
  }),
  build: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bearish", 2);
    const ob = c.candle("5m", [11, "09:25"]);
    const sweep = c.extremes([11, "09:25"], [11, "09:38"]);
    const overnight = c.extremes([11, "18:00"], [11, "09:20"]);
    const pdl = c.extremes([10, "18:00"], [10, "16:59"]);

    return {
      title: "It worked, then it didn't",
      difficulty: 2,
      type: "failed_setup",
      instrument: "NQ (seeded)",
      skills: { execution: 0.95, entry_models: 0.7, confluence: 0.6, liquidity: 0.6, htf_bias: 0.5, market_structure: 0.4, concept_recognition: 0.2 },
      tags: ["failed-setup", "short", "mfe", "process", "sweep"],
      prompt: "It is 09:50 ET. Read the chart and decide.",
      intro: {
        beginner: "A trade can move your way and still end at the stop. The stop and the target are decided before entry, and they stay where they are.",
        advanced: "09:50 ET. Read it. Note what the trade does after entry, and what you'd have to do differently.",
      },
      whyNot: [
        { label: "moving the stop to break even on the way", why: "Not part of this plan, and not what scores: the question is whether the entry, stop and target were right when they were set. Trade management is a separate skill this simulator doesn't grade." },
      ],
      reference: {
        summary: "A valid short: buy-side swept, displacement down, retrace into the gap, previous day low as the draw. The trade ran well past 1R, turned, and stopped out above the sweep high. A sound process, a -1R result.",
        biasTimeframe: "4H",
        bias: set("Lower highs and lower lows on the Daily and 4H; the overnight rally was a retrace.", { bearish: 1, neutral: 0.4 }),
        decision: set("Everything required is present. Take it, or wait for the retrace to the gap.", { short: 1, wait: 0.75, no_trade: 0.15 }),
        answers: {
          take: set("Valid; it can still lose.", { take: 1, skip: 0.3 }),
          draw: set("The previous day low is the pool below.", { sell_side: 1, unclear: 0.3 }),
        },
        annotations: [
          line("overnight-high", "key", `Overnight high ${px(overnight.high)}`, overnight.high, "Buy-side liquidity, swept at the open.", { priceTolerance: 14 }),
          line("pdl", "key", `Previous day low ${px(pdl.low)}`, pdl.low, "The draw.", { scope: "external", priceTolerance: 14 }),
          swingRef("sweep-high", "swing_high", "supporting", `Sweep high ${px(sweep.high)}`, { price: sweep.high, t: sweep.highT }, "The invalidation, and the level that ended the trade.", { priceTolerance: 10, timeTolerance: 20 }),
          zone("fvg-5m", "fvg", "key", "5m bearish FVG from the displacement", fvg, "The entry model.", { group: "poi", candidate: true }),
          zone("ob-5m", "ob", "valid", "5m order block above the gap", ob, "An acceptable alternative.", { group: "poi", candidate: true }),
        ],
        confluences: [
          confluence("sweep", "strongest", "Buy-side liquidity swept", "Liquidity taken."),
          confluence("displace", "strongest", "Displacement below the last 5m low", "The shift in structure."),
          confluence("fvg", "supporting", "Entry from the displacement gap", "A defined area."),
          confluence("htf", "supporting", "Daily and 4H trending down", "With the higher timeframe."),
          confluence("hope", "misleading", "\"It'll hold up from here\"", "A hope isn't a confluence."),
        ],
        ranges: { expected_target: [band("previous day low", pdl.low - 8, pdl.low + 8, 25, { ideal: pdl.low })] },
        dealingRange: null,
        trade: {
          direction: "short",
          entry: [band("the 5m FVG", fvg.priceLow, fvg.priceHigh, 8, { ideal: (fvg.priceLow + fvg.priceHigh) / 2 }), band("the order block above it", ob.priceLow, ob.priceHigh, 6, { credit: 0.9 })],
          confirmedAtRevealed: c.revealedAtClose("5m", [11, "09:35"]),
          confirmationLabel: "the displacement that closed below the last 5m low",
          stop: { invalidation: sweep.high, buffer: 9 },
          targets: [band("previous day low", pdl.low - 8, pdl.low + 8, 25, { ideal: pdl.low })],
          minRR: 2,
        },
        lookFor: [
          "Look at the adverse and favourable excursions after the review: this trade was well ahead before it was stopped.",
          "The plan was set before the entry. A trade that went your way and failed is still a trade made correctly.",
        ],
      },
      trapMistakes: { long: ["AGAINST_HTF_BIAS"] },
    };
  },
};
