// Correct / could improve / incorrect, shown so it reads without color: an
// icon shape (check / tilde / cross) plus a word, with color only
// reinforcing it. Three states (Phase B, docs/APP_PERFECTION_PLAN.md)
// replace the old boolean — a "could improve" verdict means the process or
// answer was fundamentally sound, just not optimal, and is drawn as its own
// middle state rather than folded into pass or fail.

import type { Verdict3 } from "@/lib/verdict";

type IconStatus = "correct" | "could_improve" | "incorrect" | "info";

function Icon({ status, size }: { status: IconStatus; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0">
      <circle cx="8" cy="8" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {status === "correct" ? (
        <path d="M4.75 8.25 7 10.5l4.25-4.75" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      ) : status === "incorrect" ? (
        <path d="M5.5 5.5l5 5m0-5-5 5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      ) : status === "could_improve" ? (
        <path d="M4.5 9.25c.9-1.5 1.8-1.5 2.7 0s1.8 1.5 2.7 0 1.8-1.5 2.7 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M5 8h6" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      )}
    </svg>
  );
}

const TONE: Record<Verdict3, string> = {
  correct: "text-accent",
  could_improve: "text-warn",
  incorrect: "text-danger",
};

const DEFAULT_LABEL: Record<Verdict3, string> = {
  correct: "Correct",
  could_improve: "Could improve",
  incorrect: "Incorrect",
};

/** The headline verdict of a graded answer. `label` overrides the default
 * word (e.g. "Process passed" / "Process passed — could improve" /
 * "Process failed" for Guided Entry and Free Trade). */
export function Verdict({ verdict, label }: { verdict: Verdict3; label?: string }) {
  return (
    <p className={`flex items-center gap-2.5 text-lg font-semibold tracking-tight ${TONE[verdict]}`}>
      <Icon status={verdict} size={22} />
      {label ?? DEFAULT_LABEL[verdict]}
    </p>
  );
}

/** One line in a list of graded steps or checks. `verdict: null` is a
 * measurement shown for information, with a neutral dash and no verdict. */
export function CheckRow({ verdict, label, children }: { verdict: Verdict3 | null; label: string; children?: React.ReactNode }) {
  const status: IconStatus = verdict ?? "info";
  const tone = verdict === null ? "text-muted" : TONE[verdict];
  return (
    <li className="flex gap-3">
      <span className={`mt-0.5 ${tone}`}>
        <Icon status={status} size={16} />
      </span>
      <div>
        <p className="text-sm font-medium text-foreground">
          {label} {verdict !== null && <span className={tone}>· {DEFAULT_LABEL[verdict].toLowerCase()}</span>}
        </p>
        {children && <p className="mt-0.5 text-sm text-muted">{children}</p>}
      </div>
    </li>
  );
}
