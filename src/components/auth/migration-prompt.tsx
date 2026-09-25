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
    <div className="mb-6 card">
      <p className="text-sm font-medium text-foreground">
        Found {count} practice {count === 1 ? "attempt" : "attempts"} saved on this device.
      </p>
      <p className="mt-1 text-sm text-muted">
        Migrate them to your account? They&apos;ll be removed from this device afterward.
      </p>

      {error && (
        <p className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onMigrate}
          disabled={migrating}
          className="btn-primary"
        >
          {migrating ? "Migrating…" : "Migrate"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={migrating}
          className="btn-secondary"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
