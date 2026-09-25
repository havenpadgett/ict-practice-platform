"use client";

import { useEffect } from "react";
import { clearSession } from "@/lib/storage";

// Any render error below the root layout lands here instead of a blank
// page. "Start over" also clears the stored practice session, the most
// likely source of a repeatable crash (stale or hand-edited data).
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page">
      <h1 className="page-title">Something went wrong on this page</h1>
      <p className="mt-2 text-sm text-muted">
        Your recorded attempts are safe. Try again, or start over if it keeps happening.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="btn-primary"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => {
            clearSession();
            // A full reload on purpose: drop whatever in-memory state crashed.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination
            window.location.assign("/dashboard");
          }}
          className="btn-secondary"
        >
          Start over
        </button>
      </div>
    </div>
  );
}
