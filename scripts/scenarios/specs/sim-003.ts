import { band, confluence, line, px, set, swingRef, zone, type ScenarioSpec } from "../lib";

// Almost valid. The sell-side low is swept and price pops, but the pop never
// closes through the last 5m high: a wick through, not a break of structure.
// There is no displacement and no confirmation, and the idea fails.
export const sim003: ScenarioSpec = {
  id: "sim-003",
  seed: 3318,
  calendar: { start: [2030, 2, 4], days: 13 },
  startPrice: 19800,
  backdrop: { kind: "uptrend", days: 11, amp: 170 },
  legs: [
    { to: (h) => h.price - 95, until: [11, "03:00"], vol: 1.4 },
    { to: (h) => h.price + 20, until: [11, "07:30"], vol: 1.4 },
    { to: (h) => h.price - 40, until: [11, "09:15"], vol: 1.5 },
    { to: (h) => h.lo([11, "18:00"], [11, "09:15"]) - 12, until: [11, "09:34"], vol: 2 },
    { to: (h) => h.price + 30, until: [11, "09:44"], vol: 1.1 },
    // The wick through the last 5m high, reversed inside the same five minutes.
    { to: (h) => h.hi([11, "07:00"], [11, "09:33"]) + 9, until: [11, "09:46"], vol: 0.6 },
    { to: (h) => h.price - 20, until: [11, "09:49"], vol: 0.6 },
    { to: (h) => h.price + 4, until: [11, "10:10"], vol: 1.1 },
    { to: (h) => h.price - 100, until: [11, "11:10"], vol: 1.7 },
  ],
  anchorDay: 11,
  decision: [11, "09:50"],
  end: [11, "11:30"],
  build: (c) => {
    const sweep = c.extremes([11, "09:25"], [11, "09:38"]);
    const overnight = c.extremes([11, "18:00"], [11, "09:20"]);
    const level = c.extremes([11, "07:00"], [11, "09:33"]);
    const wick = c.extremes([11, "09:44"], [11, "09:48"]);
    if (!(wick.high > level.high)) throw new Error("the pop never wicked through the last 5m high");
    const closes = c.series("5m").filter((k) => k.t >= c.t([11, "09:35"]) && k.t <= c.t([11, "09:45"])).map((k) => k.c);
    if (closes.some((x) => x >= level.high)) throw new Error("a 5m candle closed through the level: it is a break, not a wick");
    const pdh = c.extremes([10, "18:00"], [10, "16:59"]);
    const pdhSwing = { price: pdh.high, t: pdh.highT };

    return {
      title: "A wick is not a break",
      difficulty: 2,
      type: "almost_valid",
      instrument: "NQ (seeded)",
      skills: { confluence: 0.9, market_structure: 0.8, execution: 0.6, htf_bias: 0.4, liquidity: 0.5, entry_models: 0.5, concept_recognition: 0.3 },
      tags: ["sweep", "mss", "no-confirmation", "wick"],
      prompt: "It is 09:50 ET. Read the chart and decide.",
      intro: {
        beginner: "The Daily and 4H are still up. Price swept the overnight low and bounced. Decide whether the bounce is a reason to buy.",
        advanced: "09:50 ET. Sweep and a bounce. Mark what matters and decide.",
      },
      whyNot: [
        { label: "buying the bounce", why: "The bounce never closed above the last 5m high; it only wicked through it. Without a body close, structure hasn't shifted, so the sweep is a candidate and not yet an entry." },
        { label: "shorting the failed pop", why: "The higher timeframes are up. A failed bounce is a reason to wait, not a reason to fight the trend." },
      ],
      reference: {
        summary: "A sweep of the overnight low with a bounce that only wicked through the last 5m high. No displacement and no body close means no confirmation. Wait for one, or stand aside.",
        biasTimeframe: "4H",
        bias: set("The Daily and 4H are still making higher highs and higher lows; nothing here changed that.", { bullish: 1, neutral: 0.5 }),
        decision: set("There is a sweep, but nothing confirms it: the bounce is a wick, not a close. Standing aside or waiting for a real shift is the position; entering is a guess.", { no_trade: 1, wait: 0.85, long: 0.15 }),
        answers: {
          take: set("The location is fine and the confirmation is missing.", { skip: 1, take: 0.15 }),
          draw: set("The previous day high is still the pool above; the trade just isn't ready.", { buy_side: 1, unclear: 0.4 }),
        },
        annotations: [
          line("overnight-low", "key", `Overnight low ${px(overnight.low)}`, overnight.low, "Obvious sell-side liquidity, taken at the open.", { priceTolerance: 14 }),
          swingRef("sweep-low", "swing_low", "supporting", `Sweep low ${px(sweep.low)}`, { price: sweep.low, t: sweep.lowT }, "The extreme of the sweep; a close below it kills the idea.", { priceTolerance: 10, timeTolerance: 20 }),
          swingRef("wicked-high", "swing_high", "trap", `Last 5m high ${px(level.high)}`, { price: level.high, t: level.highT }, "The pop traded through this and closed back under it. That's a wick, not a break of structure.", { priceTolerance: 10, timeTolerance: 60, candidate: true, whyNot: "A wick through a level is a probe. Structure shifts when a candle body closes through it." }),
          line("pdh", "supporting", `Previous day high ${px(pdh.high)}`, pdh.high, "Where this would be heading if it confirmed.", { scope: "external", priceTolerance: 14, candidate: true, kind: "liquidity" }),
        ],
        confluences: [
          confluence("sweep", "strongest", "Sell-side liquidity (overnight low) swept", "There's something to build on."),
          confluence("htf", "supporting", "Daily and 4H trending up", "The location is on the right side."),
          confluence("mss", "misleading", "A break of the last 5m high", "Only a wick went through. No candle closed above it."),
          confluence("bounce", "misleading", "A strong bounce off the low", "A bounce is not displacement; it didn't take out a structural high."),
          confluence("session", "irrelevant", "Inside the NY AM window", "Timing is right and says nothing about whether it confirmed."),
          confluence("pdh", "irrelevant", "Previous day high above", "A target means nothing until there's an entry."),
        ],
        ranges: {},
        dealingRange: null,
        trade: null,
        lookFor: [
          "A body close through the swing is the confirmation. A wick is a probe.",
          "A sweep tells you where to look. It doesn't tell you to buy.",
          "If you'd be entering on hope that it confirms, that's the trade to skip.",
        ],
      },
      trapMistakes: { long: ["NO_CONFIRMATION"] },
    };
  },
};
