import { band, confluence, line, px, set, swingRef, sweepSkeleton, zone, type ScenarioSpec } from "../lib";

// Valid long from an order block. The displacement is steady rather than
// explosive: the gaps it leaves are small and stacked, and the cleaner origin
// is the last down candle before the move. Price retraces all the way into it.
export const sim015: ScenarioSpec = {
  id: "sim-015",
  seed: 15522,
  calendar: { start: [2031, 3, 3], days: 13 },
  startPrice: 19700,
  backdrop: { kind: "uptrend", days: 11, amp: 180 },
  legs: sweepSkeleton({
    day: 11,
    sign: 1,
    overnight: 120,
    approach: 45,
    displace: 70,
    displaceMinutes: 16,
    pause: 6,
    push: 34,
    retrace: 96,
    end: (h) => h.hi([10, "18:00"], [10, "16:59"]) + 8,
    endAt: "11:35",
  }),
  anchorDay: 11,
  decision: [11, "10:02"],
  end: [11, "12:10"],
  checkpoints: { confirm: [11, "10:30"] },
  ideal: (c) => {
    const ob = c.candle("5m", [11, "09:30"]);
    return { expect: "target", order: { direction: "long", entry: (ob.priceLow + ob.priceHigh) / 2 + 6, stop: c.extremes([11, "09:25"], [11, "09:38"]).low - 6, target: c.extremes([10, "18:00"], [10, "16:59"]).high - 2, placedAt: c.revealedAfter([11, "10:01"]) } };
  },
  build: (c) => {
    const ob = c.candle("5m", [11, "09:30"]);
    const fvg = c.fvg("5m", [11, "09:30"], "bullish", 1);
    const sweep = c.extremes([11, "09:25"], [11, "09:38"]);
    const overnight = c.extremes([11, "18:00"], [11, "09:20"]);
    const pdh = c.extremes([10, "18:00"], [10, "16:59"]);
    const chopGap = c.fvgIn("5m", "bearish", [11, "10:00"], [11, "10:20"]);

    return {
      title: "The block under the move",
      difficulty: 2,
      type: "valid_setup",
      instrument: "NQ (seeded)",
      skills: { entry_models: 0.95, liquidity: 0.8, confluence: 0.7, htf_bias: 0.5, execution: 0.6, market_structure: 0.5, concept_recognition: 0.5 },
      tags: ["order-block", "sweep", "displacement", "pdh-draw"],
      prompt: "It is 10:02 ET. Read the chart and decide.",
      intro: {
        beginner: "A steady move doesn't leave one big gap. Look for the candle where it began, and for what price did to the liquidity just before.",
        advanced: "10:02 ET. A steady move. Where's the entry?",
      },
      whyNot: [
        { label: "hunting for one big gap", why: "The displacement was steady rather than explosive, so the gaps it left are small and stacked along the way. The order block, the last down candle before the move, is the origin: a single, defined area with the stop just beneath it." },
        { label: "the bearish gap in the pullback", why: "Against the move. It's the retrace." },
      ],
      reference: {
        summary: "Sell-side liquidity swept, a steady displacement through the last 5m high, and a retrace all the way into the last down candle before it: the order block. The small gap just above it is an acceptable alternative. The previous day high is the draw.",
        biasTimeframe: "4H",
        bias: set("Higher highs and higher lows on the Daily and 4H; the overnight dip was a pullback.", { bullish: 1, neutral: 0.4 }),
        decision: set("A valid long: the entry is the order block. Waiting for the retrace into it is equally sound.", { long: 1, wait: 0.8, no_trade: 0.1 }),
        answers: {
          take: set("Liquidity taken, displacement, a defined area and a draw.", { take: 1, skip: 0.3 }),
          draw: set("The previous day high is the pool above.", { buy_side: 1, unclear: 0.3 }),
        },
        annotations: [
          zone("ob-5m", "ob", "key", "5m order block: the last down candle before the move", ob, "The candle the displacement started from. A retrace into its range is the entry.", { group: "poi", candidate: true, decisionNote: "When the move is steady the block is the cleaner origin: a defined area and a stop just beyond the sweep." }),
          zone("fvg-5m", "fvg", "valid", "Small 5m gap just above the block", fvg, "The first gap the move left, sitting on top of the block. An acceptable alternative area.", { group: "poi", candidate: true }),
          line("overnight-low", "key", `Overnight low ${px(overnight.low)}`, overnight.low, "The sell-side liquidity swept at the open.", { priceTolerance: 14 }),
          line("pdh", "key", `Previous day high ${px(pdh.high)}`, pdh.high, "The draw.", { scope: "external", priceTolerance: 14 }),
          swingRef("sweep-low", "swing_low", "supporting", `Sweep low ${px(sweep.low)}`, { price: sweep.low, t: sweep.lowT }, "The invalidation.", { priceTolerance: 10, timeTolerance: 20 }),
          zone("pullback-gap", "fvg", "irrelevant", "5m bearish FVG in the pullback", chopGap, "Against the move: the retrace.", { candidate: true }),
        ],
        confluences: [
          confluence("sweep", "strongest", "Sell-side liquidity swept", "Liquidity taken."),
          confluence("displace", "strongest", "Displacement through the last 5m high", "The shift in structure."),
          confluence("ob", "supporting", "Entry from the order block", "A defined origin for the move."),
          confluence("htf", "supporting", "Daily and 4H trending up", "With the higher timeframe."),
          confluence("onegap", "misleading", "\"There's no single big gap\"", "The block is the setup here; waiting for a textbook gap would miss it."),
        ],
        ranges: { expected_target: [band("previous day high", pdh.high - 8, pdh.high + 8, 25, { ideal: pdh.high })] },
        dealingRange: null,
        trade: {
          direction: "long",
          entry: [band("the order block (upper half)", (ob.priceLow + ob.priceHigh) / 2, ob.priceHigh, 6, { ideal: (ob.priceLow + ob.priceHigh) / 2 + 6 }), band("the small gap above it", fvg.priceLow, fvg.priceHigh, 6, { credit: 0.9 })],
          confirmedAtRevealed: c.revealedAtClose("5m", [11, "09:50"]),
          confirmationLabel: "the displacement that closed above the last 5m high",
          stop: { invalidation: sweep.low, buffer: 9 },
          targets: [band("previous day high", pdh.high - 8, pdh.high + 8, 25, { ideal: pdh.high })],
          minRR: 2,
        },
        lookFor: [
          "When there's no gap, look for the last opposing candle before the move.",
          "The area has to come from the move that took the liquidity, not from anywhere that looks like a candle.",
        ],
      },
      trapMistakes: { short: ["AGAINST_HTF_BIAS"] },
    };
  },
};
