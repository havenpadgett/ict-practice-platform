// Process scoring. Every score here is about how the trader read and
// executed, never about whether price happened to go their way: the R result
// is reported next to the score and never enters it. A losing trade with the
// right bias, liquidity read and entry logic is a normal failed setup and
// scores high; a winner taken before confirmation with a stop that did not
// protect it scores low. That distinction is the point of the product.
//
// The same scorers serve every mode: a mode's stages name which scorer reads
// each response (ModeConfig), and dimensions the mode never asked about are
// simply not applicable.

import { compareMarks, creditForChoice, creditForRange, fullCreditValues, marksInScope, scoreMarks } from "@/lib/engine/accept";
import { fromRow, type SimCandle } from "@/lib/engine/candles";
import {
  CONFIRMATION,
  CRITICAL_CAPS,
  DIMENSION_SKILLS,
  DIMENSION_WEIGHTS,
  STOP,
  VERDICT_CUTOFFS,
} from "@/lib/engine/config";
import { buildReview } from "@/lib/engine/review";
import { plannedRR, simulateOrder } from "@/lib/engine/trade";
import type {
  Annotation,
  AnnotationKind,
  AttemptResponse,
  AttemptResult,
  Bias,
  Decision,
  Dimension,
  DimensionResult,
  MarkComparison,
  MistakeId,
  ModeConfig,
  Order,
  RefAnnotation,
  ReferenceAnalysis,
  ReplayResponse,
  Scenario,
  SkillEvidence,
  StageConfig,
  StageResponse,
  TradeOutcome,
  TradeReference,
} from "@/lib/engine/types";
import type { Verdict3 } from "@/lib/verdict";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function verdictFor(score: number): Verdict3 {
  return score >= VERDICT_CUTOFFS.correct ? "correct" : score >= VERDICT_CUTOFFS.couldImprove ? "could_improve" : "incorrect";
}

function result(dimension: Dimension, credit: number, note: string): DimensionResult {
  const score = Math.round(clamp01(credit) * 100);
  return { dimension, applicable: true, score, verdict: verdictFor(score), note };
}

const notApplicable = (dimension: Dimension, note: string): DimensionResult => ({ dimension, applicable: false, score: 0, verdict: "correct", note });

export const fmtPrice = (n: number): string => n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const DIRECTION_BIAS: Record<"long" | "short", Bias> = { long: "bullish", short: "bearish" };

// ---- Individual scorers -------------------------------------------------

export function scoreBias(ref: ReferenceAnalysis, value: Bias | string | null | undefined): DimensionResult {
  const { credit, note } = creditForChoice(ref.bias, value);
  if (value === null || value === undefined) return result("htf_bias", 0, "No bias declared. Commit to a read of the higher timeframe before trading it.");
  const best = fullCreditValues(ref.bias);
  if (credit >= 1) return result("htf_bias", 1, `${cap(String(value))} matches the ${ref.biasTimeframe} read. ${ref.bias.why}`);
  if (credit > 0) return result("htf_bias", credit, `${cap(String(value))} is defensible here${note ? `: ${note}` : ""}. The stronger read was ${best.join(" or ")}. ${ref.bias.why}`);
  return result("htf_bias", 0, `You called ${value}; the ${ref.biasTimeframe} pointed ${best.join(" or ")}. ${ref.bias.why}`);
}

export function scoreAnswerSet(ref: ReferenceAnalysis, key: string, value: string | null | undefined, dimension: Dimension): DimensionResult {
  const set = ref.answers[key];
  if (!set) return notApplicable(dimension, "Nothing to score here.");
  const { credit, note } = creditForChoice(set, value);
  const best = fullCreditValues(set);
  if (credit >= 1) return result(dimension, 1, set.why);
  if (credit > 0) return result(dimension, credit, `Defensible${note ? `: ${note}` : ""}. ${best.length ? `The cleanest answer was ${best.join(" or ")}. ` : ""}${set.why}`);
  return result(dimension, 0, `${best.length ? `The reading that holds up was ${best.join(" or ")}. ` : ""}${set.why}`);
}

