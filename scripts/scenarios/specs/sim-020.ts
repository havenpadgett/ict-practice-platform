import { band, confluence, line, px, set, swingRef, sweepSkeleton, zone, type ScenarioSpec } from "../lib";

// Advanced failed setup. A textbook long gets stopped by a wick that takes
// the sweep low and then reverses straight to the target. A wider stop would
// have survived: and scores lower, because it was wider than the idea needed.
export const sim020: ScenarioSpec = {
  id: "sim-020",
  seed: 20099,
  calendar: { start: [2031, 5, 5], days: 13 },
  startPrice: 18300,
  backdrop: { kind: "uptrend", days: 11, amp: 195 },
  legs: sweepSkeleton({
    day: 11,
    sign: 1,
    overnight: 125,
    approach: 48,
    displace: 64,
    retrace: 60,
    end: (h) => h.price,
    endAt: "10:30",
    finish: [
      { to: (h) => h.price + 6, until: [11, "10:10"], vol: 1.2 },
      // The stop hunt: a fast wick below the sweep low and straight back.
      { to: (h) => h.lo([11, "18:00"], [11, "09:15"]) - 46, until: [11, "10:15"], vol: 0.8 },
      { to: (h) => h.price + 72, until: [11, "10:26"], vol: 0.9 },
      { to: (h) => h.hi([10, "18:00"], [10, "16:59"]) + 8, until: [11, "11:20"], vol: 1.8 },
    ],
  }),
  anchorDay: 11,
  decision: [11, "09:50"],
  end: [11, "11:50"],
  checkpoints: { confirm: [11, "10:08"] },
  ideal: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bullish", 2);
    return { expect: "stop", order: { direction: "long", entry: (fvg.priceLow + fvg.priceHigh) / 2, stop: c.extremes([11, "09:25"], [11, "09:38"]).low - 6, target: c.extremes([10, "18:00"], [10, "16:59"]).high - 2, placedAt: c.revealedAfter([11, "09:49"]) } };
  },
  build: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bullish", 2);
    const ob = c.candle("5m", [11, "09:25"]);
    const sweep = c.extremes([11, "09:25"], [11, "09:38"]);
    const hunt = c.extremes([11, "10:05"], [11, "10:20"]);
    if (hunt.low >= sweep.low - 20) throw new Error("the stop hunt doesn't clear the sweep low");
    const overnight = c.extremes([11, "18:00"], [11, "09:20"]);
    const pdh = c.extremes([10, "18:00"], [10, "16:59"]);

    return {
      title: "Stopped on the wick",
      difficulty: 3,
      type: "failed_setup",
      instrument: "NQ (seeded)",
      skills: { execution: 0.95, entry_models: 0.8, confluence: 0.6, liquidity: 0.8, htf_bias: 0.5, market_structure: 0.4, concept_recognition: 0.2 },
      tags: ["failed-setup", "stop-hunt", "stop-placement", "process"],
      prompt: "It is 09:50 ET. Read the chart and decide.",
      intro: {
        beginner: "A well-made trade can still be stopped. Look at where the stop belongs and why.",
        advanced: "09:50 ET.",
      },
      whyNot: [
        { label: "a stop 50 points deeper", why: "It would have survived this, and it would have been placed for the outcome, not for the idea. The stop belongs just beyond the level that proves the setup wrong. Widening it to avoid a wick halves the R:R on every trade that works." },
      ],
      reference: {
        summary: "A textbook long with a stop just beyond the sweep low. A fast wick takes that stop and reverses to the previous day high. The setup, the stop and the target were right; the stop-out is the cost of a tight, correct invalidation. A wider stop would have survived and scored lower.",
        biasTimeframe: "4H",
        bias: set("Higher highs and higher lows on the Daily and 4H; the dip was a pullback.", { bullish: 1, neutral: 0.4 }),
        decision: set("Everything required is present. Take it, or wait for the retrace.", { long: 1, wait: 0.75, no_trade: 0.15 }),
        answers: {
          take: set("Valid. This one gets stopped on a wick.", { take: 1, skip: 0.3 }),
          draw: set("The previous day high.", { buy_side: 1, unclear: 0.3 }),
        },
        annotations: [
          line("overnight-low", "key", `Overnight low ${px(overnight.low)}`, overnight.low, "Sell-side liquidity swept at the open.", { priceTolerance: 14 }),
          line("pdh", "key", `Previous day high ${px(pdh.high)}`, pdh.high, "The draw.", { scope: "external", priceTolerance: 14 }),
          swingRef("sweep-low", "swing_low", "supporting", `Sweep low ${px(sweep.low)}`, { price: sweep.low, t: sweep.lowT }, "The invalidation. A trade through it is a stop-out, wick or not.", { priceTolerance: 10, timeTolerance: 20, decisionNote: "Place the stop here. Not further 'in case'." }),
          zone("fvg-5m", "fvg", "key", "5m bullish FVG from the displacement", fvg, "The entry model.", { group: "poi", candidate: true }),
          zone("ob-5m", "ob", "valid", "5m order block under the gap", ob, "The alternative area.", { group: "poi", candidate: true }),
        ],
        confluences: [
          confluence("sweep", "strongest", "Sell-side liquidity swept", "Liquidity taken."),
          confluence("displace", "strongest", "Displacement through the last 5m high", "The shift in structure."),
          confluence("fvg", "supporting", "Entry from the gap", "A defined area."),
          confluence("htf", "supporting", "Daily and 4H trending up", "With the higher timeframe."),
          confluence("wick", "misleading", "\"A stop beyond a possible wick\"", "A stop placed for a wick you can't see isn't a stop for the idea."),
        ],
        ranges: { expected_target: [band("previous day high", pdh.high - 8, pdh.high + 8, 25, { ideal: pdh.high })] },
        dealingRange: null,
        trade: {
          direction: "long",
          entry: [band("the 5m FVG", fvg.priceLow, fvg.priceHigh, 8, { ideal: (fvg.priceLow + fvg.priceHigh) / 2 }), band("the order block under it", ob.priceLow, ob.priceHigh, 6, { credit: 0.9 })],
          confirmedAtRevealed: c.revealedAtClose("5m", [11, "09:35"]),
          confirmationLabel: "the displacement that closed above the last 5m high",
          stop: { invalidation: sweep.low, buffer: 9 },
          targets: [band("previous day high", pdh.high - 8, pdh.high + 8, 25, { ideal: pdh.high })],
          minRR: 2,
        },
        lookFor: [
          "A stop-out followed by the move you wanted hurts, and isn't a mistake in the process.",
          "Compare a stop beyond the invalidation with one placed for the outcome: the first costs a wick sometimes; the second costs R:R every time.",
        ],
      },
      trapMistakes: { short: ["AGAINST_HTF_BIAS"] },
    };
  },
};
