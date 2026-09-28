// Loading placeholders. They hold the shape of what's coming (so nothing
// jumps when data arrives) and fade in only after a short delay, so a fast
// load never flashes a skeleton at all.

function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg border border-line bg-surface ${className}`} />;
}

export function LoadingState({
  label = "Loading…",
  variant = "page",
}: {
  label?: string;
  /** page: a title and a content card. stats: the dashboard/analytics
   * layout: a lead card, a metrics strip, then rows. */
  variant?: "page" | "stats";
}) {
  return (
    <div className={variant === "page" ? "page" : undefined} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div className="appear-late" aria-hidden>
        {variant === "page" ? (
          <>
            <div className="h-8 w-48 animate-pulse rounded-md bg-surface" />
            <Block className="mt-8 h-72" />
          </>
        ) : (
          <>
            <Block className="h-56" />
            <Block className="mt-section h-28" />
            <div className="mt-section space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded-md bg-surface" />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
