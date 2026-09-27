// DEMO MODE — branch `demo-mode` only; delete the branch after review
// (docs/OPERATIONS.md → Demo mode). Every demo file lives in src/lib/demo/,
// src/app/api/demo/ and src/components/demo-banner.tsx.
//
// Demo mode skips login and swaps Supabase for an in-memory store of
// seeded fake data, so a reviewer can walk the signed-in app without an
// account and without touching a real row. It exists only when BOTH hold:
//   1. NEXT_PUBLIC_DEMO_MODE is exactly "true" (never set in production), and
//   2. NODE_ENV is not "production" (i.e. `next dev`, never `next build`).
// NEXT_PUBLIC_ so the browser half can see it too. Each call site also
// repeats the NODE_ENV check inline, so a production build compiles the
// demo branch out entirely (the bundler folds it to `false`).

export function isDemoMode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export const DEMO_USER = {
  id: "00000000-0000-4000-8000-00000000de40",
  email: "demo-reviewer@example.com",
} as const;
