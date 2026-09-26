import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseKey, getSupabaseUrl } from "@/lib/supabase/env";

const PROTECTED_PATHS = ["/dashboard", "/practice", "/analytics", "/review", "/admin", "/api/export"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  let supabaseUrl: string;
  let supabaseAnonKey: string;
  try {
    supabaseUrl = getSupabaseUrl();
    supabaseAnonKey = getSupabaseKey();
  } catch {
    // Missing env vars (e.g. not set in Vercel). Public pages still load and
    // AuthProvider shows the misconfiguration; protected paths fail closed
    // to /login rather than rendering unprotected (security audit S13).
    const isProtectedPath = PROTECTED_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));
    return isProtectedPath ? NextResponse.redirect(new URL("/login", request.url)) : response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Refreshes the session cookie if it's expired, and gives us the current
  // user to decide whether to redirect.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (isProtected && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/practice/:path*", "/analytics/:path*", "/review/:path*", "/admin/:path*", "/api/export/:path*"],
};
