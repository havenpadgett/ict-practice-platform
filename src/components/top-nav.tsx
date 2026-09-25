"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";

/** 44px-tall tap target (min-h-11) around each nav link. */
const NAV_LINK = "inline-flex min-h-11 items-center px-2 transition-colors hover:text-foreground";

export function TopNav() {
  const { user, loading, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-background/95 backdrop-blur">
      {/* Wraps onto two rows on a phone rather than overflowing: the signed-in
          links plus Log out don't fit beside the brand at 375px. */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 px-4 py-1.5 sm:px-6 sm:py-2">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm font-semibold tracking-tight text-foreground sm:text-base"
        >
          ICT Practice
        </Link>
        <nav className="flex items-center gap-1 text-sm text-muted sm:gap-4">
          {!loading && user && (
            <>
              <Link href="/dashboard" className={NAV_LINK}>
                Dashboard
              </Link>
              <Link href="/practice" className={NAV_LINK}>
                Practice
              </Link>
              <Link href="/analytics" className={NAV_LINK}>
                Analytics
              </Link>
              <span className="hidden max-w-[10rem] truncate text-muted sm:inline">
                {user.email}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="ml-1 btn-secondary"
              >
                Log out
              </button>
            </>
          )}
          {!loading && !user && (
            <Link href="/login" className={NAV_LINK}>
              Log In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
