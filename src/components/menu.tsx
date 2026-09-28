"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** A button that opens a small panel of actions (account, overflow).
 * Escape closes it and returns focus to the button; a click outside or on
 * an item closes it. Items are ordinary links and buttons, so they keep
 * their native keyboard behaviour. */
export function Menu({
  label,
  trigger,
  triggerClassName,
  align = "right",
  width = "w-56",
  children,
}: {
  /** Accessible name for the button. */
  label: string;
  trigger: ReactNode;
  triggerClassName: string;
  align?: "left" | "right";
  width?: string;
  /** Rendered inside the panel; receives a close function. */
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();

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

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          className={`absolute z-30 mt-1 ${width} rounded-lg border border-line bg-surface p-1.5 shadow-lg shadow-black/40 ${align === "right" ? "right-0" : "left-0"}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** Class for an item row inside a Menu. */
export const MENU_ITEM =
  "flex min-h-11 w-full items-center rounded-md px-3 text-left text-sm text-foreground transition-colors hover:bg-background";
