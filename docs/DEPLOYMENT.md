# Deployment (Vercel)

*Checked 2026-09-27 (AI-DRAFTED).*

## Status at the time of checking

**Production (https://ict-practice-platform.vercel.app) is broken for anything that needs an account.**

- **Builds succeed.** Vercel builds deploy from `main`, and the last pushed commit (`89f7461`) built with status "success". A local `npm run build` of the current code also passes.
- **The Supabase variables were never set in Vercel.**
  - `/login` renders *"Can't connect right now. Missing NEXT_PUBLIC_SUPABASE_URL."*
  - `/admin`, `/review` and `/api/export/*` answer 500.
  - `/dashboard` and `/practice` were served without a login check, because the proxy let requests through when config was missing. No data was exposed, since there was no database to reach. The proxy now fails closed instead (security audit S13).

## Set these in Vercel → Project → Settings → Environment Variables

Names to paste, exactly (values come from Supabase → Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Tick **Production** and **Preview** for both, save, then **redeploy**.


| Name | Value | Environments |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` (Supabase → Project Settings → API) | Production, Preview |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | The **publishable** (anon) key, `sb_publishable_…`. Alternatively set it as `NEXT_PUBLIC_SUPABASE_ANON_KEY`; either name works. | Production, Preview |

- **Nothing else is needed.** `REVIEWER_EMAILS` is no longer read, because access now comes from database roles.
- **Never add a service-role or secret key.**
- **Redeploy after saving** (Deployments → ⋯ → Redeploy). `NEXT_PUBLIC_` values are baked in at build time, so existing deployments won't pick them up.

## Also in Supabase

- **Authentication → URL Configuration:**
  - Site URL: `https://ict-practice-platform.vercel.app`
  - Redirect URLs: add `https://ict-practice-platform.vercel.app/auth/callback`. Email-confirmation links need this.
- **Apply the pending migrations in filename order:** `20260926120000` through `20260927130000`. Back up first (docs/OPERATIONS.md).
- **Grant yourself the admin role** (docs/SECURITY-AUDIT.md → Roles).

## Known production limits

- **`/review` is read-only in production.** Reviews edit repo files, so they're saved only from the local dev server.
- **The scenario files are available to `/review` and `/admin` in production:** the build's file trace for both routes includes them.
