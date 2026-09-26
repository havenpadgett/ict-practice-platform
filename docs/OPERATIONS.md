# Operations: Backup, Recovery, Pausing

*2026-09-27 (AI-DRAFTED, pending Haven's review). Supabase's plan details were checked against its documentation on that date (sources at the end). Plans change, so re-check before relying on them.*

## What lives where

| Lives in git (safe if the database is lost) | Lives only in Supabase (lost with it) |
|---|---|
| Every exercise, answer key and real scenario (`src/data/`) | Accounts: `auth.users` and `auth.identities`, with email and password hash |
| Curriculum and its versions | `profiles`: username, practice streak, **role** (reviewer / admin) |
| Review decisions (`docs/review-log.json`) and scenario approvals | `attempts`: every graded answer, the whole analytics history |
| Schema: every table, view, policy and function (`supabase/migrations/`) | `practice_events`: session and recommendation tracking |

**If the database is lost with no backup:**
- **The app still deploys and works:** exercises, grading and review are unaffected.
- **Every user has to sign up again:** accounts are gone.
- **All progress is gone:** analytics, streaks, recommendations, `/admin` numbers and the data behind any analysis.
- **Recovering the schema is straightforward:** apply the migrations to a new project.
- **The data can't be recovered.**

## What the Supabase free plan keeps

- **Automatic backups:**
  - **Free:** none that you can use. Supabase's backup guide lists daily backups only for paid plans, and tells free projects to *"regularly export their data using the Supabase CLI `db dump` command and maintain off-site backups."*
  - **Pro:** the last 7 days of daily backups, downloadable from Dashboard → Database → Backups.
  - **Team:** 14 days.
  - **Enterprise:** up to 30 days.
- **Point-in-time recovery:** a paid add-on on Pro and above. Not available on Free.
- **Storage files** aren't in database backups on any plan. This app doesn't use Supabase Storage, so that doesn't matter here.

**On the free plan, the only backup is one you make yourself.**

## Making a backup

### Option 1: `npm run backup` (recommended; no extra tools)

It exports every row of user data to one JSON file: `auth.users`, `auth.identities`, `profiles`, `attempts` and `practice_events`. It also records which migrations the database had applied.

1. **Copy the connection string** in the Supabase Dashboard: **Connect** → **Session pooler**. It looks like `postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres`.
2. **Fill in the password.** If you don't have it, reset it under **Project Settings → Database**.
3. **Run it:**
   ```bash
   DATABASE_URL='postgresql://postgres.<ref>:<password>@...:5432/postgres' npm run backup
   ```
4. **Find the output** at `backups/ict-practice-<timestamp>.json`, with a row count per table.

**Keep the file safe:**
- `backups/` is git-ignored and the file is created owner-only (`0600`). It holds every user's email and password hash.
- Copy it somewhere off this machine, encrypted, for example an encrypted disk image or a password-manager attachment.
- Never commit it or paste it anywhere.

**How often:** weekly while there are real users, and before any risky change such as a migration or a plan change. A backup is only as recent as its last run.

**What it doesn't include:** the schema (it's in `supabase/migrations/`), and the project's Auth settings (providers, email templates, redirect URLs, "Confirm email"). Note those settings down separately.

### Option 2: a full SQL dump with the Supabase CLI

This dumps everything, including schema and roles. It needs the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) and Docker running, neither of which is set up on this machine yet:

```bash
supabase db dump --db-url "$DATABASE_URL" -f roles.sql --role-only
supabase db dump --db-url "$DATABASE_URL" -f schema.sql
supabase db dump --db-url "$DATABASE_URL" -f data.sql --use-copy --data-only
```

The same storage rules apply as for Option 1.

## Restoring

### From `npm run backup` into a new or empty project

1. **Create the project** at supabase.com if needed.
2. **Apply the schema:** run every file in `supabase/migrations/` **in filename order**, with `supabase db push` or by pasting each file into the SQL editor. The backup records which migrations the source had. Apply at least those.
3. **Load the data:**
   ```bash
   DATABASE_URL='<new project connection string>' npm run restore -- backups/ict-practice-<timestamp>.json
   ```
   Tables load in dependency order. Triggers are skipped during the load, the way Supabase's own restore does it. Rows that already exist are skipped, so re-running is safe. It prints rows inserted per table, which should match the counts from the backup.
4. **Point the app at it:** if the project is new, update `NEXT_PUBLIC_SUPABASE_URL` and the publishable key in `.env.local` and in Vercel (see [DEPLOYMENT.md](DEPLOYMENT.md)), then redeploy.
5. **Redo the Auth settings by hand:** Site URL and redirect URLs (`https://<your-domain>/auth/callback`), "Confirm email", and email templates.
6. **Check it:**
   - Sign in as an existing user: password hashes are restored, so passwords still work.
   - Check `/analytics` shows their history.
   - Check `/admin` opens for the admin: roles are restored with `profiles`.

The round trip (export, restore into a freshly migrated database, identical data, idempotent re-run) is tested in `tests/sql/backup.test.ts`. **It has not been run against a hosted Supabase project yet.** Do that once, into a scratch project, before relying on it.

