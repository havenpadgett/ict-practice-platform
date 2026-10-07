import { band, confluence, line, locate, px, set, swingRef, zone, type ScenarioSpec } from "../lib";

// Advanced reversal with more than one valid read. A Daily and 4H downtrend
// meets the week's low: swept, then a violent displacement up through the last
// 5m high. Whether that's a reversal or a retrace is genuinely open. Waiting
// for the higher timeframe is as defensible as taking the long.
export const sim025: ScenarioSpec = {
  id: "sim-025",
  seed: 25411,
  calendar: { start: [2032, 1, 5], days: 13 },
  startPrice: 23800,
  backdrop: { kind: "downtrend", days: 11, amp: 215 },
  legs: [
    { to: (h) => h.lo([6, "18:00"], [10, "16:59"]) + 24, until: [11, "03:00"], vol: 1.4 },
    { to: (h) => h.price + 10, until: [11, "07:30"], vol: 1.3 },
    { to: (h) => h.lo([6, "18:00"], [11, "07:30"]) + 6, until: [11, "09:15"], vol: 1.5 },
    { to: (h) => h.lo([6, "18:00"], [11, "09:15"]) - 22, until: [11, "09:34"], vol: 2 },
    { to: (h) => h.price + 104, until: [11, "09:40"], vol: 0.9 },
    { to: (h) => h.price - 6, until: [11, "09:47"], vol: 1.4 },
    { to: (h) => h.price + 64, until: [11, "09:56"], vol: 1.4 },
    { to: (h) => h.price - 110, until: [11, "10:12"], vol: 1.6 },
    { to: (h) => h.hi([10, "18:00"], [10, "16:59"]) + 4, until: [11, "12:00"], vol: 2.0 },
  ],
  anchorDay: 11,
  decision: [11, "10:02"],
  end: [11, "12:20"],
  checkpoints: { confirm: [11, "10:14"] },
  ideal: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bullish", 2);
    return { expect: "target", order: { direction: "long", entry: (fvg.priceHigh + fvg.priceLow) / 2 + 6, stop: c.extremes([11, "09:25"], [11, "09:38"]).low - 6, target: c.extremes([10, "18:00"], [10, "16:59"]).high - 14, placedAt: c.revealedAfter([11, "10:01"]) } };
  },
  build: (c) => {
    const fvg = c.fvg("5m", [11, "09:30"], "bullish", 2);
    const sweep = c.extremes([11, "09:25"], [11, "09:38"]);
    const week = c.extremes([6, "18:00"], [10, "16:59"]);
    const day = c.extremes([10, "18:00"], [10, "16:59"]);
    const now = c.close([11, "10:01"]);
    const where = locate(now, { high: week.high, low: week.low });
    const mid = (day.high + day.low) / 2;
    const ob = c.candle("5m", [11, "09:25"]);

    return {
      title: "The week's low, and a shift",
      difficulty: 3,
      type: "valid_setup",
      instrument: "NQ (seeded)",
      skills: { htf_bias: 0.95, liquidity: 0.9, confluence: 0.8, entry_models: 0.7, execution: 0.7, market_structure: 0.7, concept_recognition: 0.3 },
      tags: ["reversal", "weekly-low", "htf-shift", "counter-trend", "multiple-valid", "sweep"],
      prompt: "It is 10:02 ET. Read the chart and decide.",
      intro: {
        beginner: "A downtrend has reached the lowest point of the week, and price has just moved sharply the other way. Think about what's confirmed and what isn't.",
        advanced: "10:02 ET.",
      },
      whyNot: [
        { label: "shorting the displacement", why: "The Daily and 4H are still down, so a short is with the trend, and it's also selling right after the week's low was swept and a violent displacement printed through structure. It's a coin flip: with the trend, against the evidence on the lower timeframe." },
        { label: "buying with full size", why: "The higher timeframe hasn't shifted: this is a lower-timeframe reversal inside a larger downtrend. A long is valid with a plan that respects that, a nearer target and a stop beyond the sweep." },
      ],
      reference: {
        summary: "The week's low is swept and price displaces up violently through the last 5m high. Whether this is a reversal or a retrace in a Daily and 4H downtrend is open: a long to the previous day high (or its midpoint) is valid, waiting for a 1H or 4H shift is equally valid, and standing aside is defensible. Several readings hold up; none is certain.",
        biasTimeframe: "4H",
        bias: set("The Daily and 4H are still in a downtrend, and the week's low just got swept: neutral, or a bullish read with the shift still unconfirmed, are both defensible. Staying bearish isn't unreasonable either.", { neutral: 1, bullish: 0.75, bearish: 0.35 }),
        decision: set("A long from the gap with a defined target is valid. So is waiting for the higher timeframe to confirm. Standing aside is defensible given the counter-trend risk.", { wait: 1, long: 0.9, no_trade: 0.5, short: 0.1 }),
        answers: {
          take: set("Valid as a counter-trend long with a plan; a pass is equally reasonable.", { take: 1, skip: 0.8 }),
          draw: set("If it's a reversal, the previous day high is the pool; if it's a retrace, the week's low is still the draw.", { buy_side: 0.9, sell_side: 0.6, unclear: 1 }),
          location: set("Price is near the bottom of the week's range.", { [where]: 1, equilibrium: where === "discount" ? 0.2 : 0 }),
        },
        annotations: [
          line("week-low", "key", `Week low ${px(week.low)}`, week.low, "The week's obvious sell-side liquidity: taken at 09:34, the reason this is a reversal candidate at all.", { scope: "external", priceTolerance: 18 }),
          line("pdh", "valid", `Previous day high ${px(day.high)}`, day.high, "The draw if this is a reversal.", { scope: "external", group: "draw", priceTolerance: 14 }),
          line("pdm", "valid", `Midpoint of yesterday's range ${px(mid)}`, mid, "A nearer draw (equilibrium) that fits a cautious counter-trend plan.", { scope: "internal", group: "draw", priceTolerance: 20 }),
          swingRef("sweep-low", "swing_low", "supporting", `Sweep low ${px(sweep.low)}`, { price: sweep.low, t: sweep.lowT }, "The invalidation.", { priceTolerance: 14, timeTolerance: 20 }),
          zone("fvg-5m", "fvg", "key", "5m bullish FVG from the displacement", fvg, "The entry model if you take the long.", { group: "poi", candidate: true }),
          zone("ob-5m", "ob", "valid", "5m order block under the gap", ob, "An acceptable alternative area.", { group: "poi", candidate: true }),
        ],
        confluences: [
          confluence("weekLow", "strongest", "The week's low swept", "The biggest pool in sight, taken."),
          confluence("displace", "strongest", "A violent displacement through the last 5m high", "The shift on the lower timeframe."),
          confluence("fvg", "supporting", "Entry from the gap", "A defined area."),
          confluence("htf", "misleading", "Daily and 4H still trending down", "Not a reason to go long. A reason to size it as counter-trend or wait."),
          confluence("unconfirmed", "strongest", "No 1H or 4H shift yet", "What's still open."),
        ],
        ranges: {
          expected_target: [band("previous day high", day.high - 14, day.high + 8, 28, { ideal: day.high - 8 }), band("midpoint of yesterday's range", mid - 14, mid + 14, 26, { ideal: mid, credit: 0.85 })],
        },
        dealingRange: { high: week.high, low: week.low, tf: "1D" },
        trade: {
          direction: "long",
          entry: [band("the 5m FVG", fvg.priceLow, fvg.priceHigh, 8, { ideal: (fvg.priceLow + fvg.priceHigh) / 2 }), band("the order block under it", ob.priceLow, ob.priceHigh, 6, { credit: 0.9 })],
          confirmedAtRevealed: c.revealedAtClose("5m", [11, "09:35"]),
          confirmationLabel: "the displacement that closed above the last 5m high",
          stop: { invalidation: sweep.low, buffer: 12 },
          targets: [band("previous day high", day.high - 14, day.high + 8, 28, { ideal: day.high - 8 }), band("midpoint of yesterday's range", mid - 14, mid + 14, 26, { ideal: mid, credit: 0.85 })],
          minRR: 1.5,
        },
        lookFor: [
          "Some charts have no single right answer. A reversal and a retrace both fit; the skill is a plan that survives either.",
          "Say what would convince you it's a reversal (a 1H break of structure) before it happens.",
          "A counter-trend long needs a nearer target or a smaller idea. A trend long doesn't.",
        ],
      },
      trapMistakes: { short: ["NO_CONFIRMATION"] },
    };
  },
};
