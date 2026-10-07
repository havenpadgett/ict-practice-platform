// Acceptable answers: ranges with a soft edge, sets with credit, and the
// matching of a user's marks against a reference analysis that allows several
// valid readings. Pure. Nothing here knows about a mode.

import {
  DEFAULT_PRICE_TOLERANCE_RATIO,
  LABEL_MISMATCH_CREDIT,
  MARKS,
  NEAR_MISS_MAX_CREDIT,
  ZONE_MAX_HEIGHT_RATIO,
  ZONE_MIN_COVERAGE,
} from "@/lib/engine/config";
import { TIMEFRAME_MINUTES } from "@/lib/engine/time";
import type {
  AcceptableRange,
  AcceptableSet,
  Annotation,
  AnnotationKind,
  MarkComparison,
  MatchedMark,
  RefAnnotation,
} from "@/lib/engine/types";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// ---- Sets ---------------------------------------------------------------

/** Credit for a choice against a set of defensible answers. Not listed = 0. */
export function creditForChoice<T extends string>(set: AcceptableSet<T>, value: string | null | undefined): { credit: number; note: string | null } {
  if (value === null || value === undefined) return { credit: 0, note: null };
  const option = set.options.find((o) => o.value === value);
  return option ? { credit: clamp01(option.credit), note: option.note ?? null } : { credit: 0, note: null };
}

/** The options worth full credit, for "acceptable answers were…". */
export function fullCreditValues<T extends string>(set: AcceptableSet<T>): T[] {
  return set.options.filter((o) => o.credit >= 1).map((o) => o.value);
}

/** Every defensible option (credit above zero), best first. */
export function defensibleValues<T extends string>(set: AcceptableSet<T>): T[] {
  return [...set.options]
    .filter((o) => o.credit > 0)
    .sort((a, b) => b.credit - a.credit)
    .map((o) => o.value);
}

// ---- Ranges -------------------------------------------------------------

export type RangeCredit = {
  credit: number;
  /** Inside the band. */
  inside: boolean;
  /** Points outside the nearest band (0 when inside). */
  distance: number;
  range: AcceptableRange | null;
};

/** Credit for a price against several acceptable bands: inside earns the
 * band's credit, a near miss within `soft` decays linearly from
 * NEAR_MISS_MAX_CREDIT, anything further earns nothing. The best band wins,
 * so a scenario with two valid entry areas never penalises the second. */
export function creditForRange(ranges: AcceptableRange[], price: number): RangeCredit {
  let best: RangeCredit = { credit: 0, inside: false, distance: Infinity, range: null };
  for (const range of ranges) {
    const base = range.credit ?? 1;
    const inside = price >= range.low && price <= range.high;
    const distance = inside ? 0 : price < range.low ? range.low - price : price - range.high;
    let credit = 0;
    if (inside) credit = base;
    else if (range.soft > 0 && distance <= range.soft) credit = base * NEAR_MISS_MAX_CREDIT * (1 - distance / range.soft);
    const better = credit > best.credit || (credit === best.credit && distance < best.distance);
    if (better) best = { credit, inside, distance, range };
  }
  return best;
}

// ---- Mark matching ------------------------------------------------------

const ZONE_KINDS: AnnotationKind[] = ["zone", "fvg", "ob"];
/** Kinds that are drawn for scoring; notes and position tools are not marks. */
export const SCORED_KINDS: AnnotationKind[] = ["liquidity", "zone", "fvg", "ob", "swing_high", "swing_low"];

const isZone = (k: AnnotationKind) => ZONE_KINDS.includes(k);

/** How a user's kind relates to a reference kind: full credit, a label
 * mismatch worth less, or no relation. */
function kindCredit(user: AnnotationKind, ref: AnnotationKind): number {
  if (user === ref) return 1;
  if (isZone(user) && isZone(ref)) return LABEL_MISMATCH_CREDIT;
  // A swing marker stands in, at less credit, for the liquidity resting on it.
  if (ref === "liquidity" && (user === "swing_high" || user === "swing_low")) return LABEL_MISMATCH_CREDIT;
  if (user === "liquidity" && (ref === "swing_high" || ref === "swing_low")) return LABEL_MISMATCH_CREDIT;
  return 0;
}

function priceOf(a: { price?: number; priceLow?: number; priceHigh?: number }): number | null {
  if (a.price !== undefined) return a.price;
  if (a.priceLow !== undefined && a.priceHigh !== undefined) return (a.priceLow + a.priceHigh) / 2;
  return null;
}

