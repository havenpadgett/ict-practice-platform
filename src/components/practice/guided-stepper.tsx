export type StepperItem = { id: string; label: string; value: string | null; state: "done" | "current" | "todo" };

/** Bias ✓ / Entry ● / Stop / Target, with what's been chosen so far. */
export function GuidedStepper({ steps }: { steps: StepperItem[] }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Setup steps">
      {steps.map((step, i) => (
        <li key={step.id} aria-current={step.state === "current" ? "step" : undefined} className="min-w-0">
          <div className={`h-0.5 rounded-full ${step.state === "todo" ? "bg-line" : "bg-accent"}`} aria-hidden />
          <p className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${step.state === "todo" ? "text-muted" : "text-foreground"}`}>
            <span aria-hidden className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
              {step.state === "done" ? (
                <svg viewBox="0 0 16 16" width={14} height={14} className="text-accent">
                  <path d="M3.5 8.5 6.5 11.5l6-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : step.state === "current" ? (
                <span className="h-2 w-2 rounded-full bg-accent" />
              ) : (
                <span className="h-2 w-2 rounded-full border border-control" />
              )}
            </span>
            <span className="truncate">
              <span className="sr-only">Step {i + 1}: </span>
              {step.label}
              <span className="sr-only">{step.state === "done" ? ", done" : step.state === "current" ? ", current" : ""}</span>
            </span>
          </p>
          <p className="mt-0.5 truncate pl-5.5 text-xs text-muted tabular-nums">{step.value ?? " "}</p>
        </li>
      ))}
    </ol>
  );
}
