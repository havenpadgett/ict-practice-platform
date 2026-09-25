// Turns whatever a failed Supabase/network call threw into something a user
// can act on. Raw messages ("Failed to fetch", "JWT expired", "new row
// violates row-level security policy") mean nothing to a trader.

export type ErrorKind = "network" | "auth" | "other";

export type FriendlyError = { kind: ErrorKind; message: string };

function raw(err: unknown): { message: string; status?: number; code?: string } {
  if (typeof err === "object" && err !== null) {
    const e = err as { message?: unknown; status?: unknown; code?: unknown };
    return {
      message: typeof e.message === "string" ? e.message : String(err),
      status: typeof e.status === "number" ? e.status : undefined,
      code: typeof e.code === "string" ? e.code : undefined,
    };
  }
  return { message: String(err) };
}

export function classifyError(err: unknown): ErrorKind {
  const { message, status, code } = raw(err);
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "network";
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(message)) return "network";
  if (status === 401 || status === 403 || code === "PGRST301" || code === "42501") return "auth";
  if (/jwt|expired|not authenticated|auth session missing|row-level security/i.test(message)) return "auth";
  return "other";
}

/** `action` completes "Couldn't …", e.g. "save this attempt". */
export function describeError(err: unknown, action: string): FriendlyError {
  const kind = classifyError(err);
  if (kind === "network") {
    return { kind, message: `Couldn't ${action} — you appear to be offline or the server can't be reached.` };
  }
  if (kind === "auth") {
    return { kind, message: `Couldn't ${action} — your login has expired. Log in again to continue.` };
  }
  return { kind, message: `Couldn't ${action}: ${raw(err).message}` };
}
