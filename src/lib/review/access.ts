// Who may use /review. Server-only: reads the signed-in Supabase user and
// checks their email against REVIEWER_EMAILS (comma-separated, set in
// .env.local). Unset means nobody — /review is internal tooling, so the
// safe default is closed.

import { createClient } from "@/lib/supabase/server";

export type Reviewer = { email: string };

export function reviewerEmails(): string[] {
  return (process.env.REVIEWER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function getReviewer(): Promise<Reviewer | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!email || !reviewerEmails().includes(email)) return null;
  return { email };
}
