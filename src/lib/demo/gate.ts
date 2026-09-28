// DEMO MODE — branch `demo-mode` only; delete the branch after review
// (docs/OPERATIONS.md → Demo mode). Every demo file lives in src/lib/demo/,
// src/app/api/demo/ and src/components/demo-banner.tsx.
//
// Demo mode skips login and swaps Supabase for an in-memory store of
// seeded fake data, so a reviewer can walk the signed-in app without an
// account and without touching a real row. It exists only when BOTH hold:
//   1. NEXT_PUBLIC_DEMO_MODE is exactly "true" (never set for Production), and
//   2. the build isn't production: either `next dev` locally, or a Vercel
//      *preview* built from the demo-mode branch. A Vercel production
//      deployment (VERCEL_ENV=production), a preview of any other branch,
//      and a local `next build` / `next start` never qualify.
// Everything read here is NEXT_PUBLIC_ (next.config.ts copies Vercel's
// VERCEL_ENV / VERCEL_GIT_COMMIT_REF into NEXT_PUBLIC_ names), so the
// browser half sees the same answer. Each call site also checks the flag
// inline: a build without it folds that to `false` and drops the demo code.

export const DEMO_BRANCH = "demo-mode";

export function isDemoMode(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") return false;
  // Runtime backstop, server side: the NEXT_PUBLIC_ values below are fixed
  // when the bundle is built, so a demo-mode preview build promoted to
  // production would still carry them. VERCEL_ENV is read from the live
  // environment on the server (it isn't NEXT_PUBLIC_, so it's never
  // inlined), which keeps the proxy, the server client and /api/demo closed
  // on any production deployment whatever the bundle says.
  if (typeof window === "undefined" && process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" && process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF === DEMO_BRANCH;
}

export const DEMO_USER = {
  id: "00000000-0000-4000-8000-00000000de40",
  email: "demo-reviewer@example.com",
} as const;
