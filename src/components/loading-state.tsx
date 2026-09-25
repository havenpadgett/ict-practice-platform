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
   * layout — a row of stat cards and two section blocks. */
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Block key={i} className="h-[6.125rem] sm:h-[6.875rem]" />
              ))}
            </div>
            <Block className="mt-8 h-44" />
            <Block className="mt-8 h-32" />
          </>
        )}
      </div>
    </div>
  );
}
