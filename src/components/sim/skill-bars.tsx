import { WEAK_BELOW } from "@/lib/engine/skill-config";
import type { SkillVector } from "@/lib/engine/skills";
import { SKILLS, SKILL_LABEL, type SkillId } from "@/lib/engine/types";
import { SKILL_BLURB } from "@/lib/engine/skill-config";

/** The seven skills as separate bars, never one score. A bar with no
 * measurement says so instead of showing a made-up number. */
export function SkillBars({ vector, onTrain }: { vector: SkillVector; onTrain?: (skill: SkillId) => void }) {
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
      {SKILLS.map((skill) => {
        const r = vector[skill];
        const pct = r.score === null ? null : Math.round(r.score * 100);
        return (
          <li key={skill} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr_auto] sm:items-center sm:gap-4">
            <div>
              <p className="text-sm text-foreground">{SKILL_LABEL[skill]}</p>
              <p className="text-xs">{SKILL_BLURB[skill]}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                {pct !== null ? <div className="h-full bg-foreground/80" style={{ width: `${pct}%` }} /> : <div className="h-full w-full border border-dashed border-control bg-transparent" />}
              </div>
              <p className="w-28 text-right text-sm tabular-nums text-foreground">
                {pct !== null ? `${pct}%` : <span className="text-muted">not measured</span>}
                {pct !== null && r.score !== null && r.score < WEAK_BELOW && <span className="ml-1 text-xs text-warn">weak</span>}
              </p>
            </div>
            {onTrain && (
              <button type="button" onClick={() => onTrain(skill)} className="btn-link justify-self-start text-xs sm:justify-self-end">
                Train {SKILL_LABEL[skill]}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
