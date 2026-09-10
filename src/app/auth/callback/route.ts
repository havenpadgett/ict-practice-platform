import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Hit after Google OAuth (and email confirmation links, if enabled) redirect
// back here with a `code` param. Exchanges it for a session, stored in
// cookies via the server client, then sends the user on their way.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
