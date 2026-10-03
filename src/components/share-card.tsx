"use client";

import { useEffect, useRef, useState } from "react";
import type { CardRequest } from "@/lib/card/model";

type State = { status: "idle" } | { status: "loading" } | { status: "ready"; url: string; blob: Blob } | { status: "error"; message: string };

/** "Create share card": asks the card endpoint (src/app/api/card/route.tsx)
 * for a PNG, shows it, and offers to save it or hand it to the system share
 * sheet. The picture is made on request and not kept anywhere. */
export function ShareCard({
  request,
  filename,
  alt,
  label = "Create share card",
  className = "btn-secondary",
  auto = false,
}: {
  request: CardRequest;
  filename: string;
  alt: string;
  label?: string;
  className?: string;
  /** Make the card as soon as this shows (the session summary). */
  auto?: boolean;
}) {
  const [state, setState] = useState<State>({ status: "idle" });
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  useEffect(() => {
    if (auto) void create();
    // Once, on mount; `request` for a finished session doesn't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
      if (!res.ok) throw new Error("The card couldn't be made right now.");
      const blob = await res.blob();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setState({ status: "ready", url, blob });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "The card couldn't be made right now." });
    }
  }

  async function share(blob: Blob) {
    const file = new File([blob], filename, { type: "image/png" });
    try {
      await navigator.share({ files: [file], title: "ICT Practice" });
    } catch {
      // Dismissed, or not supported after all; the download button is right there.
    }
  }

  const canShareFiles = (() => {
    if (state.status !== "ready" || typeof navigator === "undefined" || typeof navigator.canShare !== "function") return false;
    try {
      return navigator.canShare({ files: [new File([state.blob], filename, { type: "image/png" })] });
    } catch {
      return false;
    }
  })();

  if (state.status === "ready") {
    return (
      <div className="w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={state.url} alt={alt} width={1200} height={630} className="w-full max-w-xl rounded-lg border border-line" />
        <div className="mt-3 flex flex-wrap gap-3">
          <a href={state.url} download={filename} className="btn-primary">
            Download image
          </a>
          {canShareFiles && (
            <button type="button" onClick={() => void share(state.blob)} className="btn-secondary">
              Share image
            </button>
          )}
          {!auto && (
            <button type="button" onClick={() => setState({ status: "idle" })} className="btn-link">
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  if (auto && (state.status === "idle" || state.status === "loading")) {
    return (
      <div
        role="status"
        aria-label="Making your share card"
        className="flex aspect-[1200/630] w-full max-w-xl animate-pulse items-center justify-center rounded-lg border border-line bg-surface text-xs text-muted motion-reduce:animate-none"
      >
        Making your card…
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <button type="button" onClick={() => void create()} disabled={state.status === "loading"} className={className}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1.75" y="3" width="12.5" height="10" rx="1.5" />
          <path d="m2.5 11 3.25-3.25L8.5 10.5l2-2L13.5 11.5" />
        </svg>
        {state.status === "loading" ? "Making card…" : label}
      </button>
      {state.status === "error" && (
        <span role="alert" className="text-xs text-danger">
          {state.message}
        </span>
      )}
    </div>
  );
}
