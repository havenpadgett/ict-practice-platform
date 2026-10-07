import { band, confluence, line, px, set, swingRef, zone, type ScenarioSpec } from "../lib";

// Good location, no confirmation yet. Price sweeps the low into a 1H gap in
// discount and then does nothing. Buying the sweep is early; confirmation
// arrives half an hour later, and that is the trade.
export const sim012: ScenarioSpec = {
  id: "sim-012",
  seed: 12299,
  calendar: { start: [2030, 12, 2], days: 13 },
  startPrice: 18900,
  backdrop: { kind: "uptrend", days: 11, amp: 175 },
  legs: [
    { to: (h) => h.price - 170, until: [11, "03:00"], vol: 1.4 },
    { to: (h) => h.price + 20, until: [11, "07:30"], vol: 1.4 },
    { to: (h) => h.price - 45, until: [11, "09:15"], vol: 1.6 },
    { to: (h) => h.lo([11, "18:00"], [11, "09:15"]) - 14, until: [11, "09:34"], vol: 2 },
    // Stalls on the low: no displacement, no structure.
    { to: (h) => h.price + 12, until: [11, "10:19"], vol: 1.0, maxDev: 14 },
    // The displacement arrives.
    { to: (h) => h.price + 66, until: [11, "10:25"], vol: 0.8 },
    { to: (h) => h.price - 5, until: [11, "10:32"], vol: 1.4 },
    { to: (h) => h.price + 36, until: [11, "10:41"], vol: 1.5 },
    { to: (h) => h.price - 54, until: [11, "10:56"], vol: 1.6 },
    { to: (h) => h.hi([10, "18:00"], [10, "16:59"]) + 8, until: [11, "11:55"], vol: 1.8 },
  ],
  anchorDay: 11,
  decision: [11, "09:55"],
  end: [11, "12:15"],
  checkpoints: { confirm: [11, "10:57"] },
  ideal: (c) => {
    const fvg = c.fvg("5m", [11, "10:20"], "bullish", 2);
    return { expect: "target", order: { direction: "long", entry: (fvg.priceHigh + fvg.priceLow) / 2 + 4, stop: c.extremes([11, "09:25"], [11, "09:38"]).low - 6, target: c.extremes([10, "18:00"], [10, "16:59"]).high - 2, placedAt: c.revealedAfter([11, "10:42"]) } };
  },
  build: (c) => {
    const fvg = c.fvg("5m", [11, "10:20"], "bullish", 2);
    const ob = c.candle("5m", [11, "10:15"]);
    const sweep = c.extremes([11, "09:25"], [11, "09:38"]);
    const overnight = c.extremes([11, "18:00"], [11, "09:20"]);
    const pdh = c.extremes([10, "18:00"], [10, "16:59"]);
    const hourGap = c.fvgAt("1H", sweep.low, "bullish");

    return {
      title: "In the right place, too early",
      difficulty: 2,
      type: "good_location_no_confirmation",
      instrument: "NQ (seeded)",
      skills: { confluence: 0.95, execution: 0.8, entry_models: 0.7, liquidity: 0.6, htf_bias: 0.5, market_structure: 0.6, concept_recognition: 0.2 },
      tags: ["confirmation", "patience", "sweep", "htf-fvg", "wait"],
      prompt: "It is 09:55 ET. Read the chart and decide.",
      intro: {
        beginner: "Price has dropped into a higher-timeframe area and swept a low. Ask what has actually changed on the chart since it got there.",
        advanced: "09:55 ET. Location is there. Is anything else?",
      },
      whyNot: [
        { label: "buying the sweep", why: "The location is right and nothing has confirmed. The sweep only says there is liquidity taken; a break of structure with displacement says price has turned. Entering now is buying the idea before it has happened, with the same stop and a worse chance." },
        { label: "giving up on it", why: "No confirmation yet isn't no trade. Location this good tends to produce confirmation; passing entirely loses a valid setup that appears half an hour later." },
      ],
      reference: {
        summary: "Price swept the low into a 1H gap in discount and then stalled. Location is excellent and there's no confirmation: no displacement, no break of structure. The trade appears later, when displacement arrives and price retraces into its gap.",
        biasTimeframe: "4H",
        bias: set("Higher highs and higher lows on the Daily and 4H; price is pulling back into a 1H gap inside that trend.", { bullish: 1, neutral: 0.5 }),
        decision: set("Right location, no confirmation: wait. Passing outright gives up the real entry that follows; buying now is early.", { wait: 1, no_trade: 0.5, long: 0.3 }),
        answers: {
          take: set("Not yet. The confirmation is the missing piece.", { skip: 1, take: 0.25 }),
          draw: set("The previous day high is the pool above.", { buy_side: 1, unclear: 0.3 }),
        },
        annotations: [
          zone("fvg-1h", "fvg", "supporting", "1H bullish FVG the sweep ran into", hourGap, "Higher-timeframe support under the low: why the location is good.", { candidate: true }),
          line("overnight-low", "key", `Overnight low ${px(overnight.low)}`, overnight.low, "The sell-side liquidity swept at the open.", { priceTolerance: 14 }),
          swingRef("sweep-low", "swing_low", "supporting", `Sweep low ${px(sweep.low)}`, { price: sweep.low, t: sweep.lowT }, "The invalidation, and where price has been sitting since.", { priceTolerance: 10, timeTolerance: 20 }),
          line("pdh", "key", `Previous day high ${px(pdh.high)}`, pdh.high, "The draw.", { scope: "external", priceTolerance: 14 }),
          zone("fvg-5m", "fvg", "key", "5m bullish FVG, once displacement arrives", fvg, "Doesn't exist at 09:55. It's the gap left by the displacement at 10:20: the entry model, and the confirmation that comes with it.", { group: "poi", visibleAtRevealed: c.revealedAtClose("5m", [11, "10:25"]), candidate: false }),
          zone("ob-5m", "ob", "valid", "5m order block under that gap", ob, "The alternative area, once displacement has printed.", { group: "poi", visibleAtRevealed: c.revealedAtClose("5m", [11, "10:25"]) }),
        ],
        confluences: [
          confluence("sweep", "strongest", "Sell-side liquidity swept", "There's liquidity taken."),
          confluence("htf", "strongest", "Sweep ran into a 1H FVG in discount", "The location is right."),
          confluence("confirm", "strongest", "A displacement and break of the last 5m high", "Not there yet. This is what's missing."),
          confluence("trend", "supporting", "Daily and 4H trending up", "With the higher timeframe."),
          confluence("pdh", "irrelevant", "Previous day high above", "A target means nothing without an entry."),
          confluence("hold", "misleading", "Price has held the low for 20 minutes", "Holding isn't turning."),
        ],
        ranges: { expected_target: [band("previous day high", pdh.high - 8, pdh.high + 8, 25, { ideal: pdh.high })] },
        dealingRange: null,
        trade: {
          direction: "long",
          entry: [band("the 5m FVG (after displacement)", fvg.priceLow, fvg.priceHigh, 8, { ideal: (fvg.priceLow + fvg.priceHigh) / 2 }), band("the order block under it", ob.priceLow, ob.priceHigh, 6, { credit: 0.9 })],
          confirmedAtRevealed: c.revealedAtClose("5m", [11, "10:20"]),
          confirmationLabel: "the 10:20 displacement that closed above the last 5m high",
          stop: { invalidation: sweep.low, buffer: 9 },
          targets: [band("previous day high", pdh.high - 8, pdh.high + 8, 25, { ideal: pdh.high })],
          minRR: 2,
        },
        lookFor: [
          "Location without confirmation is a candidate. Name what you're waiting for, and wait for it.",
          "Holding a low isn't the same as turning from it.",
          "Waiting is a decision. The entry that follows is usually better than the early one.",
        ],
      },
      trapMistakes: { long: ["PREMATURE_ENTRY"] },
    };
  },
};
