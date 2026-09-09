import type { SessionState } from "@/lib/storage";

export function SessionSummary({
  session,
  onPracticeAgain,
}: {
  session: SessionState;
  onPracticeAgain: () => void;
}) {
  const total = session.exercise_order.length;

  return (
    <div className="rounded-lg border border-line bg-surface p-5 sm:p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        Session Complete
      </p>
      <p className="mt-2 text-3xl font-semibold text-foreground">
        {session.correct_count}
        <span className="text-muted"> / {total}</span>
      </p>

      {session.missed_exercise_ids.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm text-muted">Missed:</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {session.missed_exercise_ids.map((id) => (
              <li
                key={id}
                className="rounded border border-line px-2 py-1 text-xs text-foreground/85"
              >
                {id}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Perfect session — no misses.</p>
      )}

      <button
        type="button"
        onClick={onPracticeAgain}
        className="mt-6 inline-flex items-center justify-center rounded-md bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
      >
        Practice again
      </button>
    </div>
  );
}
