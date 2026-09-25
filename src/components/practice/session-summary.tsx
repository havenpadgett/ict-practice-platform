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
    <div className="card">
      <p className="eyebrow">
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
                className="rounded border border-line px-2 py-1 text-xs text-foreground"
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
        className="mt-6 btn-primary"
      >
        Practice again
      </button>
    </div>
  );
}
