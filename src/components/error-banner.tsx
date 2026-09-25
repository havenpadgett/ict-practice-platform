export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="card">
      <p className="text-sm font-medium text-danger">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 btn-secondary"
        >
          Try again
        </button>
      )}
    </div>
  );
}