export function scoreDecision(ref: ReferenceAnalysis, decision: Decision): DimensionResult {
  const { credit, note } = creditForChoice(ref.decision, decision);
  const best = fullCreditValues(ref.decision);
  const label = (d: string) => d.replace("_", " ");
  if (credit >= 1) return result("trade_selection", 1, `${cap(label(decision))} was the right call. ${ref.decision.why}`);
  if (credit > 0) return result("trade_selection", credit, `${cap(label(decision))} is defensible${note ? `: ${note}` : ""}. The cleanest call was ${best.map(label).join(" or ")}. ${ref.decision.why}`);
  return result("trade_selection", 0, `${cap(label(decision))} wasn't supported here. The call that held up was ${best.map(label).join(" or ")}. ${ref.decision.why}`);
}

export function scoreMarksDimension(
  ref: ReferenceAnalysis,
  annotations: Annotation[],
  stage: { refKinds: AnnotationKind[]; dimension: Dimension; strict?: boolean },
  revealed?: number,
): { dimension: DimensionResult; comparison: MarkComparison } {
  const refs = ref.annotations.filter((r) => stage.refKinds.includes(r.kind) || (r.role === "invalidating" && stage.refKinds.includes(r.kind)));
  const scoped = marksInScope(annotations, stage.refKinds);
  const comparison = compareMarks(scoped, refs, { revealed });
  const s = scoreMarks(comparison, refs, { penaltyScale: stage.strict ? 1.8 : 1 });
  if (!s.required && scoped.filter((a) => !a.hindsight).length === 0) {
    return { dimension: notApplicable(stage.dimension, "Nothing here needed marking."), comparison };
  }
  const parts: string[] = [];
  const found = comparison.matched.filter((m) => m.ref.role !== "invalidating");
  if (found.length) parts.push(`You found ${found.map((m) => m.ref.label).join("; ")}.`);
  if (comparison.missed.length) parts.push(`You missed ${comparison.missed.map((m) => m.label).join("; ")}.`);
  if (comparison.trapped.length) parts.push(`${comparison.trapped.map((t) => t.ref.label).join("; ")} looks valid and isn't.`);
  if (comparison.irrelevant.length) parts.push(`${comparison.irrelevant.map((t) => t.ref.label).join("; ")} is real but doesn't matter here.`);
  if (comparison.unmatched.length) parts.push(`${comparison.unmatched.length} mark${comparison.unmatched.length === 1 ? "" : "s"} didn't sit on structure.`);
  if (!parts.length) parts.push(s.required ? "No marks drawn on the structure that mattered." : "Nothing needed marking.");
  return { dimension: result(stage.dimension, s.credit, parts.join(" ")), comparison };
}

export function scorePriceRange(ref: ReferenceAnalysis, key: string, price: number | null, dimension: Dimension): DimensionResult {
  const ranges = ref.ranges[key];
  if (!ranges || ranges.length === 0) return notApplicable(dimension, "Nothing to score here.");
  if (price === null || !Number.isFinite(price)) return result(dimension, 0, "No level given.");
  const r = creditForRange(ranges, price);
  const labels = ranges.map((x) => `${x.label} (${fmtPrice(x.low)}–${fmtPrice(x.high)})`).join(" or ");
  if (r.inside) return result(dimension, r.credit, `${fmtPrice(price)} sits in ${r.range?.label ?? "an acceptable area"}.`);
  if (r.credit > 0) return result(dimension, r.credit, `${fmtPrice(price)} is ${fmtPrice(r.distance)} points outside ${r.range?.label ?? "the area"}: close, not there. Acceptable: ${labels}.`);
  return result(dimension, 0, `${fmtPrice(price)} is outside every acceptable area. Acceptable: ${labels}.`);
}

/** Confluence selection: which supports did the user pick, and did they pad
 * the list. More ticked boxes is not a better setup. */
