"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnalyticsIcon, ChevronDownIcon, DashboardIcon, MistakesIcon, PracticeIcon } from "@/components/nav/nav-icons";
import { useAuth } from "@/contexts/auth-context";
import { useOpenMistakeCount } from "@/hooks/use-open-mistake-count";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: DashboardIcon },
  { href: "/practice", label: "Practice", Icon: PracticeIcon },
  { href: "/mistakes", label: "Mistakes", Icon: MistakesIcon },
  { href: "/analytics", label: "Analytics", Icon: AnalyticsIcon },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The favicon's three candles with the gap, drawn with the chart tokens. */
function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" width={22} height={22} aria-hidden className="shrink-0">
      <rect x="7" y="9" width="1.5" height="15" rx=".75" className="fill-candle-down" />
      <rect x="5" y="12" width="5.5" height="8" rx="1" className="fill-candle-down" />
      <rect x="15.25" y="5" width="1.5" height="19" rx=".75" className="fill-accent" />
      <rect x="13.25" y="8" width="5.5" height="12" rx="1" className="fill-accent" />
      <rect x="23.5" y="11" width="1.5" height="14" rx=".75" className="fill-candle-up" />
      <rect x="21.5" y="14" width="5.5" height="8" rx="1" className="fill-candle-up" />
    </svg>
  );
}

/** Small count next to "Mistakes". Hidden at zero. */
function CountBadge({ count }: { count: number | null }) {
  if (!count) return null;
  return (
    <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface px-1.5 text-[11px] font-semibold tabular-nums text-foreground ring-1 ring-control">
      {count > 99 ? "99+" : count}
      <span className="sr-only"> to review</span>
    </span>
  );
}

/** Email, and Log out, behind one button. Escape or a click outside closes
 * it; Escape returns focus to the button. */
function AccountMenu({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointer(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const initial = email.charAt(0).toUpperCase() || "?";
  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label="Account"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-1 rounded-md px-1.5 text-muted transition-colors hover:text-foreground"
      >
        <span
          aria-hidden
          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface text-xs font-semibold text-foreground ring-1 ring-control"
        >
          {initial}
        </span>
        <ChevronDownIcon className="h-4 w-4" />
      </button>
      {open && (
        <div
          id="account-menu"
          className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-line bg-surface p-1.5 shadow-lg shadow-black/40"
        >
          <div className="px-3 pt-2 pb-2.5 text-xs">
            <p className="text-muted">Signed in as</p>
            <p className="mt-0.5 truncate text-sm text-foreground">{email}</p>
          </div>
          <div className="border-t border-line pt-1.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className="flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm text-foreground transition-colors hover:bg-background"
            >
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TopNav() {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const mistakes = useOpenMistakeCount(user?.id ?? null);
  const signedIn = !loading && user !== null;

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4 sm:h-14 sm:px-6">
          <Link
            href={signedIn ? "/dashboard" : "/"}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold tracking-tight text-foreground sm:text-base"
          >
            <BrandMark />
            ICT Practice
          </Link>

          {signedIn && (
            <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
              {NAV_ITEMS.map(({ href, label }) => {
                const active = isActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`relative inline-flex min-h-11 items-center px-3 text-sm transition-colors ${
                      active ? "text-foreground" : "text-muted hover:text-foreground"
                    }`}
                  >
                    {label}
                    {href === "/mistakes" && <CountBadge count={mistakes} />}
                    {active && <span aria-hidden className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="flex items-center gap-2">
            {signedIn && user && <AccountMenu email={user.email ?? ""} onSignOut={() => void signOut()} />}
            {!loading && !user && (
              <Link href="/login" className="inline-flex min-h-11 items-center px-2 text-sm text-muted transition-colors hover:text-foreground">
                Log in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Phones get a bottom tab bar instead of a wrapped top nav: thumb
          reach, and the header stays one short row. */}
      {signedIn && (
        <nav
          aria-label="Primary"
          className="bottom-nav fixed inset-x-0 bottom-0 z-20 border-t border-line bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
        >
          <ul className="grid grid-cols-4">
            {NAV_ITEMS.map(({ href, label, Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                      active ? "text-accent" : "text-muted"
                    }`}
                  >
                    <span className="relative">
                      <Icon />
                      {href === "/mistakes" && mistakes ? (
                        <span className="absolute -top-1.5 -right-2.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold tabular-nums text-background">
                          {mistakes > 99 ? "99+" : mistakes}
                          <span className="sr-only"> to review</span>
                        </span>
                      ) : null}
                    </span>
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}
