"use client";

import { useEffect } from "react";
import { logClientError } from "@/lib/error-log";

// Uncaught errors and unhandled promise rejections anywhere in the page go
// to the error log (src/lib/error-log.ts). Render errors are logged by the
// error boundaries (src/app/error.tsx, src/app/global-error.tsx).
export function ErrorListener() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => void logClientError(e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => void logClientError(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
