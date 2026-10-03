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
        {count} {count === 1 ? "result" : "results"} from before you signed in {count === 1 ? "is" : "are"} saved on this device.
      </p>
      <p className="mt-1 text-sm text-muted">
        Add {count === 1 ? "it" : "them"} to your account? {count === 1 ? "It" : "They"}&apos;ll be removed from this device afterward.
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
          {migrating ? "Saving…" : "Save to my account"}
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
