export function MigrationPrompt({
  count,
  migrating,
  error,
  onMigrate,
  onDismiss,
}: {
  count: number;
  migrating: boolean;
  error: string | null;
  onMigrate: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-6 rounded-lg border border-line bg-surface p-4 sm:p-5">
      <p className="text-sm font-medium text-foreground">
        Found {count} practice {count === 1 ? "attempt" : "attempts"} saved on this device.
      </p>
      <p className="mt-1 text-sm text-muted">
        Migrate them to your account? They&apos;ll be removed from this device afterward.
      </p>

      {error && (
        <p className="mt-2 text-sm" style={{ color: "#e2685f" }}>
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onMigrate}
          disabled={migrating}
          className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {migrating ? "Migrating…" : "Migrate"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={migrating}
          className="inline-flex items-center justify-center rounded-md border border-line px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