export function scoreConfluences(ref: ReferenceAnalysis, picked: string[]): { dimension: DimensionResult; missing: string[]; wrong: string[]; right: string[] } {
  const set = new Set(picked);
  const weight = (r: ReferenceAnalysis["confluences"][number]) => (r.relevance === "strongest" ? 1.5 : r.relevance === "supporting" ? 1 : 0);
  const total = ref.confluences.reduce((s, r) => s + weight(r), 0);
  let earned = 0;
  let penalty = 0;
  const missing: string[] = [];
  const wrong: string[] = [];
  const right: string[] = [];
  for (const r of ref.confluences) {
    const chosen = set.has(r.id);
    if (r.relevance === "strongest" || r.relevance === "supporting") {
      if (chosen) {
        earned += weight(r);
        right.push(r.label);
      } else if (r.relevance === "strongest") missing.push(r.label);
    } else if (chosen) {
      penalty += r.relevance === "misleading" ? 0.3 : 0.15;
      wrong.push(r.label);
    }
  }
  const credit = clamp01((total > 0 ? earned / total : 1) - Math.min(0.6, penalty));
  const note =
    credit >= 0.8
      ? "You picked what carried the idea and left the noise out."
      : `${right.length ? `Right: ${right.join("; ")}. ` : ""}${missing.length ? `Missing the strongest: ${missing.join("; ")}. ` : ""}${wrong.length ? `Not a reason to take it: ${wrong.join("; ")}.` : ""}`.trim();
  return { dimension: result("confluence_selection", credit, note || "Nothing selected."), missing, wrong, right };
}

/** False-positive training: of the structures shown, which ones matter?
 * Selecting a key, valid or supporting structure earns credit, selecting a
 * trap or an irrelevant one costs it, and so does passing on a key one. */
export function scoreCandidates(ref: ReferenceAnalysis, picked: string[]): { dimension: DimensionResult; wrong: RefAnnotation[]; missed: RefAnnotation[] } {
  const set = new Set(picked);
  const candidates = ref.annotations.filter((r) => r.candidate);
  if (candidates.length === 0) return { dimension: notApplicable("annotation_filter", "No candidates to judge."), wrong: [], missed: [] };
  const matters = (r: RefAnnotation) => r.role === "key" || r.role === "valid" || r.role === "supporting";
  let correct = 0;
  const wrong: RefAnnotation[] = [];
  const missed: RefAnnotation[] = [];
  for (const r of candidates) {
    const chosen = set.has(r.id);
    if (matters(r) === chosen) correct += 1;
    else if (chosen) wrong.push(r);
    else missed.push(r);
  }
  // Marking a trap as meaningful costs more than marking a harmless one.
  const trapPicks = wrong.filter((r) => r.role === "trap").length;
  const credit = clamp01(correct / candidates.length - trapPicks * 0.08);
  const parts: string[] = [];
  if (missed.length) parts.push(`It mattered: ${missed.map((r) => r.label).join("; ")}.`);
  if (wrong.length) parts.push(`It didn't: ${wrong.map((r) => r.label).join("; ")}.`);
  return { dimension: result("annotation_filter", credit, parts.join(" ") || "You separated what matters from what doesn't."), wrong, missed };
}

// ---- Trade scoring ------------------------------------------------------

type TradeScore = {
  dims: DimensionResult[];
  outcome: TradeOutcome;
  /** Entry price used for scoring. */
  entryUsed: number | null;
  mistakes: MistakeId[];
  critical: string[];
};

function entryAssessed(order: Order, outcome: TradeOutcome, stream: SimCandle[]): number {
  if (outcome.status === "closed") return outcome.fillPrice;
  if (order.entry !== null) return order.entry;
  return stream[order.placedAt - 1]?.c ?? stream[0]?.o ?? order.stop;
}