function priceTolerance(ref: RefAnnotation): number {
  if (ref.priceTolerance !== undefined) return ref.priceTolerance;
  const p = priceOf(ref) ?? 0;
  return Math.abs(p) * DEFAULT_PRICE_TOLERANCE_RATIO;
}

/** Time distance in minutes between a user's anchor and a reference moment.
 * A mark on a coarse candle covers that candle's whole span, so a swing that
 * happened anywhere inside it is on time. */
function timeDistance(user: Annotation, refT: number): number {
  if (user.t === undefined) return 0;
  const span = user.tf ? TIMEFRAME_MINUTES[user.tf] : 0;
  if (refT >= user.t && refT < user.t + Math.max(span, 1)) return 0;
  return refT < user.t ? user.t - refT : refT - (user.t + Math.max(span, 1) - 1);
}

/** Match quality in (0, 1], or 0 when this user mark is not a reading of
 * this reference mark. */
export function matchQuality(user: Annotation, ref: RefAnnotation): number {
  const kc = kindCredit(user.kind, ref.kind);
  if (kc === 0) return 0;

  if (isZone(ref.kind)) {
    if (ref.priceLow === undefined || ref.priceHigh === undefined) return 0;
    if (user.priceLow === undefined || user.priceHigh === undefined) return 0;
    const refHeight = ref.priceHigh - ref.priceLow;
    const userHeight = user.priceHigh - user.priceLow;
    if (refHeight <= 0 || userHeight <= 0) return 0;
    const overlap = Math.min(user.priceHigh, ref.priceHigh) - Math.max(user.priceLow, ref.priceLow);
    if (overlap <= 0) return 0;
    const coverage = overlap / refHeight;
    if (coverage < ZONE_MIN_COVERAGE || userHeight / refHeight > ZONE_MAX_HEIGHT_RATIO) return 0;
    if (ref.tStart !== undefined && ref.tEnd !== undefined && user.tStart !== undefined && user.tEnd !== undefined) {
      const pad = ref.timeTolerance ?? 0;
      if (user.tEnd < ref.tStart - pad || user.tStart > ref.tEnd + pad) return 0;
    }
    // Tighter fit scores higher, so the closest of several marks is chosen.
    const fit = coverage * (1 / Math.max(1, userHeight / refHeight));
    return kc * (0.5 + 0.5 * clamp01(fit));
  }

  const refPrice = priceOf(ref);
  const userPrice = priceOf(user);
  if (refPrice === null || userPrice === null) return 0;
  const tol = priceTolerance(ref);
  const dp = Math.abs(userPrice - refPrice);
  if (dp > tol) return 0;
  if (ref.kind === "swing_high" || ref.kind === "swing_low") {
    if (ref.t !== undefined && user.t !== undefined) {
      if (timeDistance(user, ref.t) > (ref.timeTolerance ?? 90)) return 0;
    }
  }
  return kc * (1 - 0.4 * (dp / Math.max(tol, 1e-9)));
}

const ROLE_ORDER: Record<RefAnnotation["role"], number> = { key: 0, valid: 1, supporting: 2, trap: 3, irrelevant: 4, invalidating: 5 };

/** Compares a user's marks with the reference annotations. Several users
 * marks may not claim one reference (the extras are duplicates, ignored),
 * one mark can match only one reference, and equally valid alternatives
 * (a group) are satisfied by matching any of them. */
