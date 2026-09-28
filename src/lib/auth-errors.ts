// Plain-language versions of Supabase Auth errors for the login, sign-up
// and password forms. Unknown messages fall through unchanged rather than
// being hidden, since they're the only clue to what went wrong.

const PATTERNS: [RegExp, string][] = [
  [/invalid login credentials/i, "That email and password don't match an account. Check both, or reset your password."],
  [/email not confirmed/i, "Confirm your email first: open the link we sent you, then log in."],
  [/user already registered|already been registered/i, "There's already an account with that email. Log in instead, or reset the password."],
  [/password should be at least|password.*(too short|at least)/i, "That password is too short. Use at least 6 characters."],
  [/weak password|pwned|known to be weak/i, "That password is too easy to guess. Try a longer one that you don't use anywhere else."],
  [/rate limit|too many requests|security purposes/i, "Too many attempts in a short time. Wait a minute, then try again."],
  [/unable to validate email|invalid email|email address .* is invalid/i, "That doesn't look like a valid email address."],
  [/failed to fetch|network|load failed/i, "Couldn't reach the server. Check your connection and try again."],
  [/same.*password|new password should be different/i, "Choose a password you haven't used for this account before."],
  [/session.*missing|auth session missing|jwt|expired/i, "This link has expired. Request a new reset email."],
];

export function authErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  for (const [pattern, friendly] of PATTERNS) if (pattern.test(message)) return friendly;
  return message || "Something went wrong. Try again.";
}

/** Supabase's default minimum; the project setting is the real rule. */
export const MIN_PASSWORD_LENGTH = 6;
