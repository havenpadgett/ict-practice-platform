# Security Audit

*2026-09-27 (AI-DRAFTED, pending Haven's review).*

**Scope:**
- every route and Server Action;
- Row Level Security on every table and view;
- the CSV exports;
- the admin and review tools;
- logging and error messages;
- secrets in the repo and its history.

The findings below were recorded **before** any fixes (commit `64c0c86`). The Status column was filled in afterwards with each fix.

## Findings

| # | Severity | Finding | Evidence | Status |
|---|---|---|---|---|
| S1 | **Medium** | **Internal tools have no real role system.** `/review`, including its file-writing Server Actions, and `/admin` are gated by an email allowlist in an env var (`REVIEWER_EMAILS`). An email address isn't an identity: if Supabase's "Confirm email" setting is off, anyone can sign up with an allowlisted address that isn't registered yet and get reviewer access. `/admin` also opens for reviewers who aren't admins, and there is a second, separate admin list (`app_admins`). | `src/lib/review/access.ts`, `src/app/admin/page.tsx`, `supabase/migrations/20260926140000_admin_functions.sql` | **Fixed.** Access now comes from `profiles.role` (`user` / `reviewer` / `admin`), checked on the server by `/review`, every review Server Action and `/admin`, and again inside the admin database functions. A trigger stops anyone signed in through the API from setting a role, their own included. `REVIEWER_EMAILS` and `app_admins` are retired. Migration `20260927120000_roles.sql`, [below](#roles). |
| S2 | **Medium** | **Open redirect after login.** The `next` query parameter is used unchecked. On `/auth/callback`, the redirect is built as `` `${origin}${next}` ``: with `next=@evil.example` this becomes `https://app@evil.example`, a URL whose host is `evil.example`. On `/login`, `router.push(next)` accepts any URL. A phishing link through the real login page would land the user on an attacker's site. | `src/app/auth/callback/route.ts:10`, `src/components/auth/auth-form.tsx:20` | **Fixed.** `safeNextPath()` (`src/lib/safe-redirect.ts`) allows only same-site paths and falls back to `/dashboard`. Tested in `tests/safe-redirect.test.ts`. |
| S3 | **Medium** | **Users can rewrite their own graded attempts.** Grading runs in the browser, and the `attempts` table has an UPDATE policy, so a user can flip `is_correct` on past rows. It's their own data, but `/admin`, the most-failed-exercise list and the answer-key anomaly check all trust it. No app code uses UPDATE on attempts. | `20260910120000_create_profiles_and_attempts.sql` ("Users can update own attempts") | **Fixed.** The UPDATE policy is dropped in `20260927120000_roles.sql`, so users can still delete their own rows but not rewrite them. Inserts are still client-graded; Task 3 constraints stop contradictory rows. |
| S4 | **Low** | **Answer keys and future Free Trade candles ship to the browser.** Anyone can read the answers in developer tools. See Task 2 (answer key protection). | `src/data/exercises.ts` imported by the client practice page | **Fixed, except Free Trade candles.** Keys stay on the server, and grading runs in Server Functions ([ANSWER-KEYS.md](ANSWER-KEYS.md)). Free Trade's future candles still ship for playback. |
| S5 | **Low** | **CSV formula injection.** Cells starting with `=`, `+`, `-` or `@` are quoted, but quoting doesn't stop Excel from evaluating them. The user-controlled text today is the user's own email, exported to themselves, so it matters mainly for any future multi-user export. | `src/lib/export.ts` `csvCell` | **Fixed.** Text cells starting with `= + - @`, tab or CR get a leading `'`. Numbers are untouched, so `-1` stays numeric. Tested. |
| S6 | **Low** | **Raw database errors in API responses.** The export routes return `error.message` from Postgres, which exposes relation and column names. | `src/app/api/export/*/route.ts` | **Fixed.** Generic messages. Only the error code is logged on the server. |
| S7 | **Low** | **No security headers.** There is no `X-Frame-Options` / `frame-ancestors`, so the chart-drawing UI could be framed for clickjacking. There is also no `X-Content-Type-Options` or `Referrer-Policy`. | `next.config.ts` is empty | **Fixed.** Every response now sends `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `strict-origin-when-cross-origin` and a restrictive `Permissions-Policy`, and no longer sends `X-Powered-By`. A full script CSP was not added: it needs nonces for Next's inline scripts, which isn't worth the risk for this app yet. |
| S8 | Info | **Row Level Security is correct, but only tested for reads of `attempts`.** RLS is on for `profiles`, `attempts`, `practice_events` and `app_admins`, with own-row policies (none on `app_admins`). Every view is `security_invoker`. The existing live test covers SELECT on attempts only, and is skipped without two test accounts. | migrations; `tests/data-integrity.test.ts` | **Tested.** `tests/sql/rls.test.ts` runs every migration in Postgres (PGlite) and signs in as user A. A cannot select, update or delete B's `profiles`, `attempts` or `practice_events` rows, and cannot insert rows claiming to be B. Every view returns only A's rows, and signed-out (`anon`) sees nothing. The same file tests role escalation and attempt rewriting. |
| S9 | Info | **The CSV export can only return the caller's rows.** Both export routes take the user from the session cookie (`auth.getUser()`), filter on that id, and run under RLS with the anon key. An admin gets only their own rows too. **There is no all-users export**, and the admin functions return aggregates, never rows. | `src/app/api/export/` | No change needed. Covered by the RLS test. |
| S10 | Info | **No route trusts a client-supplied user id for access.** Client reads pass the signed-in user's id (`fetchAttempts(userId)`), but a forged id returns nothing under RLS, and every insert policy checks `auth.uid() = user_id`. Server Actions and routes take the user from the session. Review ids are validated against `^real-[a-z]+-\d{3}$` before any file path is built, and editable text keys are derived on the server. | `src/lib/review/store.ts:64` | No change needed |
| S11 | Info | **Logging doesn't leak user data.** Two `console.error` calls exist. One logs render errors in the user's own browser; the other logs scenario-file validation errors on the server (content, not users). `describeError` shows the user their own failed request's message. | `src/app/error.tsx`, `src/data/real-scenarios/index.ts` | No change needed |
| S12 | Info | **No secrets in the repo.** `.env*` is git-ignored and no env file was ever committed. The full history contains no Supabase keys or JWTs (the only `eyJ` match is an npm integrity hash). Only the publishable (anon) key is used, and it is meant to be public. **No service-role key exists anywhere** in code, config or history. | `git log -p --all` scan | No change needed |

**Not verifiable from the repo:**
- **Hosted database settings:** whether the hosted project has "Confirm email" on, and whether the RLS on the hosted database matches the migrations. The migrations are the only record.
- **Rate limiting:** there's none on the export routes. Supabase rate-limits auth, but not these routes.

## Roles

`profiles.role` has three values:
- **`user`:** the default for everyone.
- **`reviewer`:** can use `/review`.
- **`admin`:** can use `/review` and `/admin`, and read all-user aggregates through the admin functions.

Roles are granted only from the Supabase SQL editor. A `before insert or update` trigger on `profiles` raises an error if a request made as `authenticated` or `anon` (every API call) tries to set or change a role.

```sql
update public.profiles set role = 'admin'   -- or 'reviewer'
where id = (select id from auth.users where email = 'you@example.com');
```

**Until `20260927120000_roles.sql` is applied, nobody has a role, so `/review` and `/admin` are closed to everyone.** That is deliberate: internal tools fail closed.

Why a column on `profiles` rather than a separate table or Supabase `app_metadata`:
- The role lives next to the user row RLS already protects.
- The database functions can check it directly.
- It's visible in the table editor.

`app_metadata` would put it in the JWT, where a role change only takes effect after the token refreshes.

## Checklist for a new table or route

1. Enable RLS in the same migration that creates the table, with own-row policies. Add it to `tests/sql/rls.test.ts`.
2. Create views `with (security_invoker = true)`.
3. In a route or Server Action, take the user from `auth.getUser()`, never from the request body or query.
4. Keep internal tools behind `getReviewer()` / `getAccess()`, checked on the page **and** inside every action.
5. Never put a service-role key in this app. All-user reads go through `security definer` functions that check the role.
