// Who may use the internal tools. Server-only. Reads the signed-in user's
// role from the database (profiles.role, supabase/migrations/
// 20260927120000_roles.sql), which only an administrator can set:
//   reviewer → /review
//   admin    → /review and /admin
// Until that migration is applied nobody has a role, so both tools stay
// closed — the safe default for internal tooling.

import { createClient } from "@/lib/supabase/server";

export type Role = "user" | "reviewer" | "admin";

export type Access =
  | { kind: "signed_out" }
  | { kind: "not_applied"; email: string }
  | { kind: "ok"; email: string; role: Role };

export async function getAccess(): Promise<Access> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kind: "signed_out" };
  const email = user.email ?? user.id;
  const { data, error } = await supabase.rpc("current_role_name");
  if (error) return { kind: "not_applied", email };
  const role: Role = data === "admin" || data === "reviewer" ? data : "user";
  return { kind: "ok", email, role };
}

export type Reviewer = { email: string };

/** A reviewer or admin, or null. Checked on /review and inside every
 * review Server Action. */
export async function getReviewer(): Promise<Reviewer | null> {
  const access = await getAccess();
  return access.kind === "ok" && (access.role === "reviewer" || access.role === "admin") ? { email: access.email } : null;
}

export const ROLE_SETUP_HINT =
  "Access comes from your role in the database (profiles.role). Apply supabase/migrations/20260927120000_roles.sql, then grant it in the Supabase SQL editor — see docs/SECURITY-AUDIT.md → Roles.";
