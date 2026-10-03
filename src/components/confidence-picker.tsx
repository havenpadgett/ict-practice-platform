"use client";

import { useEffect } from "react";
import { CONFIDENCE_LEVELS, type Confidence } from "@/lib/confidence";

/** "How sure are you?" before submitting. Optional by design: nothing waits
 * on it, picking the same option again clears it, and 1/2/3 on the keyboard
 * set it for anyone who answers quickly. The rating is stored with the
 * attempt and compared with the verdict in Analytics. */
export function ConfidencePicker({
  value,
  onChange,
  disabled = false,
  className = "",
}: {
  value: Confidence | null;
  onChange: (value: Confidence | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  useEffect(() => {
    if (disabled) return;
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const level = CONFIDENCE_LEVELS.find((l) => String(l.value) === e.key);
      if (level) onChange(value === level.value ? null : level.value);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [value, onChange, disabled]);

  return (
    <fieldset className={className} disabled={disabled}>
      <legend className="text-xs text-muted">
        How sure are you? <span className="text-muted">Optional</span>
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {CONFIDENCE_LEVELS.map((level) => (
          <button
            key={level.value}
            type="button"
            aria-pressed={value === level.value}
            aria-keyshortcuts={String(level.value)}
            title={`${level.hint} (press ${level.value})`}
            onClick={() => onChange(value === level.value ? null : level.value)}
            className="btn-option px-3.5 text-xs"
          >
            {level.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
