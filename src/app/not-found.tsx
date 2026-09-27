import type { Metadata } from "next";
import Link from "next/link";
import { PrimaryButton } from "@/components/primary-button";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

/** Any URL that doesn't match a page. Kept on-brand: the same shell, a
 * chart with no candle where one should be, and the ways back in. */
export default function NotFound() {
  return (
    <div className="page">
      <svg viewBox="0 0 120 64" className="h-16 w-32" aria-hidden="true">
        <line x1="14" y1="10" x2="14" y2="50" className="stroke-candle-down" strokeWidth="2" />
        <rect x="8" y="18" width="12" height="22" rx="2" className="fill-candle-down" />
        <line x1="40" y1="6" x2="40" y2="44" className="stroke-candle-up" strokeWidth="2" />
        <rect x="34" y="12" width="12" height="22" rx="2" className="fill-candle-up" />
        <rect x="60" y="14" width="12" height="36" rx="2" className="fill-none stroke-muted" strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="92" y1="16" x2="92" y2="58" className="stroke-candle-up" strokeWidth="2" />
        <rect x="86" y="22" width="12" height="26" rx="2" className="fill-candle-up" />
      </svg>
      <p className="eyebrow mt-6">404 · Page not found</p>
      <h1 className="page-title mt-2">There&apos;s no candle here.</h1>
      <p className="page-lede max-w-xl">
        The page you were looking for doesn&apos;t exist or has moved. Your progress is safe. Pick up where you left off.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <PrimaryButton href="/dashboard">Go to your dashboard</PrimaryButton>
        <Link href="/practice" className="btn-secondary">
          Practice
        </Link>
        <Link href="/" className="btn-link">
          Home
        </Link>
      </div>
    </div>
  );
}
