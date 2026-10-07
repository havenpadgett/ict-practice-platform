import { confluence, line, px, set, swingRef, zone, type ScenarioSpec } from "../lib";

// Advanced almost-valid. A clean displacement, a break of the last 5m high and
// a gap: all there, with nothing taken beforehand. No sweep, no liquidity, no
// reason. It fails.
export const sim019: ScenarioSpec = {
  id: "sim-019",
  seed: 19966,
  calendar: { start: [2031, 8, 4], days: 13 },
  startPrice: 20400,
  backdrop: { kind: "range", days: 11, amp: 180 },
  legs: [
    { to: (h) => h.price + 14, until: [11, "03:00"], vol: 0.9, maxDev: 16 },
    { to: (h) => h.price - 10, until: [11, "07:30"], vol: 1.1, maxDev: 18 },
    { to: (h) => h.price + 8, until: [11, "09:55"], vol: 1.3, maxDev: 20 },
    // From nowhere: displacement with nothing swept before it.
    { to: (h) => h.price + 62, until: [11, "10:01"], vol: 0.8 },
    { to: (h) => h.price - 4, until: [11, "10:08"], vol: 1.4 },
    { to: (h) => h.price + 30, until: [11, "10:17"], vol: 1.4 },
    { to: (h) => h.price - 70, until: [11, "10:30"], vol: 1.5 },
    { to: (h) => h.price - 90, until: [11, "11:20"], vol: 1.8 },
  ],
  anchorDay: 11,
  decision: [11, "10:32"],
  end: [11, "11:40"],
  build: (c) => {
    const fvg = c.fvg("5m", [11, "09:55"], "bullish", 3);
    const prior = c.extremes([11, "09:00"], [11, "09:59"]);
    const overnight = c.extremes([11, "18:00"], [11, "09:30"]);
    const pdl = c.extremes([10, "18:00"], [10, "16:59"]);

    return {
      title: "Displacement from nowhere",
      difficulty: 3,
      type: "almost_valid",
      instrument: "NQ (seeded)",
      skills: { confluence: 0.95, liquidity: 0.85, market_structure: 0.7, execution: 0.8, entry_models: 0.6, htf_bias: 0.5, concept_recognition: 0.5 },
      tags: ["no-liquidity", "displacement", "false-mss", "confluence", "no-trade"],
      prompt: "It is 10:32 ET. Read the chart and decide.",
      intro: {
        beginner: "The move looks strong. Ask what price did to the nearby highs and lows before it, and whether anything was taken.",
        advanced: "10:32 ET.",
      },
      whyNot: [
        { label: "buying the retrace into the gap", why: "The gap is clean, the break of structure is real, and nothing was swept before it. Displacement without a reason is just a move: the model needs liquidity taken first to explain why price turned there." },
      ],
      reference: {
        summary: "A clean displacement, a break of the last 5m high and a gap, from the middle of a range, with no liquidity taken beforehand. It has the shape of a setup without the thing that makes one. It fails.",
        biasTimeframe: "4H",
        bias: set("The Daily and 4H are ranging; this move from the middle of the range doesn't change that.", { neutral: 1, bullish: 0.3, bearish: 0.2 }),
        decision: set("A pattern with no liquidity taken before it isn't the setup. Stand aside, or wait for a sweep of something real.", { no_trade: 1, wait: 0.9, long: 0.25 }),
        answers: {
          take: set("The shape is there and the cause isn't.", { skip: 1, take: 0.2 }),
          draw: set("No clear draw: nothing has been taken and nothing is being targeted.", { unclear: 1, buy_side: 0.3 }),
        },
        annotations: [
          zone("fvg-5m", "fvg", "trap", "5m bullish FVG", fvg, "A clean gap from a clean displacement, and a move from nowhere. Real as a pattern, and nothing explains it.", { candidate: true, whyNot: "Without taken liquidity before it, a displacement is just momentum. It needs a reason to turn." }),
          swingRef("prior-high", "swing_high", "irrelevant", `The 5m high it broke ${px(prior.high)}`, { price: prior.high, t: prior.highT }, "Broken by body close, and a minor swing in the middle of a range: breaking it says little.", { priceTolerance: 14, timeTolerance: 120, candidate: true }),
          line("overnight-low", "supporting", `Overnight low ${px(overnight.low)}`, overnight.low, "The pool a valid long would have swept first. Untouched.", { priceTolerance: 14, candidate: true }),
          line("pdl", "irrelevant", `Previous day low ${px(pdl.low)}`, pdl.low, "Far below and untouched.", { priceTolerance: 14 }),
        ],
        confluences: [
          confluence("noSweep", "strongest", "No liquidity was taken before the move", "That's what's missing."),
          confluence("range", "strongest", "The move started in the middle of a range", "There's no location."),
          confluence("displace", "misleading", "A strong displacement", "Real, and unexplained."),
          confluence("mss", "misleading", "A break of the last 5m high", "A minor swing in a range."),
          confluence("fvg", "misleading", "A clean FVG to enter from", "A good entry model for a move with no cause."),
        ],
        ranges: {},
        dealingRange: null,
        trade: null,
        lookFor: [
          "Look left for what was taken before the move. If the answer is nothing, so is the setup.",
          "A displacement tells you who was in control for a few minutes. A sweep tells you why.",
        ],
      },
      trapMistakes: { long: ["NO_CONFIRMATION"] },
    };
  },
};
