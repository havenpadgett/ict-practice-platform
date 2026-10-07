import { band, confluence, line, px, set, swingRef, sweepSkeleton, zone, type ScenarioSpec } from "../lib";

// Valid short in the afternoon. The day's high is swept at 13:34, price
// displaces down through the last 5m low and retraces into the gap. Target:
// the session low. Outside the NY AM window, so no shading helps here.
export const sim013: ScenarioSpec = {
  id: "sim-013",
  seed: 13300,
  calendar: { start: [2031, 1, 7], days: 13 },
  startPrice: 22200,
  backdrop: { kind: "downtrend", days: 11, amp: 190 },
  legs: sweepSkeleton({
    day: 11,
    sign: -1,
    overnight: 120,
    bounce: 10,
    approach: 40,
    sweepAt: "13:34",
    displace: 62,
    retrace: 64,
    end: (h) => h.lo([11, "18:00"], [11, "13:15"]) + 24,
    endAt: "15:20",
  }),
  anchorDay: 11,
  decision: [11, "13:50"],
  end: [11, "15:50"],
  checkpoints: { confirm: [11, "14:14"] },
  ideal: (c) => {
    const fvg = c.fvg("5m", [11, "13:30"], "bearish", 2);
    return { expect: "target", order: { direction: "short", entry: (fvg.priceLow + fvg.priceHigh) / 2, stop: c.extremes([11, "13:25"], [11, "13:38"]).high + 6, target: c.extremes([11, "18:00"], [11, "13:15"]).low + 26, placedAt: c.revealedAfter([11, "13:49"]) } };
  },
  build: (c) => {
    const fvg = c.fvg("5m", [11, "13:30"], "bearish", 2);
    const ob = c.candle("5m", [11, "13:25"]);
    const sweep = c.extremes([11, "13:25"], [11, "13:38"]);
    const dayHigh = c.extremes([11, "18:00"], [11, "13:20"]);
    const dayLow = c.extremes([11, "18:00"], [11, "13:15"]);
    const hourGap = c.fvgAt("1H", sweep.high, "bearish");
    const bullGap = c.fvgIn("5m", "bullish", [11, "13:50"], [11, "14:15"]);

    return {
      title: "The afternoon sweep",
      difficulty: 2,
      type: "valid_setup",
      instrument: "NQ (seeded)",
      skills: { liquidity: 0.9, entry_models: 0.8, confluence: 0.7, htf_bias: 0.6, execution: 0.6, market_structure: 0.5, concept_recognition: 0.3 },
      tags: ["sweep", "displacement", "fvg", "session-high", "short", "pm-session"],
      prompt: "It is 13:50 ET. Read the chart and decide.",
      intro: {
        beginner: "The same ideas apply outside the morning. Look at what price has taken by this point in the day, and what it did next.",
        advanced: "13:50 ET. Afternoon. Mark what matters and decide.",
      },
      whyNot: [
        { label: "the bullish gap in the pullback", why: "It formed in the retrace, against the move down. A pullback is not a long." },
        { label: "selling at market", why: "The edge is in the gap the displacement left. Selling after the move pays for it and puts the stop a leg away." },
      ],
      reference: {
        summary: "The day's high is swept in the afternoon, price displaces down through the last 5m low and retraces into the gap it left. The draw is the session low. Same model as the morning, in a different window.",
        biasTimeframe: "4H",
        bias: set("Lower highs and lower lows on the Daily and 4H; the session's rally was a retrace inside that downtrend.", { bearish: 1, neutral: 0.4 }),
        decision: set("A sweep of the day's high, displacement and a retrace into the gap: a valid short, with a clear draw. Waiting for the retrace is equally sound.", { short: 1, wait: 0.75, no_trade: 0.1 }),
        answers: {
          take: set("Sweep, displacement, a defined entry and a draw.", { take: 1, skip: 0.3 }),
          draw: set("The session low, a long way below, is the pool.", { sell_side: 1, unclear: 0.3 }),
        },
        annotations: [
          line("day-high", "key", `Session high ${px(dayHigh.high)}`, dayHigh.high, "Obvious buy-side liquidity, swept at 13:34.", { scope: "internal", priceTolerance: 14 }),
          line("day-low", "key", `Session low ${px(dayLow.low)}`, dayLow.low, "The pool below and the draw: it's where the move is aimed.", { scope: "external", priceTolerance: 14 }),
          swingRef("sweep-high", "swing_high", "supporting", `Sweep high ${px(sweep.high)}`, { price: sweep.high, t: sweep.highT }, "The invalidation.", { priceTolerance: 10, timeTolerance: 20 }),
          zone("fvg-5m", "fvg", "key", "5m bearish FVG from the displacement", fvg, "The entry model.", { group: "poi", candidate: true }),
          zone("ob-5m", "ob", "valid", "5m order block above the gap", ob, "The alternative area.", { group: "poi", candidate: true }),
          zone("fvg-1h", "fvg", "supporting", "1H bearish FVG the sweep ran into", hourGap, "Higher-timeframe resistance over the high.", { candidate: true }),
          zone("bull-gap", "fvg", "trap", "5m bullish FVG in the pullback", bullGap, "Against the move: it's the retrace.", { candidate: true, whyNot: "A gap against displacement is the pullback, not a setup." }),
        ],
        confluences: [
          confluence("sweep", "strongest", "The day's high swept", "Liquidity taken."),
          confluence("displace", "strongest", "Displacement below the last 5m low", "The confirmation."),
          confluence("fvg", "supporting", "Entry from the displacement gap", "A defined area."),
          confluence("htf", "supporting", "Daily and 4H trending down", "With the higher timeframe."),
          confluence("pm", "irrelevant", "It's the afternoon, not the open", "The model doesn't care about the window."),
          confluence("bull", "irrelevant", "Bullish gap in the pullback", "It's the retrace."),
        ],
        ranges: { expected_target: [band("session low", dayLow.low - 6, dayLow.low + 30, 40, { ideal: dayLow.low + 12 })] },
        dealingRange: null,
        trade: {
          direction: "short",
          entry: [band("the 5m FVG", fvg.priceLow, fvg.priceHigh, 8, { ideal: (fvg.priceLow + fvg.priceHigh) / 2 }), band("the order block above it", ob.priceLow, ob.priceHigh, 6, { credit: 0.9 })],
          confirmedAtRevealed: c.revealedAtClose("5m", [11, "13:35"]),
          confirmationLabel: "the displacement that closed below the last 5m low",
          stop: { invalidation: sweep.high, buffer: 9 },
          targets: [band("the session low", dayLow.low - 6, dayLow.low + 30, 40, { ideal: dayLow.low + 12 })],
          minRR: 2,
        },
        lookFor: [
          "The same sequence works in any session: liquidity taken, displacement, retrace into the gap.",
          "Know which high or low you're calling liquidity: the session's, not just the last bounce.",
        ],
      },
      trapMistakes: { long: ["AGAINST_HTF_BIAS"] },
    };
  },
};
