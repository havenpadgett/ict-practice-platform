// Browser-side Supabase client. Create a fresh one per call rather than
// caching a singleton — this is the pattern @supabase/ssr expects, and it's
// cheap (it doesn't open a new connection, just wraps fetch/localStorage).

import { createBrowserClient } from "@supabase/ssr";

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing ${name}. Set it in .env.local.`);
  }
  return value;
}

export function createClient() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnonKey = requireEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
