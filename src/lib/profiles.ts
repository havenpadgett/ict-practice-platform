import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/** Creates a profiles row for `user` if one doesn't already exist. Safe to
 * call on every sign-in — ignoreDuplicates means it never overwrites an
 * existing row (e.g. a username the user later changed). */
export async function ensureProfile(user: User): Promise<void> {
  const supabase = createClient();
  const username = user.email ? user.email.split("@")[0] : null;

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, username }, { onConflict: "id", ignoreDuplicates: true });

  if (error) {
    throw error;
  }
}
