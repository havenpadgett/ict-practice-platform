import type { ReactNode } from "react";

export const LEGAL_UPDATED = "October 29, 2026";

/** Shared shell for /disclaimer, /privacy and /terms. */
export function LegalPage({ title, lede, children }: { title: string; lede: string; children: ReactNode }) {
  return (
    <div className="page max-w-3xl">
      <h1 className="page-title">{title}</h1>
      <p className="page-lede">{lede}</p>
      <p className="mt-2 text-xs text-muted">Last updated {LEGAL_UPDATED}.</p>
      <div className="mt-8 space-y-8 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg">{heading}</h2>
      <div className="mt-2 space-y-2 text-muted">{children}</div>
    </section>
  );
}
