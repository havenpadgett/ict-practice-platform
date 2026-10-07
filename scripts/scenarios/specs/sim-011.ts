import { band, confluence, line, locate, px, set, swingRef, sweepSkeleton, zone, type ScenarioSpec } from "../lib";

// Good structure, bad location. The 5m model is textbook (sweep, displacement,
// gap) but it fires at the top of the Daily range, just under the previous day
// high with nowhere to go. It's the right pattern in the wrong place.
export const sim011: ScenarioSpec = {
  id: "sim-011",
  seed: 11188,
  calendar: { start: [2030, 11, 4], days: 13 },
  startPrice: 21700,
  backdrop: { kind: "uptrend", days: 11, amp: 210 },
  legs: sweepSkeleton({
    day: 11,
    sign: 1,
    overnight: 52,
    bounce: 10,
    approach: 14,
    displace: 40,
    push: 52,
    retrace: 22,
    end: (h) => h.price,
    endAt: "10:30",
    finish: [
      { to: (h) => h.hi([10, "18:00"], [10, "16:59"]) + 10, until: [11, "10:24"], vol: 1.4 },
      { to: (h) => h.lo([11, "18:00"], [11, "09:15"]) - 36, until: [11, "11:10"], vol: 2.0 },
    ],
  }),
  anchorDay: 11,
  decision: [11, "09:58"],
  end: [11, "11:40"],
  build: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bullish", 2);
    const ob = c.candle("5m", [11, "09:25"]);
    const sweep = c.extremes([11, "09:25"], [11, "09:38"]);
    const pdh = c.extremes([10, "18:00"], [10, "16:59"]);
    const now = c.close([11, "09:57"]);
    const room = pdh.high - now;
    const where = locate(now, { high: pdh.high, low: pdh.low });
    if (room > 45) throw new Error(`there's ${room.toFixed(0)} points to the previous day high: not a bad location`);
    const risk = now - sweep.low;
    if (risk < room * 2) throw new Error(`reward ${room.toFixed(0)} vs risk ${risk.toFixed(0)}: reward isn't small against the risk`);

    return {
      title: "Right pattern, wrong place",
      difficulty: 2,
      type: "good_structure_bad_location",
      instrument: "NQ (seeded)",
      skills: { htf_bias: 0.8, liquidity: 0.8, confluence: 0.8, execution: 0.7, entry_models: 0.6, market_structure: 0.4, concept_recognition: 0.2 },
      tags: ["location", "room-to-draw", "premium", "pdh", "structure"],
      prompt: "It is 09:58 ET. Read the chart and decide.",
      intro: {
        beginner: "The pattern on the 5m is clean. Before you trade a pattern, look at where on the bigger chart it is, and how much room there is before the next pool of liquidity.",
        advanced: "09:58 ET. A clean model. Where is it?",
      },
      whyNot: [
        { label: "buying the 5m setup", why: "Everything about the model is right and the location isn't: price is already within a few points of the previous day high. The stop has to sit under the sweep low, a long way down, while the only reward available is a few points to the high." },
        { label: "shorting the high", why: "Nothing has swept the high or shifted structure down yet. 'Near resistance' is not a reason to sell on its own." },
      ],
      reference: {
        summary: "A clean sweep, displacement and gap that formed right under the previous day high. The pattern is real; the room isn't. A stop beneath the sweep and a few points of reward is a bad trade however good the entry looks.",
        biasTimeframe: "4H",
        bias: set("Higher highs and higher lows on the Daily and 4H: the trend is up, and price is at the top of the range it's been building.", { bullish: 1, neutral: 0.6 }),
        decision: set("There's no room. Standing aside, or waiting for a retrace into discount or a break above the high, is the position; the entry on its own isn't the trade.", { no_trade: 1, wait: 0.85, long: 0.15 }),
        answers: {
          take: set("The model is valid and the location isn't.", { skip: 1, take: 0.15 }),
          draw: set("The previous day high is the draw, and price is nearly there already.", { buy_side: 1, unclear: 0.3 }),
          location: set("Price is in the premium of yesterday's range, right at the top.", { [where]: 1, equilibrium: where === "premium" ? 0.2 : 0 }),
        },
        annotations: [
          line("pdh", "invalidating", `Previous day high ${px(pdh.high)}`, pdh.high, "The pool above and the problem: price is already beside it, so a long has almost no reward while risking a full stop below the sweep.", { scope: "external", priceTolerance: 14, decisionNote: "Reward is the distance to the draw. Here it's a few points against a risk of dozens.", candidate: true }),
          zone("fvg-5m", "fvg", "trap", "5m bullish FVG from the displacement", fvg, "A clean entry model with nowhere to go. It's valid as a pattern and wrong as a trade.", { candidate: true, whyNot: "A good entry doesn't make a good trade. Location and room come first." }),
          zone("ob-5m", "ob", "trap", "5m order block under the gap", ob, "Same story as the gap.", { candidate: true }),
          swingRef("sweep-low", "swing_low", "irrelevant", `Sweep low ${px(sweep.low)}`, { price: sweep.low, t: sweep.lowT }, "Real, and it sets a stop that's too far from the entry for the room on offer.", { priceTolerance: 10, timeTolerance: 20, candidate: true }),
        ],
        confluences: [
          confluence("room", "strongest", "Price is just under the previous day high", "No room to the draw."),
          confluence("location", "strongest", "Price is at the top of the Daily range", "Premium: a long's weakest location."),
          confluence("sweep", "misleading", "Sell-side liquidity swept", "Real, and small in the context of how high price already is."),
          confluence("displace", "misleading", "Displacement with an FVG", "A textbook entry into no reward."),
          confluence("htf", "supporting", "Daily and 4H trending up", "The trend is a reason to wait for discount, not to buy the top."),
        ],
        ranges: { expected_target: [band("previous day high", pdh.high - 8, pdh.high + 8, 25, { ideal: pdh.high })] },
        dealingRange: { high: pdh.high, low: pdh.low, tf: "1D" },
        trade: null,
        lookFor: [
          "Measure the room to the draw before you measure the entry. Reward has to beat risk by a margin.",
          "Premium is where longs are weakest, even in an uptrend. Wait for discount.",
          "A clean pattern is only one ingredient. Location is the other.",
        ],
      },
      trapMistakes: { long: ["IGNORED_OPPOSING_HTF"] },
    };
  },
};
