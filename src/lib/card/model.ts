// What a share card shows, built from a request that carries no free text:
// ids, numbers, a date and the learner's own marks. Everything else (the
// chart, the verdict, the wording) is derived here from the exercise and
// the deterministic grade, so a card can only say what the grader would say
// about that mark. The key appears on a card exactly when it would appear in
// the feedback for the same answer: only for shareable exercises
// (src/lib/challenge.ts), and only alongside the learner's own mark.

import type { Candle } from "@/data/exercises";
import { isGuidedAnswer, isNum, isUserAnswer } from "@/lib/answer-validation";
import { firstSentence } from "@/lib/first-sentence";
import { shareableExercise } from "@/lib/challenge-source";
import type { CardMarks } from "@/lib/card/chart";
import { CONCEPT_LIST, conceptDisplayName, conceptShortName, DIFFICULTY_LABELS, type Concept } from "@/lib/concepts";
import { pickFrame, zoneToFrame, type Frame } from "@/lib/framing";
import { gradeAttempt, type UserAnswer } from "@/lib/grading";
import { gradeGuidedAttempt, type GuidedUserAnswer } from "@/lib/guided-grading";
import type { Verdict3 } from "@/lib/verdict";

export type CardAnswer = { mode: "recognition"; answer: UserAnswer } | { mode: "guided"; answer: GuidedUserAnswer };

/** A session as the summary knows it. `kind` is a concept or one of the
 * mixed session kinds; nothing the learner typed. */
export type SessionKind = Concept | "Adaptive" | "Mistakes" | "Mixed";
const SESSION_KINDS: string[] = [...CONCEPT_LIST, "Adaptive", "Mistakes", "Mixed"];

export type CardRequest =
  | {
      kind: "result";
      exerciseId: string;
      answer: CardAnswer;
      /** The session whose framing the learner saw (src/lib/framing.ts); absent for a public challenge, which is shown whole. */
      sessionId?: string;
      /** Marks the card as the daily challenge for that UTC date. */
      daily?: { date: string; streak: number };
    }
  | {
      kind: "session";
      session: SessionKind;
      correct: number;
      answered: number;
      concepts: { concept: Concept; correct: number; total: number }[];
      featured?: { exerciseId: string; sessionId: string; answer: CardAnswer };
    };

export type CardData = {
  eyebrow: string;
  tone: Verdict3 | "neutral";
  /** The big line: a verdict word or a score. */
  headline: string;
  sub: string | null;
  detail: string | null;
  badge: string | null;
  chips: string[];
  chart: { candles: Candle[]; marks: CardMarks } | null;
};

const SESSION_TITLES: Record<string, string> = {
  Adaptive: "Adaptive practice",
  Mistakes: "Review mistakes",
  Mixed: "Mixed concepts",
};

function readCardAnswer(x: unknown): CardAnswer | null {
  if (typeof x !== "object" || x === null) return null;
  const a = x as Record<string, unknown>;
  if (a.mode === "recognition" && isUserAnswer(a.answer)) return { mode: "recognition", answer: a.answer };
  if (a.mode === "guided" && isGuidedAnswer(a.answer)) return { mode: "guided", answer: a.answer };
  return null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Strict: anything unexpected is a null, never a best guess. */
export function parseCardRequest(raw: unknown): CardRequest | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.kind === "result") {
    const answer = readCardAnswer(r.answer);
    if (typeof r.exerciseId !== "string" || !answer) return null;
    if (r.sessionId !== undefined && (typeof r.sessionId !== "string" || r.sessionId.length > 100)) return null;
    let daily: { date: string; streak: number } | undefined;
    if (r.daily !== undefined) {
      const d = r.daily as Record<string, unknown> | null;
      if (!d || typeof d.date !== "string" || !DATE.test(d.date) || !isNum(d.streak)) return null;
      daily = { date: d.date, streak: Math.max(0, Math.min(9999, Math.floor(d.streak))) };
    }
    return { kind: "result", exerciseId: r.exerciseId, answer, sessionId: r.sessionId as string | undefined, daily };
  }
  if (r.kind === "session") {
    if (typeof r.session !== "string" || !SESSION_KINDS.includes(r.session)) return null;
    if (!isNum(r.correct) || !isNum(r.answered)) return null;
    const answered = Math.floor(r.answered);
    const correct = Math.floor(r.correct);
    if (answered < 1 || answered > 200 || correct < 0 || correct > answered) return null;
    if (!Array.isArray(r.concepts) || r.concepts.length > CONCEPT_LIST.length) return null;
    const concepts: { concept: Concept; correct: number; total: number }[] = [];
    for (const c of r.concepts) {
      const x = c as Record<string, unknown>;
      if (!x || !CONCEPT_LIST.includes(x.concept as Concept) || !isNum(x.correct) || !isNum(x.total)) return null;
      const total = Math.floor(x.total);
      const ok = Math.floor(x.correct);
      if (total < 1 || total > 200 || ok < 0 || ok > total) return null;
      concepts.push({ concept: x.concept as Concept, correct: ok, total });
    }
    let featured: { exerciseId: string; sessionId: string; answer: CardAnswer } | undefined;
    if (r.featured !== undefined) {
      const f = r.featured as Record<string, unknown> | null;
      const answer = f ? readCardAnswer(f.answer) : null;
      if (!f || typeof f.exerciseId !== "string" || typeof f.sessionId !== "string" || f.sessionId.length > 100 || !answer) return null;
      featured = { exerciseId: f.exerciseId, sessionId: f.sessionId, answer };
    }
    return { kind: "session", session: r.session as SessionKind, correct, answered, concepts, featured };
  }
  return null;
}

