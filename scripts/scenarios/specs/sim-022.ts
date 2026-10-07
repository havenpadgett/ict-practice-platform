import { confluence, line, px, set, sweepSkeleton, zone, type ScenarioSpec } from "../lib";

// Advanced no-trade after a full move. The morning expansion is finished. By
// early afternoon price is resting at the high in a tight, overlapping range.
// Neither fading nor chasing it has an edge.
export const sim022: ScenarioSpec = {
  id: "sim-022",
  seed: 22188,
  calendar: { start: [2031, 10, 6], days: 13 },
  startPrice: 22100,
  backdrop: { kind: "uptrend", days: 11, amp: 200 },
  legs: sweepSkeleton({
    day: 11,
    sign: 1,
    overnight: 135,
    approach: 50,
    displace: 64,
    push: 60,
    retrace: 70,
    end: (h) => h.price,
    endAt: "10:40",
    finish: [
      { to: (h) => h.price + 140, until: [11, "10:55"], vol: 1.5 },
      { to: (h) => h.price + 20, until: [11, "11:50"], vol: 1.2, maxDev: 26 },
      { to: (h) => h.price - 24, until: [11, "12:30"], vol: 1.1, maxDev: 26 },
      { to: (h) => h.price + 18, until: [11, "13:10"], vol: 1.1, maxDev: 26 },
      { to: (h) => h.price - 6, until: [11, "13:45"], vol: 1.1, maxDev: 26 },
    ],
  }),
  anchorDay: 11,
  decision: [11, "13:20"],
  end: [11, "13:50"],
  build: (c) => {
    const restHigh = c.extremes([11, "11:30"], [11, "13:19"]);
    const restLow = { low: Math.min(...c.series("5m").filter((k) => k.t >= c.t([11, "11:30"]) && k.t <= c.t([11, "13:19"])).map((k) => k.l)) };
    const pdh = c.extremes([10, "18:00"], [10, "16:59"]);
    const morningGap = c.fvg("5m", [11, "09:30"], "bullish", 2);
    const midGap = c.fvgIn("5m", "bullish", [11, "09:55"], [11, "10:55"]);

    return {
      title: "Expansion, then rest",
      difficulty: 3,
      type: "chop",
      instrument: "NQ (seeded)",
      skills: { execution: 0.95, confluence: 0.9, htf_bias: 0.5, liquidity: 0.5, market_structure: 0.6, concept_recognition: 0.4, entry_models: 0.3 },
      tags: ["consolidation", "no-trade", "post-expansion", "patience"],
      prompt: "It is 13:20 ET. Read the chart and decide.",
      intro: {
        beginner: "The big move happened this morning. Look at what price has been doing since, and whether there is anything new to act on.",
        advanced: "13:20 ET.",
      },
      whyNot: [
        { label: "fading the high", why: "Price is sitting at the high of an expansion, not rejecting from it. Nothing has swept the range or broken structure down; a short here is a guess." },
        { label: "buying the break of the range", why: "The range is tight and overlapping. Breaks of a rest inside a finished move often fail, and there's no sell-side liquidity taken to buy from." },
      ],
      reference: {
        summary: "A full morning expansion, then two and a half hours of tight, overlapping candles at the high. The setup was in the morning; nothing in this range is one. No trade.",
        biasTimeframe: "4H",
        bias: set("Higher highs and higher lows on the Daily and 4H. The rest at the high doesn't change that and doesn't offer an entry.", { bullish: 1, neutral: 0.7 }),
        decision: set("Consolidation after an expansion with nothing swept: no trade, or wait for a real sweep and displacement.", { no_trade: 1, wait: 0.9, long: 0.1, short: 0.1 }),
        answers: {
          take: set("Nothing to take.", { skip: 1, take: 0.05 }),
          draw: set("Buy-side liquidity above remains the pull; nothing is being traded toward it.", { buy_side: 1, unclear: 0.7 }),
        },
        annotations: [
          line("rest-high", "trap", `Top of the rest ${px(restHigh.high)}`, restHigh.high, "Equal-looking highs in a tight rest look like liquidity. Taking them tells you nothing in a market that isn't trending.", { scope: "internal", priceTolerance: 10, candidate: true, whyNot: "Internal liquidity inside a consolidation isn't a draw." }),
          line("rest-low", "trap", `Bottom of the rest ${px(restLow.low)}`, restLow.low, "The other edge of the rest.", { scope: "internal", priceTolerance: 10, candidate: true }),
          zone("morning-gap", "fvg", "irrelevant", "The morning's displacement FVG", morningGap, "Where the trade was. Far below now, and not a place to trade from at this price.", { candidate: true }),
          zone("mid-gap", "fvg", "irrelevant", "5m FVG on the way up", midGap, "A gap inside the move that's done.", { candidate: true }),
          line("pdh", "irrelevant", `Previous day high ${px(pdh.high)}`, pdh.high, "Taken in the morning's expansion.", { priceTolerance: 14 }),
        ],
        confluences: [
          confluence("rest", "strongest", "Two and a half hours of tight, overlapping candles", "The market has stopped."),
          confluence("done", "strongest", "The morning's setup played out already", "There's no new setup."),
          confluence("htf", "supporting", "Daily and 4H trending up", "Bias is intact and offers no entry."),
          confluence("edges", "misleading", "Highs and lows of the rest as liquidity", "Internal liquidity in a consolidation isn't a draw."),
          confluence("boredom", "misleading", "\"It has to do something\"", "It doesn't have to do anything for you."),
        ],
        ranges: {},
        dealingRange: null,
        trade: null,
        lookFor: [
          "A setup that already happened isn't a setup you missed: it's finished. Look for the next one.",
          "Time spent resting at a high is information. It says nothing is being taken.",
        ],
      },
      trapMistakes: { long: ["FORCED_SETUP"], short: ["FORCED_SETUP"] },
    };
  },
};