export function scoreStop(trade: TradeReference, order: Order, entry: number): DimensionResult {
  const long = order.direction === "long";
  const inv = trade.stop.invalidation;
  const buffer = Math.max(trade.stop.buffer, 1e-9);
  const beyond = long ? inv - order.stop : order.stop - inv;
  if (beyond >= 0) {
    if (beyond <= buffer) return result("stop_placement", 1, `Stop ${fmtPrice(order.stop)} sits just beyond ${fmtPrice(inv)}, the level that proves the idea wrong.`);
    const wide = clamp01((beyond - buffer) / (STOP.wideBuffers * buffer));
    const credit = 1 - (1 - STOP.wideFloor) * wide;
    return result("stop_placement", credit, `Stop ${fmtPrice(order.stop)} protects the idea but sits ${fmtPrice(beyond)} points past ${fmtPrice(inv)}. Safe, and wider than it needs to be, which costs R:R.`);
  }
  const toInv = long ? entry - inv : inv - entry;
  const covered = long ? entry - order.stop : order.stop - entry;
  const share = toInv > 0 ? covered / toInv : 0;
  const credit = share >= STOP.partialShare ? STOP.partialCredit : STOP.insideCredit;
  return result("stop_placement", credit, `Stop ${fmtPrice(order.stop)} is inside ${fmtPrice(inv)}. Price can take it out and still leave the idea intact, so it measures noise, not invalidation.`);
}

export function scoreEntry(trade: TradeReference, order: Order, entry: number, outcome: TradeOutcome): { dimension: DimensionResult; chased: boolean } {
  const r = creditForRange(trade.entry, entry);
  const long = order.direction === "long";
  const highs = Math.max(...trade.entry.map((x) => x.high));
  const lows = Math.min(...trade.entry.map((x) => x.low));
  const chased = r.credit < 0.4 && (long ? entry > highs : entry < lows);
  const filled = outcome.status === "closed";
  const verb = filled ? "filled" : "planned";
  if (r.inside) return { dimension: result("entry_location", r.credit, `Entry ${verb} at ${fmtPrice(entry)}, inside ${r.range?.label}.`), chased: false };
  const labels = trade.entry.map((x) => `${x.label} (${fmtPrice(x.low)}–${fmtPrice(x.high)})`).join(" or ");
  if (r.credit > 0) return { dimension: result("entry_location", r.credit, `Entry ${verb} at ${fmtPrice(entry)}, ${fmtPrice(r.distance)} points from ${r.range?.label}: near it, not in it. Acceptable: ${labels}.`), chased };
  return {
    dimension: result("entry_location", 0, `Entry ${verb} at ${fmtPrice(entry)}, outside every acceptable area${chased ? " and after price had already left it" : ""}. Acceptable: ${labels}.`),
    chased,
  };
}

export function scoreConfirmation(trade: TradeReference, outcome: TradeOutcome): { dimension: DimensionResult; early: number } {
  if (outcome.status !== "closed") return { dimension: notApplicable("confirmation", "The order never filled."), early: 0 };
  const label = trade.confirmationLabel ?? "confirmation";
  if (trade.confirmedAtRevealed === null) {
    return { dimension: result("confirmation", 0, "This setup never confirmed. Entering took a trade on a location with nothing behind it."), early: 0 };
  }
  const early = trade.confirmedAtRevealed - outcome.fillIndex;
  const credit = CONFIRMATION.earlyCredit(early);
  if (early <= 0) return { dimension: result("confirmation", credit, `You entered after ${label} had closed.`), early: 0 };
  return { dimension: result("confirmation", credit, `You entered ${early} candle${early === 1 ? "" : "s"} before ${label} closed. Until it prints, the location is only a candidate.`), early };
}

