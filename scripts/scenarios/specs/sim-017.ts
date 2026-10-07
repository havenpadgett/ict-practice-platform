import { band, confluence, line, px, set, swingRef, zone, type ScenarioSpec } from "../lib";

// Advanced conflict with more than one valid answer. A clean 5m long inside a
// Daily and 4H downtrend, 100 points under 1H supply. Standing aside is right.
// So is taking it with the target just under the supply, at a lower reward.
export const sim017: ScenarioSpec = {
  id: "sim-017",
  seed: 17744,
  calendar: { start: [2031, 6, 2], days: 13 },
  startPrice: 22600,
  backdrop: { kind: "downtrend", days: 11, amp: 200 },
  legs: [
    { to: (h) => h.price + 50, until: [11, "02:00"], vol: 1.1, maxDev: 22 },
    // The impulse that leaves the supply.
    { to: (h) => h.price - 140, until: [11, "03:00"], vol: 0.8 },
    { to: (h) => h.price - 140, until: [11, "07:30"], vol: 1.3 },
    { to: (h) => h.price - 35, until: [11, "09:15"], vol: 1.5 },
    { to: (h) => h.lo([11, "02:50"], [11, "09:15"]) - 14, until: [11, "09:34"], vol: 2 },
    { to: (h) => h.price + 62, until: [11, "09:40"], vol: 0.8 },
    { to: (h) => h.price - 5, until: [11, "09:47"], vol: 1.4 },
    { to: (h) => h.price + 34, until: [11, "09:56"], vol: 1.5 },
    { to: (h) => h.price - 58, until: [11, "10:08"], vol: 1.6 },
    { to: (h) => h.price + 156, until: [11, "10:52"], vol: 1.6 },
    { to: (h) => h.lo([11, "02:50"], [11, "09:15"]) - 40, until: [11, "11:35"], vol: 2.0 },
  ],
  anchorDay: 11,
  decision: [11, "09:50"],
  end: [11, "11:50"],
  checkpoints: { confirm: [11, "10:10"] },
  ideal: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bullish", 2);
    const supply = c.fvgIn("1H", "bearish", [11, "00:00"], [11, "03:00"]);
    return { expect: "target", order: { direction: "long", entry: (fvg.priceLow + fvg.priceHigh) / 2, stop: c.extremes([11, "09:25"], [11, "09:38"]).low - 6, target: supply.priceLow - 6, placedAt: c.revealedAfter([11, "09:49"]) } };
  },
  build: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bullish", 2);
    const sweep = c.extremes([11, "09:25"], [11, "09:38"]);
    const now = c.close([11, "09:49"]);
    const supply = c.fvgIn("1H", "bearish", [11, "00:00"], [11, "03:00"]);
    const room = supply.priceLow - now;
    const overnightLow = c.extremes([11, "02:50"], [11, "09:20"]);
    const pdl = c.extremes([10, "18:00"], [10, "16:59"]);

    return {
      title: "Under the supply",
      difficulty: 3,
      type: "conflicting_htf_ltf",
      instrument: "NQ (seeded)",
      skills: { htf_bias: 0.9, execution: 0.9, confluence: 0.8, liquidity: 0.6, entry_models: 0.6, market_structure: 0.4, concept_recognition: 0.2 },
      tags: ["htf-bias", "supply", "counter-trend", "target-selection", "multiple-valid"],
      prompt: "It is 09:50 ET. Read the chart and decide.",
      intro: {
        beginner: "A clean entry on the 5m, in a downtrend on the larger timeframes, with a clear area above price. Think about what each option would have to assume.",
        advanced: "09:50 ET.",
      },
      whyNot: [
        { label: "targeting beyond the supply", why: "The 1H gap above is exactly where a downtrend wants to sell. A long that aims through it is asking the trend to stop on a 5m signal." },
        { label: "shorting the supply from here", why: "Price is still a hundred points below it. Nothing has reached the area, and a short needs a sweep and displacement at it." },
      ],
      reference: {
        summary: "A valid 5m long in a Daily and 4H downtrend, with 1H supply about a hundred points above. Two defensible answers: stand aside, or take it with the target just under the supply and accept a lower reward. A target beyond the supply is the mistake.",
        biasTimeframe: "4H",
        bias: set("Lower highs and lower lows on the Daily and 4H. The bounce is inside the downtrend, up to supply.", { bearish: 1, neutral: 0.6 }),
        decision: set("Either is defensible: stand aside because the trade fights the trend, or take a counter-trend scalp to a clearly-bounded target. The first is lower risk; the second must be priced as what it is.", { no_trade: 1, long: 0.9, wait: 0.7, short: 0.1 }),
        answers: {
          take: set("A valid counter-trend scalp; a pass is also fine.", { skip: 1, take: 0.8 }),
          draw: set("The higher timeframe is drawn down. The long is a retrace to supply.", { sell_side: 1, unclear: 0.3 }),
        },
        annotations: [
          zone("supply", "fvg", "invalidating", "1H bearish FVG above price", supply, "Higher-timeframe supply. The ceiling on any long: a target belongs under it, not through it.", { candidate: true, decisionNote: "The room to the supply sets the reward and says what this trade is: a scalp inside a downtrend." }),
          zone("fvg-5m", "fvg", "key", "5m bullish FVG from the displacement", fvg, "A valid entry model if you take the long.", { candidate: true }),
          swingRef("sweep-low", "swing_low", "supporting", `Sweep low ${px(sweep.low)}`, { price: sweep.low, t: sweep.lowT }, "The invalidation for the long.", { priceTolerance: 10, timeTolerance: 20 }),
          line("overnight-low", "supporting", `Low of the overnight drop ${px(overnightLow.low)}`, overnightLow.low, "The liquidity swept at the open.", { priceTolerance: 14 }),
          line("pdl", "key", `Previous day low ${px(pdl.low)}`, pdl.low, "Where the higher timeframe is aimed.", { scope: "external", priceTolerance: 14 }),
        ],
        confluences: [
          confluence("htf", "strongest", "Daily and 4H trending down", "The trade is against this."),
          confluence("supply", "strongest", "1H supply a hundred points above", "The ceiling."),
          confluence("sweep", "supporting", "Sell-side liquidity swept", "Real; it makes the scalp valid."),
          confluence("displace", "supporting", "Displacement through the last 5m high", "The confirmation for the scalp."),
          confluence("trend", "misleading", "\"The 5m trend is up\"", "A 5m move inside a Daily downtrend is a retrace."),
        ],
        ranges: { expected_target: [band("just under the supply", supply.priceLow - 22, supply.priceLow - 2, 18, { ideal: supply.priceLow - 8 })] },
        dealingRange: null,
        trade: {
          direction: "long",
          entry: [band("the 5m FVG", fvg.priceLow, fvg.priceHigh, 8, { ideal: (fvg.priceLow + fvg.priceHigh) / 2 })],
          confirmedAtRevealed: c.revealedAtClose("5m", [11, "09:35"]),
          confirmationLabel: "the displacement that closed above the last 5m high",
          stop: { invalidation: sweep.low, buffer: 9 },
          targets: [band("just under the 1H supply", supply.priceLow - 22, supply.priceLow - 2, 18, { ideal: supply.priceLow - 8 })],
          minRR: 1.5,
        },
        lookFor: [
          "Name the ceiling before the entry. Here the room is about " + Math.round(room) + " points: a scalp, not a trend trade.",
          "A target under supply is a plan. A target through it is a hope.",
          "Both 'no trade' and 'scalp to the supply' are right here; what's not is pretending it's a trend trade.",
        ],
      },
      trapMistakes: { long: ["IGNORED_OPPOSING_HTF"] },
    };
  },
};
