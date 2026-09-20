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

export type Profile = {
  id: string;
  username: string | null;
  current_streak: number;
  last_completed_date: string | null;
};

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, current_streak, last_completed_date")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** YYYY-MM-DD in the caller's local timezone — a practice streak is about
 * calendar days as the user experiences them, not UTC days. */
function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(earlier: string, later: string): number {
  // Both are YYYY-MM-DD with no time component — parsing as UTC midnight
  // avoids any local-timezone DST shift affecting the day count.
  const a = new Date(`${earlier}T00:00:00Z`).getTime();
  const b = new Date(`${later}T00:00:00Z`).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

/** Call once per completed session. Increments the streak if the last
 * completed session was yesterday, resets it to 1 if there's a gap of more
 * than a day (or no prior session), and leaves it unchanged if a session
 * was already completed today (a second session the same day doesn't
 * double-count). Best-effort — a failure here shouldn't block navigation
 * away from a finished session, so callers should not await this on the
 * critical path (matching how ensureProfile is called from auth-context). */
export async function recordSessionCompletion(userId: string): Promise<void> {
  const today = localDateString(new Date());
  const profile = await fetchProfile(userId);

  let nextStreak: number;
  if (!profile || !profile.last_completed_date) {
    nextStreak = 1;
  } else if (profile.last_completed_date === today) {
    return; // Already recorded a completed session today — no-op.
  } else if (daysBetween(profile.last_completed_date, today) === 1) {
    nextStreak = profile.current_streak + 1;
  } else {
    nextStreak = 1;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ current_streak: nextStreak, last_completed_date: today })
    .eq("id", userId);
  if (error) throw error;
}
