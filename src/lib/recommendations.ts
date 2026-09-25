// Adaptive practice engine. Pure functions over recorded attempts — no UI,
// no fetching (src/lib/attempts.ts owns that). Decisions and their
// reasoning are documented in docs/PRD-MVP-V1.md (Decision Log,
// "Adaptive practice") and are AI-DRAFTED pending Haven's review.
//
//   scoreConcepts        per-concept skill estimate, recency-weighted and
//                        shrunk toward the user's overall accuracy
//   recommendSession     the one next session to do, with a plain-English
//                        reason
//   buildAdaptiveSession an exercise list that leans toward weak concepts
//                        without dropping the strong ones

import { getExercise, getPracticeExercises, type Exercise, type SessionLength } from "@/data/exercises";
import type { DbAttempt } from "@/lib/attempts";
import { CONCEPT_LIST, CONCEPTS, type Concept } from "@/lib/concepts";

/** An attempt this many attempts old (within its concept) counts half as
 * much as the newest one — recent improvement shows within a session or
 * two instead of being averaged away by early mistakes. */
export const HALF_LIFE_ATTEMPTS = 10;
/** Pseudo-attempts at the user's overall accuracy mixed into every
 * concept's score, so a concept with 1-2 attempts can't swing to 0% or
 * 100% and dominate the ranking. */
export const PRIOR_STRENGTH = 4;
/** Recent-accuracy window quoted in the explanation. */
export const RECENT_WINDOW = 20;
/** Below this score a concept is "weak" and gets practiced before anything
 * new is introduced. */
export const WEAK_THRESHOLD = 0.7;
/** Minimum reached attempts before a sub-skill (a Guided Entry step, a Free
 * Trade check) is named as the weak spot. */
const MIN_SUBSKILL_ATTEMPTS = 3;
/** Adaptive sessions: every concept keeps at least this weight, so strong
 * concepts still show up and practice isn't only ever the weakest thing. */
export const ADAPTIVE_FLOOR = 0.15;
/** Adaptive sessions: share of slots given to weak concepts when there are
 * any — the rest always goes to the other concepts. */
export const ADAPTIVE_WEAK_SHARE = 0.6;
/** Free Trade is a long playback; it stays a mode of its own. */
const ADAPTIVE_EXCLUDED: Concept[] = ["FreeTrade"];

export type ConceptScore = {
  concept: Concept;
  attempts: number;
  /** Plain accuracy over every attempt, 0-1. */
  accuracy: number;
  /** Plain accuracy over the last RECENT_WINDOW attempts, 0-1. */
  recentAccuracy: number;
  recentCount: number;
  /** Recency-weighted accuracy shrunk toward overall accuracy, 0-1. */
  score: number;
};

export type SubSkill = { name: string; accuracy: number; count: number };

export type Recommendation = {
  concept: Concept;
  difficulty: 1 | 2 | 3;
  length: SessionLength;
  subSkill: SubSkill | null;
  reason: string;
  /** Link that starts exactly this session. */
  href: string;
};

type Scored = { overall: number | null; total: number; concepts: ConceptScore[] };

