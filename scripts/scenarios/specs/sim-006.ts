import { band, confluence, line, px, set, swingRef, sweepSkeleton, zone, type ScenarioSpec } from "../lib";

// Conflicting HTF and LTF. A textbook long on the 5m, taken straight into
// higher-timeframe supply in a downtrend. The long looks good and is wrong.
export const sim006: ScenarioSpec = {
  id: "sim-006",
  seed: 6633,
  calendar: { start: [2030, 6, 3], days: 13 },
  startPrice: 22800,
  backdrop: { kind: "downtrend", days: 11, amp: 185 },
  legs: sweepSkeleton({
    day: 11,
    sign: 1,
    overnight: 95,
    approach: 40,
    displace: 60,
    retrace: 40,
    end: (h) => h.price,
    endAt: "10:30",
    finish: [
      { to: (h) => h.price + 30, until: [11, "10:25"], vol: 1.4 },
      { to: (h) => h.lo([11, "18:00"], [11, "09:15"]) - 40, until: [11, "10:58"], vol: 2.0 },
    ],
  }),
  anchorDay: 11,
  decision: [11, "09:50"],
  end: [11, "11:30"],
  build: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bullish", 2);
    const sweep = c.extremes([11, "09:25"], [11, "09:38"]);
    const overnight = c.extremes([11, "18:00"], [11, "09:20"]);
    const nowPrice = c.close([11, "09:49"]);
    const supply = c.fvgAt("1H", nowPrice + 40, "bearish", 120);
    const pdl = c.extremes([10, "18:00"], [10, "16:59"]);

    return {
      title: "Against the higher timeframe",
      difficulty: 2,
      type: "conflicting_htf_ltf",
      instrument: "NQ (seeded)",
      skills: { htf_bias: 0.95, confluence: 0.8, liquidity: 0.6, execution: 0.6, entry_models: 0.5, market_structure: 0.4, concept_recognition: 0.2 },
      tags: ["htf-bias", "conflict", "supply", "sweep"],
      prompt: "It is 09:50 ET. Read the chart and decide.",
      intro: {
        beginner: "The 5m looks clean. Before you act on it, check what the Daily and 4H are doing, and what is sitting above price.",
        advanced: "09:50 ET. A clean 5m. What does the higher timeframe say?",
      },
      whyNot: [
        { label: "buying the 5m setup", why: "A sweep, displacement and an FVG are all there, and price is climbing straight into 1H supply on a Daily and 4H downtrend. The lower timeframe is a rally inside the larger move, not a reversal of it." },
        { label: "shorting it here", why: "Nothing has confirmed down yet. The supply is a reason not to buy, and it takes its own sweep and displacement to short." },
      ],
      reference: {
        summary: "A valid-looking 5m long (sweep, displacement, gap) into 1H supply, on higher timeframes that are making lower highs and lower lows. The conflict is the whole lesson: stand aside, or wait for the higher timeframe to speak.",
        biasTimeframe: "4H",
        bias: set("Lower highs and lower lows on the Daily and 4H. The overnight dip and the open's rally are both inside that downtrend.", { bearish: 1, neutral: 0.5 }),
        decision: set("The long conflicts with the higher timeframe and runs into supply: no trade, or wait to see whether supply holds. A short isn't there yet.", { no_trade: 1, wait: 0.8, long: 0.1, short: 0.15 }),
        answers: {
          take: set("The 5m is valid and the context is against it.", { skip: 1, take: 0.1 }),
          draw: set("The higher timeframe is drawn lower: the previous day low is the pool, and the rally is a retrace.", { sell_side: 1, unclear: 0.3 }),
          location: set("Price is rallying into the premium of the leg down, where supply sits.", { premium: 1, equilibrium: 0.3 }),
        },
        annotations: [
          zone("supply", "fvg", "invalidating", "1H bearish FVG above price", supply, "Higher-timeframe supply, directly in the path. A long has to trade through it, and in a downtrend it's where rallies tend to end.", { decisionNote: "This is the reason there's no trade: the target is blocked by the thing the trend wants to defend.", candidate: true }),
          line("overnight-low", "supporting", `Overnight low ${px(overnight.low)}`, overnight.low, "Sell-side liquidity, swept. A sweep on the lower timeframe is fine; here it's a reason to be careful, not to buy.", { priceTolerance: 14 }),
          zone("fvg-5m", "fvg", "trap", "5m bullish FVG from the displacement", fvg, "A clean gap in the wrong direction against the higher timeframe. It's valid as a pattern and not as a trade.", { candidate: true, whyNot: "A good 5m model against a bearish 4H inside 1H supply isn't an edge; it's a counter-trend scalp." }),
          line("pdl", "key", `Previous day low ${px(pdl.low)}`, pdl.low, "Where the higher timeframe is drawn. That's where the bigger move wants to go.", { scope: "external", priceTolerance: 14 }),
          swingRef("sweep-low", "swing_low", "irrelevant", `Sweep low ${px(sweep.low)}`, { price: sweep.low, t: sweep.lowT }, "Real, and not the point.", { priceTolerance: 10, timeTolerance: 20, candidate: true }),
        ],
        confluences: [
          confluence("htf", "strongest", "Daily and 4H trending down", "The trade goes against this."),
          confluence("supply", "strongest", "1H bearish FVG sitting above price", "The path is blocked."),
          confluence("sweep", "misleading", "Sell-side liquidity swept", "Real, and in a downtrend sweeps of lows often just extend the move."),
          confluence("displace", "misleading", "Displacement up through the last 5m high", "Valid on the 5m and counter to the 4H."),
          confluence("fvg", "misleading", "Bullish 5m FVG as an entry", "A good entry model for a bad idea."),
          confluence("session", "irrelevant", "NY AM window", "Doesn't change the context."),
        ],
        ranges: { expected_target: [band("previous day low", pdl.low - 8, pdl.low + 8, 30, { ideal: pdl.low })] },
        dealingRange: null,
        trade: null,
        lookFor: [
          "Check what's above price before you go long, and what's below before you go short.",
          "Higher timeframe first. A perfect lower-timeframe model against it is a counter-trend trade and should be priced like one.",
          "When the two disagree, 'no trade' and 'wait for the higher timeframe to confirm' are both good answers.",
        ],
      },
      trapMistakes: { long: ["AGAINST_HTF_BIAS", "IGNORED_OPPOSING_HTF"] },
    };
  },
};
