// Where to send a user after login (security audit S2). `next` comes from
// the URL, so it's attacker-controlled: only a same-site path is allowed.
// Rejected: absolute URLs, protocol-relative "//host", "/\host" (browsers
// treat "\" as "/"), "@host" (which turns `${origin}${next}` into
// userinfo@host), and anything with control characters.

export const DEFAULT_AFTER_LOGIN = "/dashboard";

export function safeNextPath(next: string | null | undefined, fallback = DEFAULT_AFTER_LOGIN): string {
  if (!next || !next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    // Resolving against a dummy origin must keep that origin.
    const url = new URL(next, "https://same-origin.invalid");
    if (url.origin !== "https://same-origin.invalid") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
