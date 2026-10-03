// Production error monitoring (Sentry, free tier). Off unless
// NEXT_PUBLIC_SENTRY_DSN is set, so development, tests and the demo never
// report anything and the SDK is never loaded. A DSN is a write-only
// address, not a secret, which is why the one variable serves the server and
// the browser. Setup: docs/OPERATIONS.md → Error monitoring.
//
// What is sent: the error, its stack, the route, the browser. What is not:
// cookies, headers, request bodies, query strings, user ids or emails, and
// nothing a learner drew or typed. Performance tracing and session replay
// are not enabled (they cost quota and would capture charts and answers).

import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

export function monitoringDsn(): string | undefined {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  return dsn && dsn.startsWith("https://") ? dsn : undefined;
}

export function monitoringEnabled(): boolean {
  return monitoringDsn() !== undefined;
}

/** Drops a URL's query string and fragment: Supabase request URLs carry user ids. */
export function stripQuery(url: string): string {
  return url.split(/[?#]/)[0];
}

/** Removes personal and request data from an event before it leaves. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.url) event.request.url = stripQuery(event.request.url);
  }
  delete event.user;
  for (const c of event.breadcrumbs ?? []) if (typeof c.data?.url === "string") c.data.url = stripQuery(c.data.url);
  return event;
}

/** Options shared by the browser and server init. */
export function sentryOptions() {
  return {
    dsn: monitoringDsn(),
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV,
    // Free tier: errors only.
    tracesSampleRate: 0,
    sendDefaultPii: false,
    // A page full of the same failure shouldn't spend the month's quota.
    maxBreadcrumbs: 20,
    beforeSend: (event: ErrorEvent) => scrubEvent(event),
    beforeBreadcrumb: (crumb: Breadcrumb): Breadcrumb => {
      if (typeof crumb.data?.url === "string") crumb.data.url = stripQuery(crumb.data.url);
      return crumb;
    },
  };
}

/** Reports an error someone should hear about. A no-op when monitoring is
 * off. For errors the app catches and shows a message for; uncaught ones
 * reach Sentry on their own (instrumentation-client.ts, instrumentation.ts). */
export function reportError(error: unknown, context?: Record<string, string>): void {
  if (!monitoringEnabled()) return;
  void import("@sentry/nextjs")
    .then((Sentry) => Sentry.captureException(error, context ? { tags: context } : undefined))
    .catch(() => {
      // Monitoring must never be the thing that breaks.
    });
}
