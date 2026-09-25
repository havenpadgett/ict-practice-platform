// Correct / incorrect, shown so it reads without color: an icon shape
// (check vs cross) plus a word, with color only reinforcing it.

type Status = "pass" | "fail";

function Icon({ status, size }: { status: Status; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden className="shrink-0">
      <circle cx="8" cy="8" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {status === "pass" ? (
        <path d="M4.75 8.25 7 10.5l4.25-4.75" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M5.5 5.5l5 5m0-5-5 5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** The headline verdict of a graded answer. */
export function Verdict({ correct, label }: { correct: boolean; label?: string }) {
  return (
    <p className={`flex items-center gap-2.5 text-lg font-semibold tracking-tight ${correct ? "text-accent" : "text-danger"}`}>
      <Icon status={correct ? "pass" : "fail"} size={22} />
      {label ?? (correct ? "Correct" : "Incorrect")}
    </p>
  );
}

/** One line in a list of graded steps or checks. */
export function CheckRow({ passed, label, children }: { passed: boolean; label: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={`mt-0.5 ${passed ? "text-accent" : "text-danger"}`}>
        <Icon status={passed ? "pass" : "fail"} size={16} />
      </span>
      <div>
        <p className="text-sm font-medium text-foreground">
          {label} <span className={passed ? "text-accent" : "text-danger"}>· {passed ? "correct" : "incorrect"}</span>
        </p>
        {children && <p className="mt-0.5 text-sm text-muted">{children}</p>}
      </div>
    </li>
  );
}
