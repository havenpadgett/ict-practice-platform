import { band, confluence, line, locate, px, set, swingRef, zone, type ScenarioSpec } from "../lib";

// Valid setup. HTF uptrend, an overnight pullback into a 1H gap, a sweep of
// the overnight low at the open, displacement that closes through the last
// 5m high, and a retrace into the displacement's FVG. Target: previous day high.
export const sim001: ScenarioSpec = {
  id: "sim-001",
  seed: 1101,
  calendar: { start: [2030, 1, 7], days: 13 },
  startPrice: 20000,
  backdrop: { kind: "uptrend", days: 11 },
  legs: [
    { to: (h) => h.price - 110, until: [11, "03:00"], vol: 1.4 },
    { to: (h) => h.price + 20, until: [11, "07:30"], vol: 1.4 },
    { to: (h) => h.price - 45, until: [11, "09:15"], vol: 1.6 },
    { to: (h) => h.lo([11, "18:00"], [11, "09:15"]) - 14, until: [11, "09:34"], vol: 2 },
    { to: (h) => h.price + 62, until: [11, "09:40"], vol: 0.8 },
    { to: (h) => h.price - 5, until: [11, "09:47"], vol: 1.4 },
    { to: (h) => h.price + 34, until: [11, "09:56"], vol: 1.5 },
    { to: (h) => h.price - 64, until: [11, "10:08"], vol: 1.6 },
    { to: (h) => h.hi([10, "18:00"], [10, "16:59"]) + 8, until: [11, "10:55"], vol: 1.8 },
  ],
  anchorDay: 11,
  decision: [11, "09:50"],
  end: [11, "11:30"],
  checkpoints: { confirm: [11, "10:14"] },
  ideal: (c) => ({
    expect: "target",
    order: { direction: "long", entry: (c.fvg("5m", [11, "09:30"], "bullish", 2).priceHigh + c.fvg("5m", [11, "09:30"], "bullish", 2).priceLow) / 2, stop: c.extremes([11, "09:25"], [11, "09:38"]).low - 6, target: c.extremes([10, "18:00"], [10, "16:59"]).high - 2, placedAt: c.revealedAfter([11, "09:49"]) },
  }),
  build: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bullish", 2);
    const ob = c.candle("5m", [11, "09:25"]);
    const sweep = c.extremes([11, "09:25"], [11, "09:38"]);
    const overnight = c.extremes([11, "18:00"], [11, "09:20"]);
    const pdh = c.extremes([10, "18:00"], [10, "16:59"]);
    const oneHourGap = c.fvg("1H", [10, "10:00"], "bullish", 2);
    const bearGap = c.fvg("5m", [11, "09:50"], "bearish", 3);
    const asiaHigh = c.extremes([11, "18:00"], [11, "03:00"]);
    const noiseGap = c.fvg("5m", [11, "09:45"], "bullish", 1);
    const dayRange = c.extremes([10, "18:00"], [10, "16:59"]);
    const where = locate(c.close([11, "09:49"]), { high: dayRange.high, low: dayRange.low });

    return {
      title: "Sweep, displace, retrace",
      difficulty: 2,
      type: "valid_setup",
      instrument: "NQ (seeded)",
      skills: { htf_bias: 0.6, liquidity: 0.9, entry_models: 0.9, confluence: 0.7, execution: 0.6, market_structure: 0.5, concept_recognition: 0.3 },
      tags: ["sweep", "displacement", "fvg", "mss", "pdh-draw"],
      prompt: "It is 09:50 ET. Read the chart and decide.",
      intro: {
        beginner: "The Daily and 4H have been trending up. Use them for bias, then look at the 5m for a way in once price has done something at the open.",
        advanced: "09:50 ET. Mark what matters and decide.",
      },
      whyNot: [
        { label: "the bearish 5m gap at 09:55", why: "It formed inside the pullback, against the displacement. A gap in the opposite direction after a sweep and displacement is a retrace, not a signal." },
        { label: "buying at market now", why: "Price has already left the entry area. The edge was in the gap the displacement left, not 30 points above it." },
      ],
      reference: {
        summary: "Bullish higher timeframes, sell-side liquidity swept at the open, displacement through the last 5m high, and a retrace into the gap it left, with the previous day high as the draw.",
        biasTimeframe: "4H",
        bias: set("The Daily and 4H are making higher highs and higher lows, and the overnight dip into a 1H gap was a pullback inside that trend.", { bullish: 1, neutral: 0.4 }, { neutral: "A pullback can look like indecision, but nothing broke the trend" }),
        decision: set("A sweep, displacement and an entry area with a clear draw is a valid long. Waiting for price to return into the gap is just as sound; chasing it is not.", { long: 1, wait: 0.75, no_trade: 0.1 }),
        answers: {
          draw: set("The previous day high is the obvious pool above, and displacement points straight at it.", { buy_side: 1, unclear: 0.3 }),
          take: set("This has liquidity taken, displacement, a defined entry and a draw.", { take: 1, skip: 0.3 }),
          location: set(
            "Against yesterday's range price is in premium: the retrace into discount already happened overnight, and the open swept it. A premium reading with a bullish bias means expect a pullback before the draw, not a reason to flip.",
            { [where]: 1, equilibrium: where === "premium" ? 0.3 : 0 },
          ),
        },
        annotations: [
          line("overnight-low", "key", `Overnight low ${px(overnight.low)}`, overnight.low, "Obvious sell-side liquidity, and exactly where the open swept it.", { priceTolerance: 14, decisionNote: "The sweep is the trigger. Without it this is just a long in a trend." }),
          line("pdh", "key", `Previous day high ${px(pdh.high)}`, pdh.high, "The pool above and the draw: stops resting over yesterday's high.", { scope: "external", priceTolerance: 14, decisionNote: "Sets the target, and with the entry sets whether the trade clears 2R." }),
          swingRef("sweep-low", "swing_low", "supporting", `Sweep low ${px(sweep.low)}`, { price: sweep.low, t: sweep.lowT }, "The extreme of the sweep. If it breaks the idea is wrong, so this is the stop reference.", { priceTolerance: 10, timeTolerance: 20 }),
          zone("fvg-5m", "fvg", "key", "5m bullish FVG from the displacement", fvg, "The displacement candle left a gap and closed through the last 5m high. A retrace into it is the entry model.", { group: "poi", candidate: true, decisionNote: "The edge is in the retrace. A fill here is a better price and a shorter stop than anything after the move." }),
          zone("ob-5m", "ob", "valid", "5m order block under the gap", ob, "The last down candle before the displacement. An acceptable alternative area, sitting below the gap.", { group: "poi", candidate: true }),
          zone("fvg-1h", "fvg", "supporting", "1H bullish FVG the sweep ran into", oneHourGap, "The sweep took the low inside a 1H gap: higher-timeframe support under the whole idea."),
          zone("bear-gap", "fvg", "trap", "5m bearish FVG at 09:55", bearGap, "A gap against the move, left by the retrace. It looks like a setup and is just the pullback.", { candidate: true, whyNot: "A gap that forms against displacement is a retrace, not a reason to trade it." }),
          line("asia-high", "irrelevant", `Asia high ${px(asiaHigh.high)}`, asiaHigh.high, "Real, but the overnight range sat below it and nothing here depends on it.", { priceTolerance: 14, candidate: true }),
          zone("noise-gap", "fvg", "irrelevant", "Small 5m gap at 09:45", noiseGap, "A gap a fraction of the size of the displacement's. Real, and too small to be anything a trade rests on.", { candidate: true }),
        ],
        confluences: [
          confluence("sweep", "strongest", "Sell-side liquidity (overnight low) swept", "Liquidity taken is the reason there was something to buy."),
          confluence("displace", "strongest", "Displacement closing above the last 5m high", "Structure shifted after the sweep; that is the confirmation."),
          confluence("fvg", "supporting", "Entry area is the displacement's FVG", "A defined area to buy with a close stop."),
          confluence("htf", "supporting", "Daily and 4H trending up", "The trade goes with the higher timeframe."),
          confluence("h1gap", "supporting", "Sweep ran into a 1H FVG", "Higher-timeframe support under the sweep."),
          confluence("session", "supporting", "Inside the NY AM window", "Moves that start here have the volume to travel."),
          confluence("bear", "irrelevant", "Bearish 5m FVG at 09:55", "A pullback gap against the move; it changes nothing."),
          confluence("asia", "irrelevant", "Asia high above", "Real, but not the draw."),
          confluence("round", "misleading", "The 21,300 round number", "A round number is not a reason to buy or sell."),
        ],
        ranges: {
          expected_target: [band("previous day high", pdh.high - 8, pdh.high + 8, 25, { ideal: pdh.high })],
        },
        dealingRange: { high: dayRange.high, low: dayRange.low, tf: "1D" },
        trade: {
          direction: "long",
          entry: [
            band("the 5m FVG", fvg.priceLow, fvg.priceHigh, 8, { ideal: (fvg.priceLow + fvg.priceHigh) / 2 }),
            band("the order block under it", ob.priceLow, ob.priceHigh, 6, { credit: 0.9 }),
          ],
          confirmedAtRevealed: c.revealedAtClose("5m", [11, "09:35"]),
          confirmationLabel: "the displacement that closed above the last 5m high",
          stop: { invalidation: sweep.low, buffer: 9 },
          targets: [band("previous day high", pdh.high - 8, pdh.high + 8, 25, { ideal: pdh.high })],
          minRR: 2,
        },
        lookFor: [
          "Liquidity taken, then displacement that closes through a recent swing: in that order.",
          "Take the entry from the gap the displacement left, not from a market order after the move.",
          "Name the draw before you enter: here, the previous day high.",
        ],
      },
      trapMistakes: { short: ["AGAINST_HTF_BIAS"] },
    };
  },
};
