"use server";

// Settings → Delete my account. The user comes from the session cookie,
// never the request. delete_own_account() (supabase/migrations/
// 20261029120000_launch_readiness.sql) deletes their auth user and, by
// cascade, every row of theirs; no service-role key is involved.

import { createClient } from "@/lib/supabase/server";

export async function deleteAccount(): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're not logged in." };
  const { error } = await supabase.rpc("delete_own_account");
  if (error) return { ok: false, error: "Couldn't delete your account. Try again, or email us and we'll do it for you." };
  // The user is gone, so this only clears the session cookies.
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  return { ok: true };
}
