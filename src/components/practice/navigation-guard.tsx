"use client";

import { useEffect } from "react";

const MESSAGE = "Leave this exercise? Your answer so far is saved, so you can pick up where you left off.";

/** Asks before leaving the page while `active`: closing or reloading the
 * tab (the browser's own prompt) and clicking a link to another page
 * (in-app navigation never fires beforeunload, so links are caught here). */
export function NavigationGuard({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Older browsers need returnValue set to show the prompt.
      e.returnValue = "";
    }
    // Capture phase on the document runs before Next.js's Link handler, so
    // cancelling here stops the client-side navigation too.
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);
  return null;
}
