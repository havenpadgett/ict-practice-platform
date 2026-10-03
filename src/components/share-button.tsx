"use client";

import { useRef, useState } from "react";

/** Shares a link: the system share sheet where there is one (phones), else
 * the clipboard. `path` is a same-site path; the absolute URL is built here
 * so the link is right on whichever domain this is served from. */
export function ShareButton({
  path,
  title,
  text,
  label = "Share this challenge",
  className = "btn-secondary",
}: {
  path: string;
  title: string;
  text: string;
  label?: string;
  className?: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "manual">("idle");
  const input = useRef<HTMLInputElement>(null);
  const url = typeof window === "undefined" ? path : new URL(path, window.location.origin).toString();

  async function share() {
    const absolute = new URL(path, window.location.origin).toString();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url: absolute });
        return;
      } catch (err) {
        // Dismissing the sheet is not a failure; anything else falls through to copying.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(absolute);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("manual");
      window.setTimeout(() => input.current?.select(), 0);
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <button type="button" onClick={() => void share()} className={className}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 10V2.5M5 5.25 8 2.25l3 3M3.5 8v4.5h9V8" />
        </svg>
        {label}
      </button>
      <span role="status" aria-live="polite" className="text-xs text-muted">
        {status === "copied" ? "Link copied." : ""}
      </span>
      {status === "manual" && (
        <label className="block text-xs text-muted">
          Copy this link
          <input ref={input} readOnly value={url} className="field mt-1" onFocus={(e) => e.currentTarget.select()} />
        </label>
      )}
    </div>
  );
}
