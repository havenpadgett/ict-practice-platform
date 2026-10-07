import { band, confluence, line, locate, px, set, swingRef, sweepSkeleton, zone, type ScenarioSpec } from "../lib";

// Advanced good-structure-bad-location, short side. A textbook sell setup in a
// downtrend, but price has already fallen to within a few points of the
// previous day low and a 1H bullish gap. Selling the low.
export const sim023: ScenarioSpec = {
  id: "sim-023",
  seed: 23299,
  calendar: { start: [2031, 11, 3], days: 13 },
  startPrice: 21600,
  backdrop: { kind: "downtrend", days: 11, amp: 205 },
  legs: sweepSkeleton({
    day: 11,
    sign: -1,
    overnight: 56,
    bounce: 10,
    approach: 14,
    displace: 40,
    push: 52,
    retrace: 22,
    end: (h) => h.price,
    endAt: "10:30",
    finish: [
      { to: (h) => h.lo([10, "18:00"], [10, "16:59"]) - 10, until: [11, "10:24"], vol: 1.4 },
      { to: (h) => h.hi([11, "18:00"], [11, "09:15"]) + 36, until: [11, "11:12"], vol: 2.0 },
    ],
  }),
  anchorDay: 11,
  decision: [11, "09:58"],
  end: [11, "11:40"],
  build: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bearish", 2);
    const ob = c.candle("5m", [11, "09:25"]);
    const sweep = c.extremes([11, "09:25"], [11, "09:38"]);
    const pdl = c.extremes([10, "18:00"], [10, "16:59"]);
    const now = c.close([11, "09:57"]);
    const room = now - pdl.low;
    if (room > 48) throw new Error(`there's ${room.toFixed(0)} points to the previous day low: not a bad location`);
    if (sweep.high - now < room * 2) throw new Error("the stop distance isn't large against the room");
    const where = locate(now, { high: pdl.high, low: pdl.low });
    const support = c.fvgAt("1H", pdl.low + 8, "bullish", 40);

    return {
      title: "Selling the low",
      difficulty: 3,
      type: "good_structure_bad_location",
      instrument: "NQ (seeded)",
      skills: { htf_bias: 0.8, liquidity: 0.8, confluence: 0.8, execution: 0.8, entry_models: 0.5, market_structure: 0.4, concept_recognition: 0.2 },
      tags: ["location", "room-to-draw", "discount", "pdl", "short"],
      prompt: "It is 09:58 ET. Read the chart and decide.",
      intro: {
        beginner: "A clean sell setup in a downtrend. Check how much room price has left before the next pool, and what is just underneath.",
        advanced: "09:58 ET.",
      },
      whyNot: [
        { label: "selling the 5m setup", why: "The bias is right and the model is right, and price is already inside a few points of the previous day low, sitting on 1H support. The stop has to be above the sweep high, dozens of points up, for a few points of reward." },
        { label: "buying the support", why: "Nothing has swept the low and shifted structure up. Support is a reason not to sell, not a reason to buy." },
      ],
      reference: {
        summary: "A clean sweep, displacement and gap to the downside, in a downtrend, with price already beside the previous day low and a bullish 1H gap under it. The pattern is right and the room isn't. Stand aside, or wait for a retrace into premium.",
        biasTimeframe: "4H",
        bias: set("Lower highs and lower lows on the Daily and 4H: the trend is down and price is already at the bottom of what it has built.", { bearish: 1, neutral: 0.6 }),
        decision: set("There's no room. The trend is a reason to wait for a bounce into premium, not to sell the low.", { no_trade: 1, wait: 0.85, short: 0.15 }),
        answers: {
          take: set("The model is valid and the location isn't.", { skip: 1, take: 0.15 }),
          draw: set("The previous day low is the draw, and price is nearly at it.", { sell_side: 1, unclear: 0.3 }),
          location: set("Price is at the bottom of yesterday's range: discount, where shorts are weakest.", { [where]: 1, equilibrium: where === "discount" ? 0.2 : 0 }),
        },
        annotations: [
          line("pdl", "invalidating", `Previous day low ${px(pdl.low)}`, pdl.low, "The pool below and the problem: price is already beside it, so a short has almost no reward against a full stop above the sweep.", { scope: "external", priceTolerance: 14, candidate: true, decisionNote: "Reward is the distance to the draw. A few points, against a stop dozens above." }),
          zone("support", "fvg", "invalidating", "1H bullish FVG under the low", support, "Higher-timeframe support right at the draw. Another reason the room isn't what it looks like.", { candidate: true }),
          zone("fvg-5m", "fvg", "trap", "5m bearish FVG from the displacement", fvg, "A clean entry model with nowhere to go.", { candidate: true, whyNot: "A good entry doesn't make a good trade. Room comes first." }),
          zone("ob-5m", "ob", "trap", "5m order block above the gap", ob, "Same story.", { candidate: true }),
          swingRef("sweep-high", "swing_high", "irrelevant", `Sweep high ${px(sweep.high)}`, { price: sweep.high, t: sweep.highT }, "Real, and it puts the stop far above the entry.", { priceTolerance: 10, timeTolerance: 20, candidate: true }),
        ],
        confluences: [
          confluence("room", "strongest", "Price is within a few points of the previous day low", "No room to the draw."),
          confluence("support", "strongest", "A 1H bullish gap just underneath", "Support at the target."),
          confluence("location", "strongest", "Price is at the bottom of the Daily range", "Discount: a short's weakest location."),
          confluence("sweep", "misleading", "Buy-side liquidity swept", "True, and small relative to how far price has fallen."),
          confluence("displace", "misleading", "Displacement with an FVG", "A textbook entry into no reward."),
          confluence("htf", "supporting", "Daily and 4H trending down", "A reason to wait for premium, not to sell here."),
        ],
        ranges: { expected_target: [band("previous day low", pdl.low - 8, pdl.low + 8, 25, { ideal: pdl.low })] },
        dealingRange: { high: pdl.high, low: pdl.low, tf: "1D" },
        trade: null,
        lookFor: [
          "Measure the room before the entry. In a downtrend, the best shorts are made from premium.",
          "Support right at the target is part of the room: it shortens it.",
        ],
      },
      trapMistakes: { short: ["IGNORED_OPPOSING_HTF"] },
    };
  },
};
