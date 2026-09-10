export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
      <p className="text-sm font-medium" style={{ color: "#e2685f" }}>
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex items-center justify-center rounded-md border border-line px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background"
        >
          Try again
        </button>
      )}
    </div>
  );
}
