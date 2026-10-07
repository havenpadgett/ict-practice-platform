import { band, confluence, line, locate, px, set, swingRef, zone, type ScenarioSpec } from "../lib";

// Late or extended entry. The displacement is long gone and price is hovering
// just under the previous day high. The entry was an hour ago; chasing is the
// trap. The retrace into the gap, later, is the second chance.
export const sim009: ScenarioSpec = {
  id: "sim-009",
  seed: 9966,
  calendar: { start: [2030, 9, 2], days: 13 },
  startPrice: 19300,
  backdrop: { kind: "uptrend", days: 11, amp: 180 },
  legs: [
    { to: (h) => h.price - 190, until: [11, "03:00"], vol: 1.4 },
    { to: (h) => h.price + 20, until: [11, "07:30"], vol: 1.4 },
    { to: (h) => h.price - 45, until: [11, "09:15"], vol: 1.6 },
    { to: (h) => h.lo([11, "18:00"], [11, "09:15"]) - 14, until: [11, "09:34"], vol: 2 },
    { to: (h) => h.price + 66, until: [11, "09:40"], vol: 0.8 },
    { to: (h) => h.price - 5, until: [11, "09:47"], vol: 1.4 },
    { to: (h) => h.price + 74, until: [11, "09:56"], vol: 1.3 },
    // Extension: price keeps going and never looks back.
    { to: (h) => h.price + 88, until: [11, "10:14"], vol: 1.4 },
    { to: (h) => h.price - 4, until: [11, "10:40"], vol: 1.0, maxDev: 14 },
    // The retrace, much later, into the gap.
    { to: (h) => h.price - 196, until: [11, "11:08"], vol: 1.7 },
    { to: (h) => h.hi([10, "18:00"], [10, "16:59"]) + 8, until: [11, "12:20"], vol: 1.8 },
  ],
  anchorDay: 11,
  decision: [11, "10:40"],
  end: [11, "12:45"],
  checkpoints: { confirm: [11, "11:09"] },
  ideal: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bullish", 2);
    return { expect: "target", order: { direction: "long", entry: (fvg.priceHigh + fvg.priceLow) / 2 + 6, stop: c.extremes([11, "09:25"], [11, "09:38"]).low - 6, target: c.extremes([10, "18:00"], [10, "16:59"]).high - 2, placedAt: c.revealedAfter([11, "10:39"]) } };
  },
  build: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bullish", 2);
    const ob = c.candle("5m", [11, "09:25"]);
    const sweep = c.extremes([11, "09:25"], [11, "09:38"]);
    const overnight = c.extremes([11, "18:00"], [11, "09:20"]);
    const pdh = c.extremes([10, "18:00"], [10, "16:59"]);
    const nowPrice = c.close([11, "10:39"]);
    const where = locate(nowPrice, { high: pdh.high, low: pdh.low });
    const extended = nowPrice - fvg.priceHigh;
    if (extended < 150) throw new Error(`price is only ${extended.toFixed(0)} points above the gap: not extended`);

    return {
      title: "Already gone",
      difficulty: 2,
      type: "late_entry",
      instrument: "NQ (seeded)",
      skills: { execution: 0.9, entry_models: 0.9, confluence: 0.6, liquidity: 0.5, htf_bias: 0.4, market_structure: 0.3, concept_recognition: 0.2 },
      tags: ["late-entry", "extension", "patience", "fvg", "limit-order"],
      prompt: "It is 10:40 ET. Read the chart and decide.",
      intro: {
        beginner: "A good move started over an hour ago. Look at how far price has travelled from where the trade would have been taken.",
        advanced: "10:40 ET. The move is an hour old. What's left?",
      },
      whyNot: [
        { label: "buying at market", why: "The edge was in the gap the displacement left, more than 150 points down. Buying here pays for the whole move, puts the stop a full leg away, and leaves almost nothing before the previous day high." },
        { label: "shorting the extension", why: "Extended isn't reversed. Nothing has swept or displaced down, and the higher timeframe is up." },
      ],
      reference: {
        summary: "A valid long that was taken, or missed, an hour ago. Price is extended and sitting just under the previous day high. The decision now isn't to chase: it's to wait, with a resting order at the gap, for the retrace that comes.",
        biasTimeframe: "4H",
        bias: set("Higher highs and higher lows on the Daily and 4H; the move since the open is the trend continuing.", { bullish: 1, neutral: 0.4 }),
        decision: set("Chasing is the mistake. Waiting, or a resting limit order in the original gap, is the position; passing entirely is defensible but gives up a real second chance.", { wait: 1, long: 0.8, no_trade: 0.35 }),
        answers: {
          take: set("Not at this price. The setup is the gap, not the high.", { skip: 1, take: 0.2 }),
          draw: set("The previous day high is the pool, and price is close to it.", { buy_side: 1, unclear: 0.3 }),
          location: set("Price is extended far above the gap.", { [where]: 1, equilibrium: where === "premium" ? 0.3 : 0 }),
        },
        annotations: [
          zone("fvg-5m", "fvg", "key", "5m bullish FVG from the displacement", fvg, "The entry area, an hour and 150+ points back. A resting limit here is the trade; a market order here and now is not.", { group: "poi", candidate: true, decisionNote: "Patience with a resting order, or no trade. Not a market order." }),
          zone("ob-5m", "ob", "valid", "5m order block under the gap", ob, "The alternative area from the same origin.", { group: "poi", candidate: true }),
          line("pdh", "key", `Previous day high ${px(pdh.high)}`, pdh.high, "The draw, and price is already close to it: which is why chasing has nothing left to pay.", { scope: "external", priceTolerance: 14, decisionNote: "Reward left from here is tiny against a stop a full leg below." }),
          line("overnight-low", "supporting", `Overnight low ${px(overnight.low)}`, overnight.low, "The sell-side liquidity swept an hour ago.", { priceTolerance: 14 }),
          swingRef("sweep-low", "swing_low", "supporting", `Sweep low ${px(sweep.low)}`, { price: sweep.low, t: sweep.lowT }, "The invalidation.", { priceTolerance: 10, timeTolerance: 20 }),
        ],
        confluences: [
          confluence("sweep", "supporting", "The overnight low was swept an hour ago", "Context for the gap, not a reason to buy now."),
          confluence("extended", "strongest", "Price is more than a full leg above the entry area", "That is the whole problem."),
          confluence("gap", "strongest", "The origin gap is still unfilled below", "That's where the trade is."),
          confluence("pdh", "supporting", "Previous day high is close above", "Little room left for a market entry."),
          confluence("momentum", "misleading", "Strong momentum right now", "Momentum into the draw is the end of the move, not a place to start one."),
          confluence("fomo", "misleading", "\"It keeps going\"", "A move that's already happened isn't a setup."),
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
          "If the entry area is more than a leg behind you, the trade is gone. Wait for price to come back to it or move on.",
          "A resting limit order at the gap is a patient way to stay in a trade you missed.",
          "Check the room: the distance to the draw must justify the distance to the stop.",
        ],
      },
      trapMistakes: { short: ["AGAINST_HTF_BIAS"] },
    };
  },
};
