import type { Instrumentation } from "next";
import { monitoringEnabled, sentryOptions } from "@/lib/monitoring";

// Server-side error monitoring (docs/OPERATIONS.md → Error monitoring). Off
// unless NEXT_PUBLIC_SENTRY_DSN is set; the SDK is only imported when it is.

export async function register() {
  if (!monitoringEnabled()) return;
  // The proxy and every route run on Node; there is no edge runtime to cover.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init(sentryOptions());
  }
}

/** Errors thrown while rendering, in Server Functions and in route handlers. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  // The app's own log (src/lib/error-log-server.ts), Sentry or not.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logServerError } = await import("@/lib/error-log-server");
    await logServerError(error, request);
  }
  if (!monitoringEnabled()) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(error, request, context);
};