### From a CLI SQL dump

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql --dbname "$DATABASE_URL"
```

## When the free plan pauses the project

**When it happens:** Supabase pauses a free project that hasn't had enough database activity over the past week, roughly 7 days without real use.

**What users see while it's paused:**
- The landing page still loads: it's served by Vercel.
- **Login fails**, and every signed-in page (`/dashboard`, `/practice`, `/analytics`, `/review`, `/admin`) sends people back to `/login`.
- Nothing can be saved or graded, because grading checks the login.

**Data is kept.** Resuming returns the project "to its previous state, including data and configurations". The URL and keys don't change, so there's nothing to update in Vercel.

**Bringing it back (within the restore window):**
1. Open the Supabase Dashboard.
2. Select the organization, then the paused project.
3. Click **Resume project** and confirm.
4. Wait for it to come up. Supabase doesn't give a duration, so allow several minutes.
5. Sign in to the app to confirm.

**Restore window:** Supabase's docs (checked 2026-09-27) say a paused free project can be resumed from the dashboard **for 1 year**. Older pages and posts say 90 days, so don't count on the longer window.

**After the window:** the project can't be resumed. Its overview page still offers:
- a download of the database backup (a `.backup` file);
- any Storage objects.

To bring it back:
1. Download that backup.
2. Create a new project.
3. Load the backup: `psql -d "$DATABASE_URL" -f /path/to/file.backup`. Some "already exists" errors are expected.
4. Redo Auth settings and Vercel env vars as in steps 4–5 of the restore above.

**If the project is deleted, everything goes, backups included.**

**Preventing pauses:**
- **Pro plan:** paid projects are never paused.
- **Regular real use:** a few requests a day keeps it active.
- **A scheduled ping** that queries the database, for example a daily cron job. This works, but it's a workaround for the free plan's rules, not a backup. **None is set up.**

## Backup routine

The free plan keeps no backups, and the project pauses after about a week without use. A backup has to be a habit:

- **Every week while there are real users**, and **before** every migration, plan change or restore rehearsal, run:
  ```bash
  DATABASE_URL='<session pooler connection string>' npm run backup
  ```
  Then copy the new file in `backups/` off this machine, encrypted.
- **The reminder is built in.** `npm run dev` prints the age of the newest backup first, with a warning once it's over 7 days old or if there's none. You can also check any time:
  ```bash
  npm run backup:status
  ```
  It only looks at `backups/` on this machine. A copy stored elsewhere doesn't reset it.
- **Once a quarter**, rehearse a restore into a scratch project ([Restoring](#restoring)). A backup that has never been restored is a hope, not a backup.
- **While you're doing the weekly backup**, also check the Supabase dashboard for a "paused" banner, and resume the project if it's there ([below](#when-the-free-plan-pauses-the-project)).

## Pre-deploy checklist

Run through this before pushing to `main`, since Vercel deploys every push to production. Walk [MANUAL-TEST-PLAN.md](MANUAL-TEST-PLAN.md) afterwards.

1. **Back up the database:** `npm run backup` (above).
2. **Apply pending migrations** in filename order in the Supabase SQL editor, or with `supabase db push`, **before** the code that needs them goes live.
   - Pending as of 2026-09-26:
     1. `20260926120000_analytics_views.sql`
     2. `20260926130000_practice_events.sql`
     3. `20260926140000_admin_functions.sql`
     4. `20260927120000_roles.sql`
     5. `20260927130000_attempt_integrity.sql`
   - Afterwards, run `supabase/audit/attempt_integrity_audit.sql` and deal with anything it lists ([DATA-INTEGRITY.md](DATA-INTEGRITY.md)).
   - To see what's applied, check the Supabase dashboard → Database → Migrations, or `select version from supabase_migrations.schema_migrations`. Migrations pasted into the SQL editor by hand aren't recorded there, so keep a note of which ones you ran.
3. **Check the Vercel environment variables:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are set for Production and Preview ([DEPLOYMENT.md](DEPLOYMENT.md)). After changing one, redeploy.
4. **Check the catalog is current:** run `npm run catalog`, then `git status`. If `src/data/exercise-catalog.json` changed, commit it. Sessions are built from this file, so a stale one serves the wrong exercises. `npm test` also fails if it's stale.
5. **Check the curriculum versions:** `npm run curriculum -- check` passes. A changed definition needs a version bump.
6. **Get the test suite green:** `npm test`, `npm run test:py` and `npm run lint` all pass.
7. **Confirm the build works:** `npm run build` succeeds locally.
8. **Push**, then wait for Vercel's check on the commit to show "Deployment has completed".
9. **Smoke test:** open `/login`. If it says "Can't connect right now", the env vars are missing (step 3). Then run the manual test plan.

## Checklist (one-time)

- [ ] Rehearse a restore once, into a scratch project.
- [ ] Record the Auth settings somewhere outside Supabase.
- [ ] Decide between Pro and accepting pause/backup risk before inviting real users.

## Sources

- [Supabase: Database Backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase: Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Supabase: Restore a project paused for more than 1 year](https://supabase.com/docs/guides/troubleshooting/restore-project-after-90-days-pause)
- [Supabase: Backup and restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