export function scoreTarget(trade: TradeReference, order: Order, entry: number): DimensionResult {
  const r = creditForRange(trade.targets, order.target);
  const rr = plannedRR(order.direction, entry, order.stop, order.target);
  const rrFactor = rr === null ? 0.5 : rr >= trade.minRR ? 1 : rr >= trade.minRR * 0.75 ? 0.8 : 0.5;
  const credit = r.credit * rrFactor;
  const labels = trade.targets.map((x) => `${x.label} (${fmtPrice(x.low)}–${fmtPrice(x.high)})`).join(" or ");
  const rrText = rr === null ? "" : ` Planned ${rr.toFixed(1)}R${rr < trade.minRR ? `, below the ${trade.minRR}R minimum` : ""}.`;
  if (r.inside) return result("target_selection", credit, `Target ${fmtPrice(order.target)} aims at ${r.range?.label}.${rrText}`);
  if (r.credit > 0) return result("target_selection", credit, `Target ${fmtPrice(order.target)} is ${fmtPrice(r.distance)} points from ${r.range?.label}: close.${rrText} Acceptable: ${labels}.`);
  return result("target_selection", 0, `Target ${fmtPrice(order.target)} isn't at a liquidity level this move was drawn to.${rrText} Acceptable: ${labels}.`);
}

export function scoreTrade(scenario: Scenario, response: { decision: Decision; order: Order | null }, stream: SimCandle[]): TradeScore {
  const ref = scenario.reference;
  const dims: DimensionResult[] = [];
  const mistakes: MistakeId[] = [];
  const critical: string[] = [];

  const decision = scoreDecision(ref, response.decision);
  dims.push(decision);

  const traded = (response.decision === "long" || response.decision === "short") && response.order !== null;
  if (!traded) {
    // Waiting or standing aside: nothing to place, nothing to execute.
    return {
      dims: [...dims, ...(["entry_location", "stop_placement", "target_selection", "confirmation"] as Dimension[]).map((d) => notApplicable(d, "No order was placed."))],
      outcome: { status: "no_order" },
      entryUsed: null,
      mistakes,
      critical,
    };
  }

  const order = response.order as Order;
  const outcome = simulateOrder(order, stream, scenario.data.streamTimeframe);
  const entry = entryAssessed(order, outcome, stream);
  const trade = ref.trade;

  if (!trade) {
    // A trade where none was defensible: the decision score carries it.
    const tradedMistake: MistakeId = scenario.type === "almost_valid" || scenario.type === "good_location_no_confirmation" ? "NO_CONFIRMATION" : "FORCED_SETUP";
    mistakes.push(tradedMistake);
    if (decision.score <= 35) critical.push("traded where no trade was defensible");
    return {
      dims: [...dims, ...(["entry_location", "stop_placement", "target_selection", "confirmation"] as Dimension[]).map((d) => notApplicable(d, "There was no setup to execute."))],
      outcome,
      entryUsed: entry,
      mistakes,
      critical,
    };
  }

  if (trade.direction !== order.direction) {
    dims.push(result("entry_location", 0, `The setup was a ${trade.direction}; you took a ${order.direction}, so the entry areas don't apply.`));
    for (const d of ["stop_placement", "target_selection", "confirmation"] as Dimension[]) dims.push(notApplicable(d, "Wrong direction: the levels can't be compared."));
    if (decision.score <= 35) critical.push("traded against the only defensible direction");
    return { dims, outcome, entryUsed: entry, mistakes, critical };
  }

  const entryScore = scoreEntry(trade, order, entry, outcome);
  dims.push(entryScore.dimension);
  const stop = scoreStop(trade, order, entry);
  dims.push(stop);
  dims.push(scoreTarget(trade, order, entry));
  const confirmation = scoreConfirmation(trade, outcome);
  dims.push(confirmation.dimension);

  if (confirmation.dimension.applicable && confirmation.dimension.score === 0) {
    critical.push(trade.confirmedAtRevealed === null ? "entered with no confirmation" : "entered before confirmation");
    mistakes.push(trade.confirmedAtRevealed === null ? "NO_CONFIRMATION" : "PREMATURE_ENTRY");
  } else if (confirmation.early > 0) mistakes.push("PREMATURE_ENTRY");
  if (stop.score < 30) {
    critical.push("a stop that doesn't protect the idea");
    mistakes.push("STOP_TOO_TIGHT");
  } else if (stop.score < 50) {
    mistakes.push("STOP_TOO_TIGHT");
  }
  if (entryScore.chased) mistakes.push("CHASED_DISPLACEMENT");
  const targetDim = dims.find((d) => d.dimension === "target_selection");
  if (targetDim && targetDim.score === 0) mistakes.push("WRONG_DRAW");
  if (decision.score <= 35) critical.push("traded where the decision wasn't supported");

  // Trading into structure that weakens the idea.
  const long = order.direction === "long";
  for (const r of ref.annotations) {
    if (r.role !== "invalidating") continue;
    const p = r.price ?? (r.priceLow !== undefined && r.priceHigh !== undefined ? (r.priceLow + r.priceHigh) / 2 : null);
    if (p === null) continue;
    const between = long ? p > entry && p < order.target : p < entry && p > order.target;
    if (between) {
      mistakes.push("IGNORED_OPPOSING_HTF");
      break;
    }
  }

  // Bias contradiction.
  const impliedBias = DIRECTION_BIAS[order.direction];
  const impliedCredit = creditForChoice(ref.bias, impliedBias).credit;
  const clearBias = ref.bias.options.some((o) => o.credit >= 1 && o.value !== "neutral");
  if (impliedCredit === 0 && clearBias) mistakes.push("AGAINST_HTF_BIAS");

  return { dims, outcome, entryUsed: entry, mistakes, critical };
}

