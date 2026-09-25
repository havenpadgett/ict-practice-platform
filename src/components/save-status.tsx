import Link from "next/link";
import type { FriendlyError } from "@/lib/errors";

/** "Saving…", or a failed save with the one action that fixes it: retry
 * for a network or server error, log in again for an expired session. */
export function SaveStatus({
  saving,
  error,
  onRetry,
}: {
  saving: boolean;
  error: FriendlyError | null;
  onRetry: () => void;
}) {
  if (saving) return <p className="mt-3 text-xs text-muted">Saving…</p>;
  if (!error) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 text-xs" role="alert">
      <p className="text-danger">
        {error.message} Your place in this session is kept.
      </p>
      {error.kind === "auth" ? (
        <Link href="/login?next=/practice" className="inline-flex min-h-11 items-center font-medium text-accent underline">
          Log in again
        </Link>
      ) : (
        <button type="button" onClick={onRetry} className="inline-flex min-h-11 items-center font-medium text-accent underline">
          Retry save
        </button>
      )}
    </div>
  );
}
