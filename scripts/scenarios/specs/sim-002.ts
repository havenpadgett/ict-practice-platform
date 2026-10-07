import { band, confluence, line, locate, px, set, swingRef, sweepSkeleton, zone, type ScenarioSpec } from "../lib";

// Valid short. HTF downtrend, an overnight rally into a 1H gap, a sweep of the
// overnight high at the open, displacement down through the last 5m low, and
// a retrace into the gap it left. Target: previous day low.
export const sim002: ScenarioSpec = {
  id: "sim-002",
  seed: 2207,
  calendar: { start: [2030, 3, 4], days: 13 },
  startPrice: 23400,
  backdrop: { kind: "downtrend", days: 11, amp: 200 },
  legs: sweepSkeleton({
    day: 11,
    sign: -1,
    overnight: 115,
    approach: 50,
    displace: 66,
    retrace: 52,
    end: (h) => h.lo([10, "18:00"], [10, "16:59"]) - 8,
    endAt: "10:58",
  }),
  anchorDay: 11,
  decision: [11, "09:50"],
  end: [11, "11:30"],
  checkpoints: { confirm: [11, "10:14"] },
  ideal: (c) => ({
    expect: "target",
    order: { direction: "short", entry: c.fvg("5m", [11, "09:30"], "bearish", 2).priceLow + 4, stop: c.extremes([11, "09:25"], [11, "09:38"]).high + 6, target: c.extremes([10, "18:00"], [10, "16:59"]).low + 2, placedAt: c.revealedAfter([11, "09:49"]) },
  }),
  build: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bearish", 2);
    const ob = c.candle("5m", [11, "09:25"]);
    const sweep = c.extremes([11, "09:25"], [11, "09:38"]);
    const overnight = c.extremes([11, "18:00"], [11, "09:20"]);
    const pdl = c.extremes([10, "18:00"], [10, "16:59"]);
    const dayRange = pdl;
    const londonLow = c.extremes([11, "18:00"], [11, "03:00"]);
    const hourGap = c.fvgAt("1H", sweep.high, "bearish");
    const bullGap = c.fvg("5m", [11, "09:50"], "bullish", 3);
    const where = locate(c.close([11, "09:49"]), { high: dayRange.high, low: dayRange.low });

    return {
      title: "Buy-side swept, short from the gap",
      difficulty: 2,
      type: "valid_setup",
      instrument: "NQ (seeded)",
      skills: { htf_bias: 0.6, liquidity: 0.9, entry_models: 0.9, confluence: 0.7, execution: 0.6, market_structure: 0.5, concept_recognition: 0.3 },
      tags: ["sweep", "displacement", "fvg", "mss", "pdl-draw", "short"],
      prompt: "It is 09:50 ET. Read the chart and decide.",
      intro: {
        beginner: "The Daily and 4H have been trending down. Use them for bias, then look at the 5m for a way in once price has done something at the open.",
        advanced: "09:50 ET. Mark what matters and decide.",
      },
      whyNot: [
        { label: "the bullish 5m gap at 09:55", why: "It formed inside the pullback, against the move down. A gap in the opposite direction after a sweep and displacement is the retrace itself, not a setup to buy." },
        { label: "selling at market now", why: "Price has already left the entry area. The edge was in the gap the displacement left, well above where price is now." },
      ],
      reference: {
        summary: "Bearish higher timeframes, buy-side liquidity swept at the open, displacement through the last 5m low, and a retrace into the gap it left, with the previous day low as the draw.",
        biasTimeframe: "4H",
        bias: set("The Daily and 4H are making lower highs and lower lows, and the overnight rally into a 1H gap was a pullback inside that trend.", { bearish: 1, neutral: 0.4 }, { neutral: "A rally can look like a reversal, but nothing broke the downtrend" }),
        decision: set("A sweep, displacement and a defined entry area with a clear draw is a valid short. Waiting for the retrace into the gap is just as sound; selling at market after the move is not.", { short: 1, wait: 0.75, no_trade: 0.1 }),
        answers: {
          draw: set("The previous day low is the obvious pool below, and the displacement points straight at it.", { sell_side: 1, unclear: 0.3 }),
          take: set("Liquidity taken, displacement, a defined entry and a draw.", { take: 1, skip: 0.3 }),
          location: set("Price is in the premium of yesterday's range after the overnight rally: where a bearish idea wants to sell from.", { [where]: 1, equilibrium: where === "premium" ? 0.3 : 0 }),
        },
        annotations: [
          line("overnight-high", "key", `Overnight high ${px(overnight.high)}`, overnight.high, "Obvious buy-side liquidity, and exactly where the open swept it.", { priceTolerance: 14, decisionNote: "The sweep is the trigger. Without it this is just a short in a trend." }),
          line("pdl", "key", `Previous day low ${px(pdl.low)}`, pdl.low, "The pool below and the draw: sell stops resting under yesterday's low.", { scope: "external", priceTolerance: 14, decisionNote: "Sets the target, and with the entry sets whether the trade clears 2R." }),
          swingRef("sweep-high", "swing_high", "supporting", `Sweep high ${px(sweep.high)}`, { price: sweep.high, t: sweep.highT }, "The extreme of the sweep. If price takes it out the idea is wrong, which makes it the stop reference.", { priceTolerance: 10, timeTolerance: 20 }),
          zone("fvg-5m", "fvg", "key", "5m bearish FVG from the displacement", fvg, "The displacement candle left a gap and closed below the last 5m low. A retrace into it is the entry model.", { group: "poi", candidate: true, decisionNote: "The edge is in the retrace: a better price and a shorter stop than anything after the move." }),
          zone("ob-5m", "ob", "valid", "5m order block above the gap", ob, "The last up candle before the displacement. An acceptable alternative area, sitting above the gap.", { group: "poi", candidate: true }),
          zone("fvg-1h", "fvg", "supporting", "1H bearish FVG the sweep ran into", hourGap, "The sweep took the high inside a 1H gap: higher-timeframe resistance over the whole idea.", { candidate: true }),
          zone("bull-gap", "fvg", "trap", "5m bullish FVG at 09:55", bullGap, "A gap against the move, left by the retrace. It looks like a long and is just the pullback.", { candidate: true, whyNot: "A gap that forms against displacement is a retrace, not a reason to trade it." }),
          line("london-low", "irrelevant", `London low ${px(londonLow.low)}`, londonLow.low, "Real, but sits far below and nothing here depends on it.", { priceTolerance: 14, candidate: true }),
        ],
        confluences: [
          confluence("sweep", "strongest", "Buy-side liquidity (overnight high) swept", "Liquidity taken is the reason there was something to sell."),
          confluence("displace", "strongest", "Displacement closing below the last 5m low", "Structure shifted after the sweep; that is the confirmation."),
          confluence("fvg", "supporting", "Entry area is the displacement's FVG", "A defined area to sell with a close stop."),
          confluence("htf", "supporting", "Daily and 4H trending down", "The trade goes with the higher timeframe."),
          confluence("h1gap", "supporting", "Sweep ran into a 1H bearish FVG", "Higher-timeframe resistance over the sweep."),
          confluence("bull", "irrelevant", "Bullish 5m FVG at 09:55", "A pullback gap against the move; it changes nothing."),
          confluence("london", "irrelevant", "London low far below", "Real, but not the draw."),
          confluence("round", "misleading", "A round number just under price", "A round number is not a reason to buy or sell."),
        ],
        ranges: { expected_target: [band("previous day low", pdl.low - 8, pdl.low + 8, 25, { ideal: pdl.low })] },
        dealingRange: { high: dayRange.high, low: dayRange.low, tf: "1D" },
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
          "Liquidity taken, then displacement through a recent swing: in that order, on either side of the market.",
          "Short from the gap the displacement left, not from a market order after the move.",
          "Name the draw before you enter: here, the previous day low.",
        ],
      },
      trapMistakes: { long: ["AGAINST_HTF_BIAS"] },
    };
  },
};