// ---- The whole attempt --------------------------------------------------

type StageScore = { dims: DimensionResult[]; marks?: MarkComparison; trade?: TradeScore; mistakes: MistakeId[]; critical: string[] };

function replayResponse(r: StageResponse | undefined): ReplayResponse | null {
  return r && r.kind === "replay" ? r : null;
}

function scoreStage(scenario: Scenario, stage: StageConfig, response: StageResponse | undefined, stream: SimCandle[]): StageScore {
  const ref = scenario.reference;
  const dimension = stage.dimension;
  const miss = (d: Dimension, note: string): StageScore => ({ dims: [result(d, 0, note)], mistakes: [], critical: [] });

  switch (stage.scorer) {
    case "bias": {
      const v = response?.kind === "choice" ? response.value : null;
      return { dims: [scoreBias(ref, v)], mistakes: [], critical: [] };
    }
    case "answer_set": {
      if (!dimension || !stage.answerKey) return { dims: [], mistakes: [], critical: [] };
      const v = response?.kind === "choice" ? response.value : null;
      return { dims: [scoreAnswerSet(ref, stage.answerKey, v, dimension)], mistakes: [], critical: [] };
    }
    case "decision": {
      const v = response?.kind === "choice" ? (response.value as Decision) : null;
      if (v === null) return miss("trade_selection", "No call made.");
      return { dims: [scoreDecision(ref, v)], mistakes: [], critical: [] };
    }
    case "marks_liquidity":
    case "marks_poi":
    case "marks_all":
    case "marks_filter": {
      if (stage.input.kind !== "mark") return { dims: [], mistakes: [], critical: [] };
      const dim: Dimension =
        dimension ??
        (stage.scorer === "marks_liquidity" ? "liquidity_read" : stage.scorer === "marks_poi" ? "poi_selection" : stage.scorer === "marks_filter" ? "annotation_filter" : "annotation_coverage");
      const marks = response?.kind === "mark" ? response.annotations : [];
      const scored = scoreMarksDimension(ref, marks, { refKinds: stage.input.refKinds, dimension: dim, strict: stage.scorer === "marks_filter" });
      return { dims: [scored.dimension], marks: scored.comparison, mistakes: [], critical: [] };
    }
    case "price_range": {
      if (!dimension || !stage.answerKey) return { dims: [], mistakes: [], critical: [] };
      const v = response?.kind === "price" ? response.price : null;
      return { dims: [scorePriceRange(ref, stage.answerKey, v, dimension)], mistakes: [], critical: [] };
    }
    case "confluence": {
      const picked = response?.kind === "multi" ? response.values : [];
      return { dims: [scoreConfluences(ref, picked).dimension], mistakes: [], critical: [] };
    }
    case "candidates": {
      const picked = response?.kind === "multi" ? response.values : [];
      return { dims: [scoreCandidates(ref, picked).dimension], mistakes: [], critical: [] };
    }
    case "trade": {
      const r = response?.kind === "trade" ? response : null;
      if (!r) return miss("trade_selection", "No call made.");
      const t = scoreTrade(scenario, r, stream);
      return { dims: t.dims, trade: t, mistakes: t.mistakes, critical: t.critical };
    }
    case "replay": {
      const r = replayResponse(response);
      if (!r) return miss("trade_selection", "No call made.");
      const dims: DimensionResult[] = [scoreBias(ref, r.bias)];
      const live = scoreMarksDimension(ref, r.annotations, { refKinds: ["liquidity", "swing_high", "swing_low"], dimension: "liquidity_read" }, r.decidedAtRevealed);
      const poi = scoreMarksDimension(ref, r.annotations, { refKinds: ["fvg", "ob", "zone"], dimension: "poi_selection" }, r.decidedAtRevealed);
      dims.push(live.dimension, poi.dimension);
      const t = scoreTrade(scenario, r, stream);
      // POI: a trade entered inside a key area counts for it even if the user never drew it.
      if (t.entryUsed !== null && scenario.reference.trade) {
        const inArea = creditForRange(scenario.reference.trade.entry, t.entryUsed);
        const idx = dims.findIndex((d) => d.dimension === "poi_selection");
        const drawn = poi.dimension;
        if (inArea.inside && (!drawn.applicable || drawn.score < 60)) {
          const credit = Math.max(drawn.applicable ? drawn.score / 100 : 0, 0.6);
          dims[idx] = result("poi_selection", credit, `You traded from the right area${drawn.applicable && drawn.score > 0 ? "" : " without marking it"}. Marking the array first is the habit to build. ${drawn.applicable ? drawn.note : ""}`.trim());
        }
      }
      dims.push(...t.dims);
      const merged = mergeComparisons(live.comparison, poi.comparison);
      return { dims, marks: merged, trade: t, mistakes: t.mistakes, critical: t.critical };
    }
  }
}

