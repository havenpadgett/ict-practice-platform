"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/monitoring";

// Last resort when the root layout itself fails. It renders its own
// document, without the app's stylesheet, so styles are inline — the
// values mirror the tokens in globals.css (the one place hex is allowed
// outside it).
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    reportError(error, { boundary: "global-error" });
  }, [error]);
  return (
    <html lang="en">
      <body style={{ background: "#0d0e10", color: "#ededea", fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <title>Something went wrong</title>
        <h1 style={{ fontSize: 20 }}>Something went wrong</h1>
        <p style={{ color: "#9ca0a7", fontSize: 14 }}>Your recorded attempts are safe.</p>
        <button
          type="button"
          onClick={() => retry()}
          style={{ marginTop: 16, minHeight: 44, padding: "0 20px", borderRadius: 6, border: 0, background: "#34d399", color: "#0b1f16" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