function isConcept(value: string): value is Concept {
  return (CONCEPT_LIST as string[]).includes(value);
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** Newest-last input (fetchAttempts returns ascending created_at). */
export function scoreConcepts(attempts: DbAttempt[]): Scored {
  const total = attempts.length;
  if (total === 0) return { overall: null, total, concepts: [] };
  const overall = attempts.filter((a) => a.is_correct).length / total;
  const byConcept = new Map<Concept, DbAttempt[]>();
  for (const a of attempts) {
    if (!isConcept(a.concept)) continue;
    byConcept.set(a.concept, [...(byConcept.get(a.concept) ?? []), a]);
  }
  const concepts: ConceptScore[] = [];
  for (const [concept, list] of byConcept) {
    let wCorrect = 0;
    let wTotal = 0;
    list.forEach((a, i) => {
      const age = list.length - 1 - i;
      const w = Math.pow(0.5, age / HALF_LIFE_ATTEMPTS);
      wTotal += w;
      if (a.is_correct) wCorrect += w;
    });
    const recent = list.slice(-RECENT_WINDOW);
    concepts.push({
      concept,
      attempts: list.length,
      accuracy: list.filter((a) => a.is_correct).length / list.length,
      recentAccuracy: recent.filter((a) => a.is_correct).length / recent.length,
      recentCount: recent.length,
      score: (wCorrect + PRIOR_STRENGTH * overall) / (wTotal + PRIOR_STRENGTH),
    });
  }
  concepts.sort((a, b) => a.score - b.score);
  return { overall, total, concepts };
}

/** Recency-weighted pass rate of each step/check field; the weakest one
 * with enough attempts. */
function weakestSubSkill(attempts: DbAttempt[], fields: { name: string; field: keyof DbAttempt }[]): SubSkill | null {
  let weakest: SubSkill | null = null;
  for (const { name, field } of fields) {
    const reached = attempts.filter((a) => a[field] !== null);
    if (reached.length < MIN_SUBSKILL_ATTEMPTS) continue;
    let w = 0;
    let wc = 0;
    reached.forEach((a, i) => {
      const weight = Math.pow(0.5, (reached.length - 1 - i) / HALF_LIFE_ATTEMPTS);
      w += weight;
      if (a[field] === true) wc += weight;
    });
    const skill = { name, accuracy: wc / w, count: reached.length };
    if (!weakest || skill.accuracy < weakest.accuracy) weakest = skill;
  }
  return weakest;
}

export function getSubSkill(concept: Concept, attempts: DbAttempt[]): SubSkill | null {
  const list = attempts.filter((a) => a.concept === concept);
  if (concept === "GuidedEntry") {
    return weakestSubSkill(list, [
      { name: "bias", field: "guided_bias_correct" },
      { name: "entry", field: "guided_entry_correct" },
      { name: "stop", field: "guided_stop_correct" },
      { name: "target", field: "guided_target_correct" },
    ]);
  }
  if (concept === "FreeTrade") {
    return weakestSubSkill(list, [
      { name: "trade decision", field: "free_decision_correct" },
      { name: "direction", field: "free_direction_correct" },
      { name: "entry", field: "free_entry_correct" },
      { name: "stop", field: "free_stop_correct" },
      { name: "risk-to-reward", field: "free_rr_correct" },
    ]);
  }
  return null;
}

/** " Your last 5 are at 80%, so it's improving." when the newest attempts
 * are clearly better than the window average. */
function trendNote(concept: Concept, attempts: DbAttempt[], windowAccuracy: number): string {
  const last = attempts.filter((a) => a.concept === concept).slice(-5);
  if (last.length < 5) return "";
  const acc = last.filter((a) => a.is_correct).length / last.length;
  return acc - windowAccuracy >= 0.2 ? ` Your last 5 are at ${pct(acc)}, so it's improving; this keeps it going.` : "";
}

function difficultyFor(score: number): 1 | 2 | 3 {
  return score < 0.6 ? 1 : score < 0.8 ? 2 : 3;
}

function lengthFor(concept: Concept, score: number): SessionLength {
  const available = getPracticeExercises(concept).length;
  const wanted = score < 0.6 ? 5 : 10;
  return available <= wanted ? "all" : wanted;
}

function hrefFor(concept: Concept, difficulty: number, length: SessionLength): string {
  return `/practice?concept=${encodeURIComponent(concept)}&difficulty=${difficulty}&length=${length}`;
}

function label(concept: Concept): string {
  return CONCEPTS[concept].pickerLabel;
}

export function recommendSession(attempts: DbAttempt[]): Recommendation {
  const { overall, concepts } = scoreConcepts(attempts);
  if (overall === null) {
    return {
      concept: "FVG",
      difficulty: 1,
      length: 5,
      subSkill: null,
      reason: "You haven't practiced yet. Fair Value Gaps are the foundation the other concepts build on, so start there.",
      href: hrefFor("FVG", 1, 5),
    };
  }
  const weakest = concepts[0];
  const practiced = new Set(concepts.map((c) => c.concept));
  const unpracticed = CONCEPT_LIST.filter((c) => !practiced.has(c) && getPracticeExercises(c).length > 0);

  let concept: Concept;
  let difficulty: 1 | 2 | 3;
  let reason: string;
  let score: number;
  if (weakest.score < WEAK_THRESHOLD || unpracticed.length === 0) {
    concept = weakest.concept;
    score = weakest.score;
    difficulty = difficultyFor(score);
    const sample = weakest.attempts < 5 ? ` (only ${weakest.attempts} attempt${weakest.attempts === 1 ? "" : "s"} so far, so this is a first read)` : "";
    reason =
      weakest.score < WEAK_THRESHOLD
        ? `Your ${label(concept)} accuracy is ${pct(weakest.recentAccuracy)} over your last ${weakest.recentCount} attempt${weakest.recentCount === 1 ? "" : "s"}, below your ${pct(overall)} overall${sample}.${trendNote(concept, attempts, weakest.recentAccuracy)}`
        : `Every concept is at or above ${pct(WEAK_THRESHOLD)}. ${label(concept)} is your lowest at ${pct(weakest.recentAccuracy)} over your last ${weakest.recentCount}, so push it at a harder level.`;
  } else {
    concept = unpracticed[0];
    score = overall;
    difficulty = 1;
    reason = `Nothing you've practiced is below ${pct(WEAK_THRESHOLD)} once sample size is accounted for (lowest: ${label(weakest.concept)}, ${weakest.attempts} attempt${weakest.attempts === 1 ? "" : "s"}), so it's time for something new: you haven't tried ${label(concept)} yet.`;
  }
  const subSkill = getSubSkill(concept, attempts);
  if (subSkill) {
    reason += ` Your weakest step is ${subSkill.name}: ${pct(subSkill.accuracy)} of the ${subSkill.count} times you reached it, recent ones counting most.`;
  }
  const length = lengthFor(concept, score);
  return { concept, difficulty, length, subSkill, reason, href: hrefFor(concept, difficulty, length) };
}

/** Selection weight per concept for an adaptive session: weakness plus a
 * floor. Unpracticed concepts count as the user's overall level. */
export function adaptiveWeights(attempts: DbAttempt[]): Record<Concept, number> {
  const { overall, concepts } = scoreConcepts(attempts);
  const base = overall ?? 0.5;
  const out = {} as Record<Concept, number>;
  for (const concept of CONCEPT_LIST) {
    if (ADAPTIVE_EXCLUDED.includes(concept) || getPracticeExercises(concept).length === 0) continue;
    const score = concepts.find((c) => c.concept === concept)?.score ?? base;
    out[concept] = 1 - score + ADAPTIVE_FLOOR;
  }
  return out;
}

/** A mixed session. When some practiced concepts are weak (score below
 * WEAK_THRESHOLD), ADAPTIVE_WEAK_SHARE of the slots are drawn from them and
 * the rest from everything else; otherwise every slot draws from all
 * concepts. Either way a slot picks a concept in proportion to
 * adaptiveWeights, then an unused exercise from it, preferring the
 * difficulty that matches the concept's score. `random` is injectable for
 * tests. */
export function buildAdaptiveSession(attempts: DbAttempt[], length = 10, random: () => number = Math.random): string[] {
  const weights = adaptiveWeights(attempts);
  const { concepts } = scoreConcepts(attempts);
  const weak = new Set(concepts.filter((c) => c.score < WEAK_THRESHOLD && c.concept in weights).map((c) => c.concept));
  const weakSlots = weak.size > 0 ? Math.round(length * ADAPTIVE_WEAK_SHARE) : 0;
  const pools = new Map<Concept, Exercise[]>(
    (Object.keys(weights) as Concept[]).map((c) => [c, getPracticeExercises(c)]),
  );
  const picked: string[] = [];
  while (picked.length < length) {
    const wantWeak = picked.length < weakSlots;
    let live = (Object.keys(weights) as Concept[]).filter((c) => (pools.get(c) ?? []).length > 0);
    const side = live.filter((c) => weak.has(c) === wantWeak);
    if (side.length > 0 && weak.size > 0) live = side;
    if (live.length === 0) break;
    const total = live.reduce((s, c) => s + weights[c], 0);
    let r = random() * total;
    let concept = live[live.length - 1];
    for (const c of live) {
      r -= weights[c];
      if (r <= 0) {
        concept = c;
        break;
      }
    }
    const pool = pools.get(concept)!;
    const target = difficultyFor(concepts.find((c) => c.concept === concept)?.score ?? 0.5);
    const best = Math.min(...pool.map((e) => Math.abs(e.difficulty - target)));
    const candidates = pool.filter((e) => Math.abs(e.difficulty - target) === best);
    const choice = candidates[Math.floor(random() * candidates.length)];
    pools.set(concept, pool.filter((e) => e !== choice));
    picked.push(choice.exercise_id);
  }
  // Weak-concept slots were filled first; mix them through the session.
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked;
}

/** For display: which concept each id in an adaptive session belongs to. */
export function conceptOf(exerciseId: string): Concept | undefined {
  return getExercise(exerciseId)?.concept;
}