/** Joins two comparisons made over disjoint kinds (lines, then zones). */
function mergeComparisons(a: MarkComparison, b: MarkComparison): MarkComparison {
  const dedupe = <T extends { id: string }>(xs: T[]) => [...new Map(xs.map((x) => [x.id, x])).values()];
  return {
    matched: [...a.matched, ...b.matched],
    missed: dedupe([...a.missed, ...b.missed]),
    irrelevant: [...a.irrelevant, ...b.irrelevant],
    trapped: [...a.trapped, ...b.trapped],
    unmatched: [...a.unmatched, ...b.unmatched],
    invalidating: dedupe([...a.invalidating, ...b.invalidating]),
  };
}

/** The weighted process score over the applicable dimensions, then the caps
 * that critical failures impose. */
export function processScore(
  dimensions: DimensionResult[],
  critical: string[],
  weights: Partial<Record<Dimension, number>> = {},
): { score: number; caps: string[] } {
  const applicable = dimensions.filter((d) => d.applicable);
  if (applicable.length === 0) return { score: 0, caps: [] };
  let total = 0;
  let weightSum = 0;
  for (const d of applicable) {
    const w = weights[d.dimension] ?? DIMENSION_WEIGHTS[d.dimension];
    total += d.score * w;
    weightSum += w;
  }
  let score = weightSum > 0 ? total / weightSum : 0;
  const caps: string[] = [];
  if (critical.length >= 2) {
    if (score > CRITICAL_CAPS.two) caps.push(`Capped at ${CRITICAL_CAPS.two}: ${critical.join(" and ")}.`);
    score = Math.min(score, CRITICAL_CAPS.two);
  } else if (critical.length === 1) {
    if (score > CRITICAL_CAPS.one) caps.push(`Capped at ${CRITICAL_CAPS.one}: ${critical[0]}.`);
    score = Math.min(score, CRITICAL_CAPS.one);
  }
  return { score: Math.round(score), caps };
}

