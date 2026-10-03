"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getGlossaryEntry, type GlossaryEntry } from "@/data/glossary";
import { termLabel, type Match } from "@/lib/glossary-match";

// Hover definitions for the app's ICT terms, pulled from the glossary
// (src/data/glossary.ts). The first use of a term on a page spells out its
// full name with the acronym in brackets; later uses are the acronym.
// "First" is the first one rendered, which on the server and in the browser
// is document order; it's remembered per instance (useId), so rendering the
// same instance twice (Strict Mode) can't change which one was first.

type Scope = { claim: (entryId: string, instance: string) => boolean };
const ScopeContext = createContext<Scope | null>(null);

/** Resets "first use" whenever the page changes. `scopeKey` starts a fresh
 * scope inside a page too: each exercise on the practice screen is its own
 * "page" for this, so its prompt spells out the full name again. */
export function GlossaryScope({ children, scopeKey = "" }: { children: ReactNode; scopeKey?: string }) {
  const pathname = usePathname();
  const scope = useMemo<Scope>(() => {
    const owners = new Map<string, string>();
    return {
      claim(entryId, instance) {
        if (!owners.has(entryId)) owners.set(entryId, instance);
        return owners.get(entryId) === instance;
      },
    };
    // A new scope per page: the pathname and key are the dependencies on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, scopeKey]);
  return <ScopeContext.Provider value={scope}>{children}</ScopeContext.Provider>;
}

const GAP = 8;
const MARGIN = 8;

function Tooltip({ entry, anchor, id, onEnter, onLeave }: { entry: GlossaryEntry; anchor: HTMLElement; id: string; onEnter: () => void; onLeave: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; below: boolean } | null>(null);

  useEffect(() => {
    const tip = ref.current;
    if (!tip) return;
    const a = anchor.getBoundingClientRect();
    const t = tip.getBoundingClientRect();
    const below = a.top - t.height - GAP < MARGIN;
    const left = Math.min(Math.max(MARGIN, a.left + a.width / 2 - t.width / 2), window.innerWidth - t.width - MARGIN);
    // Measuring the rendered tooltip is the external sync this effect is for.
    setPos({ top: below ? a.bottom + GAP : a.top - t.height - GAP, left, below });
  }, [anchor]);

  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: "hidden" }}
      className="fixed z-50 w-72 max-w-[calc(100vw-1rem)] rounded-lg border border-control bg-surface p-3 text-left text-sm font-normal normal-case tracking-normal text-muted shadow-lg"
    >
      <p className="font-semibold text-foreground">
        {entry.name}
        {entry.abbr && <span className="ml-1.5 font-normal text-muted">({entry.abbr})</span>}
      </p>
      <p className="mt-1 leading-snug">{entry.short}</p>
      <Link href={`/glossary#${entry.id}`} className="mt-2 inline-block text-xs text-foreground underline underline-offset-4">
        In the glossary
      </Link>
    </div>
  );
}

/** One term in running text, with its definition on hover, keyboard focus or
 * tap. Escape closes it; the pointer can move onto it (it stays until the
 * pointer leaves both). */
export function Term({
  id,
  match,
  children,
  plain = false,
}: {
  id: string;
  /** How the text matched (from GlossaryText); omit to show `children` as given. */
  match?: Pick<Match, "matched" | "kind">;
  children?: ReactNode;
  /** Show the (first-use-aware) wording without a tooltip, e.g. inside a button. */
  plain?: boolean;
}) {
  const entry = getGlossaryEntry(id);
  const scope = useContext(ScopeContext);
  const instance = useId();
  const tipId = useId();
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (anchor && !anchor.contains(target) && !target.closest("[role=tooltip]")) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, anchor]);

  if (!entry) return <>{children}</>;
  const takesPart = match && (match.kind === "name" || match.kind === "abbr") && entry.abbr;
  // Claiming during render is idempotent per instance, so it's safe to repeat.
  const first = takesPart && scope ? scope.claim(entry.id, instance) : true;
  const label = match ? termLabel(entry, match.matched, match.kind, first) : children;

  if (plain) return <>{label}</>;

  function cancelClose() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }
  function show() {
    cancelClose();
    setOpen(true);
  }
  function hideSoon() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  }

  return (
    <span className="relative">
      <button
        ref={setAnchor}
        type="button"
        aria-describedby={open ? tipId : undefined}
        aria-expanded={open}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={hideSoon}
        onClick={show}
        className="term"
      >
        {label}
      </button>
      {open && anchor && <Tooltip entry={entry} anchor={anchor} id={tipId} onEnter={cancelClose} onLeave={hideSoon} />}
    </span>
  );
}