const RECOGNITION_WORD: Record<Verdict3, string> = { correct: "Correct", could_improve: "Could improve", incorrect: "Incorrect" };
const GUIDED_WORD: Record<Verdict3, string> = { correct: "Process passed", could_improve: "Passed, could improve", incorrect: "Process failed" };

type Shown = { candles: Candle[]; marks: CardMarks; verdict: Verdict3; detail: string; label: string };

/** Grades the answer and lays out the chart as the learner saw it. Null if
 * the exercise can't be shared or the answer doesn't fit it. */
function show(exerciseId: string, answer: CardAnswer, sessionId: string | undefined): (Shown & { concept: Concept; difficulty: 1 | 2 | 3 }) | null {
  const e = shareableExercise(exerciseId);
  if (!e) return null;
  // A public challenge is shown whole; a session's chart was framed by its id.
  const frame: Frame = sessionId ? pickFrame(e, sessionId) : { start: 0, end: e.candles.length - 1 };
  const candles = e.candles.slice(frame.start, frame.end + 1);
  const meta = { concept: e.concept, difficulty: e.difficulty };

  if (answer.mode === "guided") {
    if (e.answer_type !== "guided") return null;
    const grade = gradeGuidedAttempt(e, answer.answer);
    const a = answer.answer;
    const key = e.answer;
    return {
      ...meta,
      candles,
      verdict: grade.verdict,
      label: GUIDED_WORD[grade.verdict],
      detail: firstSentence(grade.explanation),
      marks: {
        userGuided: a.bias === "unclear" ? null : { entry: a.entry, stop: a.stop, target: a.target },
        correctGuided: { entry: key.entry?.anchor ?? null, stop: key.stop?.invalidation_price ?? null, target: key.target?.anchor ?? null },
      },
    };
  }

  if (e.answer_type !== "zone" && e.answer_type !== "level" && e.answer_type !== "choice") return null;
  const a = answer.answer;
  // Drawn answers arrive in the exercise's own candle indices (as recorded).
  const grade = (() => {
    try {
      return gradeAttempt(e, a);
    } catch {
      return null;
    }
  })();
  if (!grade) return null;
  const marks: CardMarks = {};
  if (e.answer_type === "zone") {
    if (a.type === "region") {
      marks.userZone = { ...a.region, candleIndexLow: a.region.candleIndexLow - frame.start, candleIndexHigh: a.region.candleIndexHigh - frame.start };
    }
    if (grade.revealZone && e.answer) marks.correctZone = zoneToFrame(e.answer, frame);
  } else if (e.answer_type === "level") {
    if (a.type === "level") marks.userLevel = a.price;
    if (grade.revealZone && e.answer) marks.correctLevel = e.answer.price;
  } else {
    const z = e.answer.fvg_zone;
    if (z) marks.contextZone = { ...z, candle_start: z.candle_start - frame.start, candle_end: z.candle_end - frame.start };
    const d = e.answer.dealing_range;
    if (d) marks.dealingRange = { ...d, high_index: d.high_index - frame.start, low_index: d.low_index - frame.start };
  }
  return { ...meta, candles, marks, verdict: grade.verdict, label: RECOGNITION_WORD[grade.verdict], detail: firstSentence(grade.failureMessage ?? grade.explanation) };
}

function monthDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function buildCard(req: CardRequest): CardData | null {
  if (req.kind === "result") {
    const s = show(req.exerciseId, req.answer, req.sessionId);
    if (!s) return null;
    return {
      eyebrow: `${conceptDisplayName(s.concept)} · ${DIFFICULTY_LABELS[s.difficulty]}`,
      tone: s.verdict,
      headline: s.label,
      sub: null,
      detail: s.detail,
      badge: req.daily ? `Daily challenge · ${monthDay(req.daily.date)}${req.daily.streak >= 2 ? ` · ${req.daily.streak}-day streak` : ""}` : "Chart challenge",
      chips: [],
      chart: { candles: s.candles, marks: s.marks },
    };
  }

  const pct = Math.round((req.correct / req.answered) * 100);
  const featured = req.featured ? show(req.featured.exerciseId, req.featured.answer, req.featured.sessionId) : null;
  const title = SESSION_TITLES[req.session] ?? `${conceptDisplayName(req.session)} practice`;
  const missed = req.answered - req.correct;
  return {
    eyebrow: `Session complete · ${title}`,
    // Mint for a strong session; otherwise plain. A score is never painted red on an image meant to be shared.
    tone: pct >= 80 ? "correct" : "neutral",
    headline: `${req.correct}/${req.answered}`,
    sub: `${pct}% correct${missed > 0 ? ` · ${missed} missed` : ""}`,
    detail: null,
    badge: null,
    chips: req.concepts.slice(0, 5).map((c) => `${conceptShortName(c.concept)} ${c.correct}/${c.total}`),
    chart: featured ? { candles: featured.candles, marks: featured.marks } : null,
  };
}
