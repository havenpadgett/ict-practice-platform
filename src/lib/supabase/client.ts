// Browser-side Supabase client. Create a fresh one per call rather than
// caching a singleton — this is the pattern @supabase/ssr expects, and it's
// cheap (it doesn't open a new connection, just wraps fetch/localStorage).

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseKey, getSupabaseUrl } from "@/lib/supabase/env";

export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseKey());
}