function skillEvidence(scenario: Scenario, dims: DimensionResult[]): SkillEvidence[] {
  const out: SkillEvidence[] = [];
  for (const d of dims) {
    if (!d.applicable) continue;
    for (const { skill, weight } of DIMENSION_SKILLS[d.dimension]) {
      const scenarioWeight = scenario.skills[skill] ?? 0.4;
      out.push({ skill, score: d.score / 100, weight: weight * scenarioWeight });
    }
  }
  return out;
}

/** Scores a finished attempt. Pure; the server runs it, the review reads it. */
export function scoreAttempt(scenario: Scenario, mode: ModeConfig, response: AttemptResponse): AttemptResult {
  const stream = scenario.data.stream.map(fromRow);
  const dims: DimensionResult[] = [];
  const mistakes: MistakeId[] = [];
  const critical: string[] = [];
  let marks: MarkComparison | null = null;
  let outcome: TradeOutcome = { status: "no_order" };
  let decision: Decision | null = null;
  let order: Order | null = null;

  for (const stage of mode.stages) {
    const stageResponse = response.stages[stage.id];
    const s = scoreStage(scenario, stage, stageResponse, stream);
    for (const d of s.dims) {
      const existing = dims.findIndex((x) => x.dimension === d.dimension);
      if (existing === -1) dims.push(d);
      else if (d.applicable) {
        const prev = dims[existing];
        // Two stages on one dimension: average, keeping the weaker note.
        dims[existing] = prev.applicable ? { ...prev, score: Math.round((prev.score + d.score) / 2), verdict: verdictFor(Math.round((prev.score + d.score) / 2)), note: d.score <= prev.score ? d.note : prev.note } : d;
      }
    }
    if (s.marks) marks = marks ? mergeComparisons(marks, s.marks) : s.marks;
    if (s.trade) outcome = s.trade.outcome;
    mistakes.push(...s.mistakes);
    critical.push(...s.critical);
    if (stageResponse && (stageResponse.kind === "trade" || stageResponse.kind === "replay")) {
      decision = stageResponse.decision;
      order = stageResponse.order;
    }
    if (stageResponse?.kind === "choice" && stage.scorer === "decision") decision = stageResponse.value as Decision;
  }

  // Authored mistakes for the decision this user made in this scenario.
  const authored = decision ? scenario.trapMistakes[decision] : undefined;
  if (authored && (decision === "long" || decision === "short" ? order !== null : true)) {
    const decisionDim = dims.find((d) => d.dimension === "trade_selection");
    if (!decisionDim || decisionDim.score < 80) mistakes.push(...authored);
  }

  const unique = [...new Set(mistakes)];
  const weights = mode.weights ?? {};
  const { score, caps } = processScore(dims, critical, weights);

  const noTradeScenario = scenario.reference.trade === null;
  const correctAvoidance = noTradeScenario && decision !== null ? decision === "no_trade" || decision === "wait" || order === null : null;

  const base: AttemptResult = {
    scenarioId: scenario.id,
    modeId: mode.id,
    score,
    verdict: verdictFor(score),
    dimensions: dims,
    caps,
    mistakes: unique,
    outcome,
    marks,
    review: { readCorrectly: [], missed: [], presentButIrrelevant: [], weakenedSetup: [], lookForNextTime: [] },
    skillEvidence: skillEvidence(scenario, dims),
    confidence: response.confidence,
    correctAvoidance,
    noTradeScenario,
  };
  base.review = buildReview(scenario, base);
  return base;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
