"use client";

import { useExperience } from "@/contexts/experience-context";
import { EXPERIENCE_LEVELS } from "@/lib/experience";

/** The beginner / experienced choice, with what each changes. Used in
 * onboarding (/welcome), the dashboard prompt for anyone who skipped it, and
 * Settings. `details` lists the behaviours under each option. */
export function ExperienceChoice({ details = true, onChoose }: { details?: boolean; onChoose?: () => void }) {
  const { level, chosen, setLevel } = useExperience();
  return (
    <div role="group" aria-label="Experience level" className="grid gap-3 sm:grid-cols-2">
      {EXPERIENCE_LEVELS.map((opt) => {
        const selected = chosen && level === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              setLevel(opt.value);
              onChoose?.();
            }}
            className={`rounded-lg border p-4 text-left transition-colors ${
              selected ? "border-accent bg-accent/10" : "border-control hover:bg-surface"
            }`}
          >
            <span className={`block text-base font-semibold ${selected ? "text-accent" : "text-foreground"}`}>{opt.label}</span>
            <span className="mt-0.5 block text-sm text-muted">{opt.summary}</span>
            {details && (
              <ul className="mt-3 space-y-1.5 text-sm text-muted">
                {opt.details.map((d) => (
                  <li key={d} className="flex gap-2">
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />
                    {d}
                  </li>
                ))}
              </ul>
            )}
          </button>
        );
      })}
    </div>
  );
}