export function compareMarks(user: Annotation[], refs: RefAnnotation[], opts: { revealed?: number } = {}): MarkComparison {
  const scorable = user.filter((a) => SCORED_KINDS.includes(a.kind) && !a.hindsight);
  const live = refs.filter((r) => opts.revealed === undefined || (r.visibleAtRevealed ?? 0) <= opts.revealed || r.role === "invalidating");

  type Pair = { u: number; r: number; q: number };
  const pairs: Pair[] = [];
  scorable.forEach((u, ui) =>
    live.forEach((r, ri) => {
      const q = matchQuality(u, r);
      if (q > 0) pairs.push({ u: ui, r: ri, q });
    }),
  );
  // Best fit first; a more important role wins a tie.
  pairs.sort((a, b) => b.q - a.q || ROLE_ORDER[live[a.r].role] - ROLE_ORDER[live[b.r].role]);

  const userUsed = new Set<number>();
  const refUsed = new Map<number, Pair>();
  const duplicate = new Set<number>();
  for (const p of pairs) {
    if (userUsed.has(p.u)) continue;
    if (refUsed.has(p.r)) {
      // Another mark already claims this reference: this one is a duplicate.
      duplicate.add(p.u);
      userUsed.add(p.u);
      continue;
    }
    userUsed.add(p.u);
    refUsed.set(p.r, p);
  }

  const matched: MatchedMark[] = [];
  const irrelevant: MarkComparison["irrelevant"] = [];
  const trapped: MarkComparison["trapped"] = [];
  for (const [ri, p] of refUsed) {
    const ref = live[ri];
    const userMark = scorable[p.u];
    if (ref.role === "irrelevant") irrelevant.push({ user: userMark, ref });
    else if (ref.role === "trap") trapped.push({ user: userMark, ref });
    else if (ref.role === "invalidating") matched.push({ user: userMark, ref, credit: p.q });
    else matched.push({ user: userMark, ref, credit: p.q });
  }

  // Missed: key references never matched, and groups where too few were.
  const matchedRefIds = new Set(matched.map((m) => m.ref.id));
  const missed: RefAnnotation[] = [];
  const groups = new Map<string, RefAnnotation[]>();
  for (const r of live) {
    if (r.role === "key" && !r.group && !matchedRefIds.has(r.id)) missed.push(r);
    if (r.group && (r.role === "key" || r.role === "valid")) {
      const list = groups.get(r.group) ?? [];
      list.push(r);
      groups.set(r.group, list);
    }
  }
  for (const list of groups.values()) {
    const need = Math.max(...list.map((r) => r.minInGroup ?? 1));
    const have = list.filter((r) => matchedRefIds.has(r.id)).length;
    if (have < need) missed.push(list.find((r) => !matchedRefIds.has(r.id)) ?? list[0]);
  }

  const unmatched = scorable.filter((_, i) => !userUsed.has(i));
  const invalidating = live.filter((r) => r.role === "invalidating");
  return { matched, missed, irrelevant, trapped, unmatched, invalidating };
}

/** Credit 0-1 for a mark comparison, and what drove it. `required` is false
 * when the reference holds nothing the user had to mark. `refs` and the
 * comparison are already scoped to the kinds being scored. `penaltyScale`
 * raises the cost of marking what doesn't matter (false-positive training). */
export function scoreMarks(
  comparison: MarkComparison,
  refs: RefAnnotation[],
  opts: { penaltyScale?: number } = {},
): { credit: number; required: boolean; falsePositives: number; recall: number } {
  // Required items: each ungrouped key mark, and each group once.
  let required = 0;
  let earned = 0;
  const groups = new Map<string, RefAnnotation[]>();
  for (const r of refs) {
    if (r.group && (r.role === "key" || r.role === "valid")) {
      const l = groups.get(r.group) ?? [];
      l.push(r);
      groups.set(r.group, l);
    } else if (r.role === "key") {
      required += MARKS.keyWeight;
      const m = comparison.matched.find((x) => x.ref.id === r.id);
      if (m) earned += MARKS.keyWeight * m.credit;
    }
  }
  for (const list of groups.values()) {
    const need = Math.max(...list.map((r) => r.minInGroup ?? 1));
    required += MARKS.groupWeight * need;
    const hits = list.map((r) => comparison.matched.find((x) => x.ref.id === r.id)).filter((m): m is MatchedMark => Boolean(m)).sort((a, b) => b.credit - a.credit);
    earned += MARKS.groupWeight * hits.slice(0, need).reduce((s, m) => s + m.credit, 0);
  }

  const scale = opts.penaltyScale ?? 1;
  const falsePositives = comparison.unmatched.length;
  const trapped = comparison.trapped.length;
  const irrelevant = comparison.irrelevant.length;
  const penalty = Math.min(
    Math.min(0.9, MARKS.penaltyCap * scale),
    scale * (falsePositives * MARKS.falsePositivePenalty + trapped * MARKS.trapPenalty + irrelevant * MARKS.irrelevantPenalty),
  );
  const supporting = comparison.matched.filter((m) => m.ref.role === "supporting").length;
  const bonus = Math.min(MARKS.supportingBonusCap, supporting * MARKS.supportingBonus);

  const recall = required > 0 ? earned / required : 1;
  return { credit: clamp01(recall - penalty + bonus), required: required > 0, falsePositives: falsePositives + trapped, recall };
}

/** The user marks a scorer should read for a set of reference kinds: the
 * same family (lines and swing markers, or the zone kinds). */
export function marksInScope(user: Annotation[], refKinds: AnnotationKind[]): Annotation[] {
  const line = refKinds.some((k) => k === "liquidity" || k === "swing_high" || k === "swing_low");
  const zone = refKinds.some((k) => isZone(k));
  return user.filter((a) => refKinds.includes(a.kind) || (line && (a.kind === "liquidity" || a.kind === "swing_high" || a.kind === "swing_low")) || (zone && isZone(a.kind)));
}
