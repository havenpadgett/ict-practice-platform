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
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">Something went wrong on this page</h1>
      <p className="mt-2 text-sm text-muted">
        Your recorded attempts are safe. Try again, or start over if it keeps happening.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex min-h-11 items-center rounded-md bg-accent px-5 text-sm font-medium text-accent-foreground"
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
          className="inline-flex min-h-11 items-center rounded-md border border-line px-5 text-sm font-medium text-foreground"
        >
          Start over
        </button>
      </div>
    </div>
  );
}
