# Security Audit

*2026-09-27 (AI-DRAFTED, pending Haven's review).*

**Scope:**
- every route and Server Action;
- Row Level Security on every table and view;
- the CSV exports;
- the admin and review tools;
- logging and error messages;
- secrets in the repo and its history.

The findings below were recorded **before** any fixes. The Status column records the fix and the commit that made it.

## Findings

| # | Severity | Finding | Evidence | Status |
|---|---|---|---|---|
| S1 | **Medium** | **Internal tools have no real role system.** `/review`, including its file-writing Server Actions, and `/admin` are gated by an email allowlist in an env var (`REVIEWER_EMAILS`). An email address isn't an identity: if Supabase's "Confirm email" setting is off, anyone can sign up with an allowlisted address that isn't registered yet and get reviewer access. `/admin` also opens for reviewers who aren't admins, and there is a second, separate admin list (`app_admins`). | `src/lib/review/access.ts`, `src/app/admin/page.tsx`, `supabase/migrations/20260926140000_admin_functions.sql` | Open |
| S2 | **Medium** | **Open redirect after login.** The `next` query parameter is used unchecked. On `/auth/callback`, the redirect is built as `` `${origin}${next}` ``: with `next=@evil.example` this becomes `https://app@evil.example`, a URL whose host is `evil.example`. On `/login`, `router.push(next)` accepts any URL. A phishing link through the real login page would land the user on an attacker's site. | `src/app/auth/callback/route.ts:10`, `src/components/auth/auth-form.tsx:20` | Open |
| S3 | **Medium** | **Users can rewrite their own graded attempts.** Grading runs in the browser, and the `attempts` table has an UPDATE policy, so a user can flip `is_correct` on past rows. It's their own data, but `/admin`, the most-failed-exercise list and the answer-key anomaly check all trust it. No app code uses UPDATE on attempts. | `20260910120000_create_profiles_and_attempts.sql` ("Users can update own attempts") | Open |
| S4 | **Low** | **Answer keys and future Free Trade candles ship to the browser.** Anyone can read the answers in developer tools. See Task 2 (answer key protection). | `src/data/exercises.ts` imported by the client practice page | Open |
| S5 | **Low** | **CSV formula injection.** Cells starting with `=`, `+`, `-` or `@` are quoted, but quoting doesn't stop Excel from evaluating them. The user-controlled text today is the user's own email, exported to themselves, so it matters mainly for any future multi-user export. | `src/lib/export.ts` `csvCell` | Open |
| S6 | **Low** | **Raw database errors in API responses.** The export routes return `error.message` from Postgres, which exposes relation and column names. | `src/app/api/export/*/route.ts` | Open |
| S7 | **Low** | **No security headers.** There is no `X-Frame-Options` / `frame-ancestors`, so the chart-drawing UI could be framed for clickjacking. There is also no `X-Content-Type-Options` or `Referrer-Policy`. | `next.config.ts` is empty | Open |
| S8 | Info | **Row Level Security is correct, but only tested for reads of `attempts`.** RLS is on for `profiles`, `attempts`, `practice_events` and `app_admins`, with own-row policies (none on `app_admins`). Every view is `security_invoker`. The existing live test covers SELECT on attempts only, and is skipped without two test accounts. | migrations; `tests/data-integrity.test.ts` | Open: add a full A-vs-B test |
| S9 | Info | **The CSV export can only return the caller's rows.** Both export routes take the user from the session cookie (`auth.getUser()`), filter on that id, and run under RLS with the anon key. An admin gets only their own rows too. **There is no all-users export**, and the admin functions return aggregates, never rows. | `src/app/api/export/` | No change needed. Covered by the RLS test. |
| S10 | Info | **No route trusts a client-supplied user id for access.** Client reads pass the signed-in user's id (`fetchAttempts(userId)`), but a forged id returns nothing under RLS, and every insert policy checks `auth.uid() = user_id`. Server Actions and routes take the user from the session. Review ids are validated against `^real-[a-z]+-\d{3}$` before any file path is built, and editable text keys are derived on the server. | `src/lib/review/store.ts:64` | No change needed |
| S11 | Info | **Logging doesn't leak user data.** Two `console.error` calls exist. One logs render errors in the user's own browser; the other logs scenario-file validation errors on the server (content, not users). `describeError` shows the user their own failed request's message. | `src/app/error.tsx`, `src/data/real-scenarios/index.ts` | No change needed |
| S12 | Info | **No secrets in the repo.** `.env*` is git-ignored and no env file was ever committed. The full history contains no Supabase keys or JWTs (the only `eyJ` match is an npm integrity hash). Only the publishable (anon) key is used, and it is meant to be public. **No service-role key exists anywhere** in code, config or history. | `git log -p --all` scan | No change needed |

**Not verifiable from the repo:**
- **Hosted database settings:** whether the hosted project has "Confirm email" on, and whether the RLS on the hosted database matches the migrations. The migrations are the only record.
- **Rate limiting:** there's none on the export routes. Supabase rate-limits auth, but not these routes.
