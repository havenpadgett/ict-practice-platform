import { band, confluence, line, locate, px, set, swingRef, sweepSkeleton, zone, type ScenarioSpec } from "../lib";

// Several FVGs. A trend day leaves four gaps on the screen; only the one that
// formed on the sweep and displacement, inside the discount of the leg, is
// the entry. The gap in the middle of the push, an old 1H gap far below and a
// bearish gap in the pullback are real and don't matter.
export const sim007: ScenarioSpec = {
  id: "sim-007",
  seed: 7744,
  calendar: { start: [2030, 7, 1], days: 13 },
  startPrice: 21400,
  backdrop: { kind: "uptrend", days: 11, amp: 200 },
  legs: sweepSkeleton({
    day: 11,
    sign: 1,
    overnight: 135,
    approach: 55,
    displace: 62,
    push: 92,
    retrace: 118,
    end: (h) => h.hi([10, "18:00"], [10, "16:59"]) + 8,
    endAt: "11:05",
  }),
  anchorDay: 11,
  decision: [11, "10:00"],
  end: [11, "11:35"],
  checkpoints: { confirm: [11, "10:22"] },
  ideal: (c) => ({
    expect: "target",
    order: {
      direction: "long",
      entry: (c.fvg("5m", [11, "09:30"], "bullish", 2).priceHigh + c.fvg("5m", [11, "09:30"], "bullish", 2).priceLow) / 2 + 6,
      stop: c.extremes([11, "09:25"], [11, "09:38"]).low - 6,
      target: c.extremes([10, "18:00"], [10, "16:59"]).high - 2,
      placedAt: c.revealedAfter([11, "09:59"]),
    },
  }),
  build: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bullish", 2);
    const pushGap = c.fvg("5m", [11, "09:46"], "bullish", 3);
    const ob = c.candle("5m", [11, "09:25"]);
    const sweep = c.extremes([11, "09:25"], [11, "09:38"]);
    const overnight = c.extremes([11, "18:00"], [11, "09:20"]);
    const pdh = c.extremes([10, "18:00"], [10, "16:59"]);
    const oldGap = c.fvgIn("1H", "bullish", [8, "18:00"], [10, "16:59"]);
    const pullbackGap = c.fvgIn("5m", "bearish", [11, "09:55"], [11, "10:20"]);
    const where = locate(c.close([11, "09:59"]), { high: pdh.high, low: pdh.low });

    return {
      title: "Four gaps, one that matters",
      difficulty: 2,
      type: "multiple_fvgs",
      instrument: "NQ (seeded)",
      skills: { entry_models: 0.95, concept_recognition: 0.7, confluence: 0.7, liquidity: 0.7, htf_bias: 0.5, execution: 0.5, market_structure: 0.4 },
      tags: ["fvg", "which-fvg", "sweep", "displacement"],
      prompt: "It is 10:00 ET. Read the chart and decide.",
      intro: {
        beginner: "There are several gaps on this chart. Not every gap is a place to trade. Work out which one the move is actually built on.",
        advanced: "10:00 ET. Several gaps. Which one, and why not the others?",
      },
      whyNot: [
        { label: "the gap in the middle of the push", why: "It formed in the upper half of the leg, long after the sweep. Price rarely comes back to it before the draw, and a stop behind it has to cover the whole leg. It's a gap in a move, not the origin of the move." },
        { label: "the old 1H gap far below", why: "It's real and a long way from the action. The sweep and displacement happened at a different price; the relevant gap is the one they left." },
        { label: "the bearish 5m gap in the pullback", why: "A gap against the move, left by the retrace. In an uptrend it's where the pullback is, not where to sell." },
      ],
      reference: {
        summary: "Four gaps. The one that matters is the 5m FVG left by the displacement that followed the sweep, sitting low in the leg. The gap in the push, an old 1H gap and a bearish pullback gap are real and don't carry the trade.",
        biasTimeframe: "4H",
        bias: set("Higher highs and higher lows on the Daily and 4H; the overnight dip was a pullback.", { bullish: 1, neutral: 0.4 }),
        decision: set("A valid long with the right gap to enter from. Waiting for the retrace is equally sound; buying the extended move is not.", { long: 1, wait: 0.8, no_trade: 0.1 }),
        answers: {
          take: set("The setup is valid; the work is picking the right gap.", { take: 1, skip: 0.3 }),
          draw: set("The previous day high is the pool above.", { buy_side: 1, unclear: 0.3 }),
          location: set("Against yesterday's range price is in premium after the rally; the clean entry is the retrace into the displacement gap.", { [where]: 1, equilibrium: where === "premium" ? 0.3 : 0 }),
        },
        annotations: [
          zone("fvg-5m", "fvg", "key", "5m FVG from the sweep's displacement", fvg, "Formed on the displacement that followed the sweep and closed through the last 5m high: the origin of the move. This is the entry.", { group: "poi", candidate: true, decisionNote: "The gap tied to the sweep carries the trade. Entering from it puts the stop just beyond the sweep low." }),
          zone("ob-5m", "ob", "valid", "5m order block under it", ob, "The last down candle before the displacement; an acceptable alternative from the same origin.", { group: "poi", candidate: true }),
          zone("push-gap", "fvg", "trap", "5m FVG in the middle of the push", pushGap, "A real gap, higher in the leg and unrelated to the sweep. Entering there needs a stop behind the entire leg.", { candidate: true, whyNot: "Price rarely retraces into a mid-leg gap before the draw, and the stop has nowhere logical to go." }),
          zone("old-gap", "fvg", "irrelevant", "Old 1H bullish FVG far below", oldGap, "Real, and too far from the action to be part of this idea.", { candidate: true }),
          zone("pullback-gap", "fvg", "irrelevant", "5m bearish FVG in the pullback", pullbackGap, "Against the move; it's the retrace itself.", { candidate: true }),
          line("overnight-low", "key", `Overnight low ${px(overnight.low)}`, overnight.low, "The sell-side liquidity that was swept.", { priceTolerance: 14 }),
          line("pdh", "key", `Previous day high ${px(pdh.high)}`, pdh.high, "The draw.", { scope: "external", priceTolerance: 14 }),
          swingRef("sweep-low", "swing_low", "supporting", `Sweep low ${px(sweep.low)}`, { price: sweep.low, t: sweep.lowT }, "The invalidation.", { priceTolerance: 10, timeTolerance: 20 }),
        ],
        confluences: [
          confluence("sweep", "strongest", "Sell-side liquidity swept", "Why there was something to buy."),
          confluence("displace", "strongest", "Displacement through the last 5m high, leaving a gap", "The gap exists because of this."),
          confluence("origin", "supporting", "Entry is the gap on the origin of the move", "The gap that carried the move."),
          confluence("htf", "supporting", "Daily and 4H trending up", "With the higher timeframe."),
          confluence("push", "misleading", "The gap in the middle of the push", "A gap in a move, not the origin of it."),
          confluence("old", "irrelevant", "Old 1H gap far below", "Real and far away."),
          confluence("count", "misleading", "\"More gaps means more support\"", "More labels is not a better setup."),
        ],
        ranges: { expected_target: [band("previous day high", pdh.high - 8, pdh.high + 8, 25, { ideal: pdh.high })] },
        dealingRange: { high: pdh.high, low: pdh.low, tf: "1D" },
        trade: {
          direction: "long",
          entry: [band("the origin FVG", fvg.priceLow, fvg.priceHigh, 8, { ideal: (fvg.priceLow + fvg.priceHigh) / 2 }), band("the order block under it", ob.priceLow, ob.priceHigh, 6, { credit: 0.9 })],
          confirmedAtRevealed: c.revealedAtClose("5m", [11, "09:35"]),
          confirmationLabel: "the displacement that closed above the last 5m high",
          stop: { invalidation: sweep.low, buffer: 9 },
          targets: [band("previous day high", pdh.high - 8, pdh.high + 8, 25, { ideal: pdh.high })],
          minRR: 2,
        },
        lookFor: [
          "Ask of every gap: what created it? The one that came out of the sweep and displacement is the one tied to the idea.",
          "A mid-leg gap forces a stop behind the whole move. If the stop has no logical home, neither does the entry.",
          "Gaps against the move are the pullback itself.",
        ],
      },
      trapMistakes: { short: ["AGAINST_HTF_BIAS"] },
    };
  },
};
