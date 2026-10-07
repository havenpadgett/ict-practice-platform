import { band, confluence, line, px, set, swingRef, zone, type ScenarioSpec } from "../lib";

// Advanced late entry with a second chance. The first retrace taps just short
// of the gap and rejects; a resting order in the gap doesn't fill. Price runs
// again, then returns deeper an hour in. The decision at 10:20 is whether to
// chase the first reaction.
export const sim021: ScenarioSpec = {
  id: "sim-021",
  seed: 21077,
  calendar: { start: [2031, 9, 1], days: 13 },
  startPrice: 17900,
  backdrop: { kind: "uptrend", days: 11, amp: 175 },
  legs: [
    { to: (h) => h.price - 175, until: [11, "03:00"], vol: 1.4 },
    { to: (h) => h.price + 20, until: [11, "07:30"], vol: 1.4 },
    { to: (h) => h.price - 45, until: [11, "09:15"], vol: 1.6 },
    { to: (h) => h.lo([11, "18:00"], [11, "09:15"]) - 14, until: [11, "09:34"], vol: 2 },
    { to: (h) => h.price + 66, until: [11, "09:40"], vol: 0.8 },
    { to: (h) => h.price - 5, until: [11, "09:47"], vol: 1.3 },
    { to: (h) => h.price + 36, until: [11, "09:56"], vol: 1.4 },
    // A shallow retrace that stops above the gap.
    { to: (h) => h.price - 32, until: [11, "10:06"], vol: 1.2 },
    { to: (h) => h.price + 70, until: [11, "10:24"], vol: 1.4 },
    { to: (h) => h.price - 2, until: [11, "10:38"], vol: 1.0, maxDev: 14 },
    // The deeper retrace, an hour in.
    { to: (h) => h.price - 104, until: [11, "11:12"], vol: 1.6 },
    { to: (h) => h.hi([10, "18:00"], [10, "16:59"]) + 8, until: [11, "12:20"], vol: 1.8 },
  ],
  anchorDay: 11,
  decision: [11, "10:36"],
  end: [11, "12:45"],
  checkpoints: { confirm: [11, "11:13"] },
  ideal: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bullish", 2);
    return { expect: "target", order: { direction: "long", entry: (fvg.priceHigh + fvg.priceLow) / 2 + 4, stop: c.extremes([11, "09:25"], [11, "09:38"]).low - 6, target: c.extremes([10, "18:00"], [10, "16:59"]).high - 2, placedAt: c.revealedAfter([11, "10:35"]) } };
  },
  build: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bullish", 2);
    const ob = c.candle("5m", [11, "09:25"]);
    const sweep = c.extremes([11, "09:25"], [11, "09:38"]);
    const overnight = c.extremes([11, "18:00"], [11, "09:20"]);
    const pdh = c.extremes([10, "18:00"], [10, "16:59"]);
    const firstTap = c.extremes([11, "10:00"], [11, "10:08"]);
    if (firstTap.low <= fvg.priceHigh) throw new Error("the first retrace entered the gap: it isn't shallow");
    const secondTap = c.extremes([11, "10:55"], [11, "11:15"]);
    if (secondTap.low > (fvg.priceHigh + fvg.priceLow) / 2 + 4) throw new Error("the second retrace doesn't reach the middle of the gap");

    return {
      title: "The first tap doesn't count",
      difficulty: 3,
      type: "late_entry",
      instrument: "NQ (seeded)",
      skills: { execution: 0.95, entry_models: 0.85, confluence: 0.6, liquidity: 0.5, htf_bias: 0.4, market_structure: 0.3, concept_recognition: 0.2 },
      tags: ["late-entry", "patience", "limit-order", "fvg", "second-chance"],
      prompt: "It is 10:36 ET. Read the chart and decide.",
      intro: {
        beginner: "Price came back toward the area an hour ago and bounced before reaching it. Look at what the bounce means for where your order should be.",
        advanced: "10:36 ET.",
      },
      whyNot: [
        { label: "buying the first reaction", why: "It bounced from above the gap, never entering it. The area is where the edge was, and buying 40 points higher on a bounce is a market order that happens to look like a pullback." },
        { label: "moving the order up to get filled", why: "A resting order that doesn't fill hasn't failed. Moving it toward price trades the location for a fill, and the stop you'd need is bigger." },
      ],
      reference: {
        summary: "A valid long whose first retrace tapped short of the gap and left. A limit order in the gap didn't fill and price ran. An hour in, price came back much deeper, into the gap and its order block, and then ran to the previous day high. Patience, not chasing, is the position.",
        biasTimeframe: "4H",
        bias: set("Higher highs and higher lows on the Daily and 4H; the overnight dip was a pullback.", { bullish: 1, neutral: 0.4 }),
        decision: set("Keep the order where the edge is and wait. A resting limit in the gap is a valid long; passing or standing aside is defensible; chasing is the mistake.", { wait: 1, long: 0.85, no_trade: 0.35 }),
        answers: {
          take: set("Only from the gap.", { skip: 1, take: 0.3 }),
          draw: set("The previous day high.", { buy_side: 1, unclear: 0.3 }),
        },
        annotations: [
          zone("fvg-5m", "fvg", "key", "5m bullish FVG from the displacement", fvg, "Still the entry. A first reaction above it doesn't change where the edge is.", { group: "poi", candidate: true, decisionNote: "Leave the order in the gap. A missed fill is not a reason to move it." }),
          zone("ob-5m", "ob", "valid", "5m order block under the gap", ob, "The alternative, and where the deeper retrace finally goes.", { group: "poi", candidate: true }),
          swingRef("first-tap", "swing_low", "trap", `First retrace low ${px(firstTap.low)}`, { price: firstTap.low, t: firstTap.lowT }, "A bounce from above the gap: not a retest of it. Buying it is a market order in disguise.", { priceTolerance: 10, timeTolerance: 20, candidate: true, whyNot: "A reaction near an area isn't a reaction from it." }),
          line("overnight-low", "key", `Overnight low ${px(overnight.low)}`, overnight.low, "Sell-side liquidity swept at the open.", { priceTolerance: 14 }),
          line("pdh", "key", `Previous day high ${px(pdh.high)}`, pdh.high, "The draw.", { scope: "external", priceTolerance: 14 }),
          swingRef("sweep-low", "swing_low", "supporting", `Sweep low ${px(sweep.low)}`, { price: sweep.low, t: sweep.lowT }, "The invalidation.", { priceTolerance: 10, timeTolerance: 20 }),
        ],
        confluences: [
          confluence("sweep", "strongest", "Sell-side liquidity swept", "Liquidity taken."),
          confluence("displace", "strongest", "Displacement through the last 5m high", "The shift in structure."),
          confluence("gap", "supporting", "The origin gap is still unfilled", "The area is intact."),
          confluence("htf", "supporting", "Daily and 4H trending up", "With the higher timeframe."),
          confluence("bounce", "misleading", "The first reaction from above the gap", "A bounce that never reached the area."),
          confluence("fill", "misleading", "\"I need to get filled\"", "A fill isn't an edge."),
        ],
        ranges: { expected_target: [band("previous day high", pdh.high - 8, pdh.high + 8, 25, { ideal: pdh.high })] },
        dealingRange: null,
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
          "A resting order that hasn't filled is an order working, not an order failing.",
          "Price coming near an area and bouncing isn't the area being tested.",
        ],
      },
      trapMistakes: { short: ["AGAINST_HTF_BIAS"] },
    };
  },
};
