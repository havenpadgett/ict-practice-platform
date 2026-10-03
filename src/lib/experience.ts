// Beginner or experienced: a preference about the interface, not a record
// of skill. Beginners get more structure, guidance and explanation by
// default; experienced learners get minimal hints, concise feedback with the
// detail on demand, and faster transitions between exercises. Kept on the
// device (so it works signed out), mirrored to the profile when there is one
// (src/contexts/experience-context.tsx). Until it's chosen, the interface is
// the beginner one. Documented in docs/PRD-MVP-V1.md → Experience mode.

export type Experience = "beginner" | "experienced";

export const EXPERIENCE_KEY = "ict-practice:experience";
export const EXPERIENCE_EVENT = "ict:experience-changed";
export const DEFAULT_EXPERIENCE: Experience = "beginner";

export const EXPERIENCE_LEVELS: { value: Experience; label: string; summary: string; details: string[] }[] = [
  {
    value: "beginner",
    label: "New to ICT concepts",
    summary: "More structure and explanation.",
    details: [
      "A short note on what to look for, above each chart.",
      "Full feedback after every answer, with the reasoning shown.",
      "Step-by-step hints in Guided Entry, including the risk distance and the 2R level.",
      "Term definitions underlined, ready on hover.",
    ],
  },
  {
    value: "experienced",
    label: "I know these concepts",
    summary: "Less on screen, faster to the next chart.",
    details: [
      "No hints before you answer.",
      "Short feedback: the verdict, what was off, with the full explanation one click away.",
      "Enter or N moves to the next exercise as soon as feedback shows.",
      "Term definitions stay available on hover, without the underline.",
    ],
  },
];

export function isExperience(x: unknown): x is Experience {
  return x === "beginner" || x === "experienced";
}

/** The saved choice, or null if none (or storage is unavailable). */
export function readExperience(): Experience | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(EXPERIENCE_KEY);
    return isExperience(v) ? v : null;
  } catch {
    return null;
  }
}

export function writeExperience(level: Experience): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EXPERIENCE_KEY, level);
  } catch {
    // Blocked storage: the choice holds for this page view only.
  }
  window.dispatchEvent(new Event(EXPERIENCE_EVENT));
}

/** What the interface changes, in one place, so components ask for a
 * behaviour rather than comparing levels. */
export function behavior(level: Experience) {
  const beginner = level === "beginner";
  return {
    /** The concept's rule above the chart, before answering. */
    showConceptHint: beginner,
    /** Feedback opens with everything: checks, explanation, the rule. */
    fullFeedback: beginner,
    /** Guided Entry's per-step hints and risk guidance. */
    guidedHints: beginner,
    /** Enter / N goes to the next exercise once feedback is showing. */
    quickAdvance: !beginner,
    /** Definition tooltips carry an always-visible underline. */
    underlineTerms: beginner,
  };
}
