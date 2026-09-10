"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";

export function TopNav() {
  const { user, loading, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-foreground sm:text-base"
        >
          ICT Practice
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted sm:gap-6">
          {!loading && user && (
            <>
              <Link href="/dashboard" className="transition-colors hover:text-foreground">
                Dashboard
              </Link>
              <Link href="/practice" className="transition-colors hover:text-foreground">
                Practice
              </Link>
              <span className="hidden max-w-[10rem] truncate text-foreground/70 sm:inline">
                {user.email}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded-md border border-line px-3 py-1.5 text-foreground transition-colors hover:bg-surface"
              >
                Log out
              </button>
            </>
          )}
          {!loading && !user && (
            <Link href="/login" className="transition-colors hover:text-foreground">
              Log In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
