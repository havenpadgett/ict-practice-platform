import { monitoringEnabled, sentryOptions } from "@/lib/monitoring";

// Browser-side error monitoring (docs/OPERATIONS.md → Error monitoring).
// Off unless NEXT_PUBLIC_SENTRY_DSN is set; the SDK is a separate chunk that
// is only fetched when it is. Uncaught errors and unhandled rejections are
// captured by the SDK once it is initialised.

if (monitoringEnabled()) {
  void import("@sentry/nextjs")
    .then((Sentry) => Sentry.init(sentryOptions()))
    .catch(() => {
      // A blocked or failed load must not affect the app.
    });
}

export function onRouterTransitionStart(): void {
  // Navigation tracing is off (errors only), so nothing to record.
}
