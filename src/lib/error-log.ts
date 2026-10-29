// The app's own error log (public.errors, supabase/migrations/
// 20261029120000_launch_readiness.sql), read by admins on /admin. Separate
// from Sentry (src/lib/monitoring.ts), which stays off unless configured.
// Logging must never be the thing that breaks, so every failure is swallowed.

export type ErrorSource = "client" | "boundary" | "server";

export type ErrorRow = {
  message: string;
  stack: string | null;
  page: string | null;
  source: ErrorSource;
  user_id: string | null;
};

const MAX_MESSAGE = 2000;
const MAX_STACK = 8000;
const MAX_PAGE = 500;

/** Shapes any thrown value into a row the table's checks accept. */
export function errorRow(error: unknown, source: ErrorSource, page: string | null, userId: string | null): ErrorRow {
  const message = messageOf(error) || "Unknown error";
  const stack = error instanceof Error && error.stack ? error.stack.slice(0, MAX_STACK) : null;
  return {
    message: message.slice(0, MAX_MESSAGE),
    stack,
    // Path only: query strings can carry ids and tokens.
    page: page ? page.split(/[?#]/)[0].slice(0, MAX_PAGE) : null,
    source,
    user_id: userId,
  };
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  // Supabase errors are plain objects with a message.
  const m = (error as { message?: unknown } | null)?.message;
  if (typeof m === "string") return m;
  return safeString(error);
}

function safeString(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

// A crash loop shouldn't flood the table: each message once per page load,
// and no more than a handful in all.
const MAX_PER_LOAD = 10;
const seen = new Set<string>();

/** Browser side. Writes through the visitor's own session (or signed out). */
export async function logClientError(error: unknown, source: Exclude<ErrorSource, "server"> = "client"): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const row = errorRow(error, source, window.location.pathname, data.session?.user.id ?? null);
    if (seen.has(row.message) || seen.size >= MAX_PER_LOAD) return;
    seen.add(row.message);
    await supabase.from("errors").insert(row);
  } catch {
    // Ignore: the log is best-effort.
  }
}
