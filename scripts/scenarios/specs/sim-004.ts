import { band, confluence, line, locate, px, set, swingRef, sweepSkeleton, zone, type ScenarioSpec } from "../lib";

// Failed setup. Everything about the long is right, and it stops out anyway:
// a normal failed setup. The process scores high; the result is -1R.
export const sim004: ScenarioSpec = {
  id: "sim-004",
  seed: 4410,
  calendar: { start: [2030, 4, 1], days: 13 },
  startPrice: 18200,
  backdrop: { kind: "uptrend", days: 11, amp: 175 },
  legs: sweepSkeleton({
    day: 11,
    sign: 1,
    overnight: 100,
    approach: 42,
    sweepAt: "09:32",
    displace: 58,
    retrace: 44,
    end: (h) => h.price,
    endAt: "10:40",
    finish: [
      { to: (h) => h.price + 14, until: [11, "10:12"], vol: 1.3 },
      { to: (h) => h.lo([11, "18:00"], [11, "09:15"]) - 34, until: [11, "10:42"], vol: 1.9 },
      { to: (h) => h.price + 10, until: [11, "11:20"], vol: 1.5 },
    ],
  }),
  anchorDay: 11,
  decision: [11, "09:48"],
  end: [11, "11:40"],
  checkpoints: { confirm: [11, "10:08"] },
  ideal: (c) => ({
    expect: "stop",
    order: { direction: "long", entry: c.fvg("5m", [11, "09:30"], "bullish", 2).priceHigh - 4, stop: c.extremes([11, "09:23"], [11, "09:36"]).low - 6, target: c.extremes([10, "18:00"], [10, "16:59"]).high - 2, placedAt: c.revealedAfter([11, "09:47"]) },
  }),
  build: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bullish", 2);
    const ob = c.candle("5m", [11, "09:25"]);
    const sweep = c.extremes([11, "09:23"], [11, "09:36"]);
    const overnight = c.extremes([11, "18:00"], [11, "09:18"]);
    const pdh = c.extremes([10, "18:00"], [10, "16:59"]);
    const dayRange = pdh;
    const where = locate(c.close([11, "09:47"]), { high: dayRange.high, low: dayRange.low });

    return {
      title: "Right, and it still lost",
      difficulty: 2,
      type: "failed_setup",
      instrument: "NQ (seeded)",
      skills: { execution: 0.9, entry_models: 0.8, confluence: 0.7, liquidity: 0.7, htf_bias: 0.5, market_structure: 0.4, concept_recognition: 0.2 },
      tags: ["sweep", "displacement", "fvg", "failed-setup", "process"],
      prompt: "It is 09:48 ET. Read the chart and decide.",
      intro: {
        beginner: "Another trending day. Read it the way you would any other. Some well-made trades lose, and what you're scored on is how you made it.",
        advanced: "09:48 ET. Read it and decide. The result is not the question.",
      },
      whyNot: [
        { label: "skipping it because it can fail", why: "Every setup can fail. This one had liquidity taken, displacement, a defined entry and a draw. Passing on it because the outcome is uncertain is what a process is for." },
        { label: "treating the loss as a flaw in the read", why: "The stop sat where the idea was proven wrong, and price proved it wrong. That's the system working as designed: a -1R loss on a sound setup." },
      ],
      reference: {
        summary: "A valid long (sweep, displacement, retrace into the gap, previous day high as the draw) that fails after entry. The stop sits where the idea is invalidated and takes the loss: -1R on a trade made correctly.",
        biasTimeframe: "4H",
        bias: set("Higher highs and higher lows on the Daily and 4H; the overnight dip was a pullback in that trend.", { bullish: 1, neutral: 0.4 }),
        decision: set("Every ingredient of a valid long is present. Taking it is correct whatever happens next; waiting for the retrace is equally sound.", { long: 1, wait: 0.75, no_trade: 0.2 }),
        answers: {
          take: set("The setup is valid. It can still lose.", { take: 1, skip: 0.3 }),
          draw: set("The previous day high is the pool above.", { buy_side: 1, unclear: 0.3 }),
          location: set("Against yesterday's range price is already past equilibrium after the open; the discount was the overnight dip.", { [where]: 1, equilibrium: where === "premium" ? 0.3 : 0 }),
        },
        annotations: [
          line("overnight-low", "key", `Overnight low ${px(overnight.low)}`, overnight.low, "Sell-side liquidity, swept at the open.", { priceTolerance: 14 }),
          line("pdh", "key", `Previous day high ${px(pdh.high)}`, pdh.high, "The pool above and the draw.", { scope: "external", priceTolerance: 14 }),
          swingRef("sweep-low", "swing_low", "supporting", `Sweep low ${px(sweep.low)}`, { price: sweep.low, t: sweep.lowT }, "The extreme of the sweep, and the invalidation: price trading below it proves the idea wrong.", { priceTolerance: 10, timeTolerance: 20 }),
          zone("fvg-5m", "fvg", "key", "5m bullish FVG from the displacement", fvg, "The displacement left a gap and closed through the last 5m high: the entry model.", { group: "poi", candidate: true }),
          zone("ob-5m", "ob", "valid", "5m order block under the gap", ob, "The last down candle before the displacement; an acceptable alternative area.", { group: "poi", candidate: true }),
        ],
        confluences: [
          confluence("sweep", "strongest", "Sell-side liquidity (overnight low) swept", "Liquidity taken."),
          confluence("displace", "strongest", "Displacement closing above the last 5m high", "The shift in structure."),
          confluence("fvg", "supporting", "Entry area is the displacement's FVG", "A defined area with a close stop."),
          confluence("htf", "supporting", "Daily and 4H trending up", "With the higher timeframe."),
          confluence("outcome", "misleading", "\"It will probably work out\"", "A hope is not a confluence. The decision rests on what's on the chart."),
        ],
        ranges: { expected_target: [band("previous day high", pdh.high - 8, pdh.high + 8, 25, { ideal: pdh.high })] },
        dealingRange: { high: dayRange.high, low: dayRange.low, tf: "1D" },
        trade: {
          direction: "long",
          entry: [band("the 5m FVG", fvg.priceLow, fvg.priceHigh, 8, { ideal: (fvg.priceLow + fvg.priceHigh) / 2 }), band("the order block under it", ob.priceLow, ob.priceHigh, 6, { credit: 0.9 })],
          confirmedAtRevealed: c.revealedAtClose("5m", [11, "09:30"]),
          confirmationLabel: "the displacement that closed above the last 5m high",
          stop: { invalidation: sweep.low, buffer: 9 },
          targets: [band("previous day high", pdh.high - 8, pdh.high + 8, 25, { ideal: pdh.high })],
          minRR: 2,
        },
        lookFor: [
          "A losing trade with the right bias, liquidity read and entry is a normal failed setup. Don't change a sound process because of one result.",
          "The stop is the cost of finding out. Place it where the idea is wrong, and accept the loss when price shows it.",
        ],
      },
      trapMistakes: { short: ["AGAINST_HTF_BIAS"] },
    };
  },
};
