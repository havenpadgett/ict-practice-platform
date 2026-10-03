import { MARK } from "@/lib/brand";

/** The mark (src/lib/brand.ts), drawn with the app's color tokens so it
 * follows the theme. Decorative: the wordmark beside it carries the name. */
export function BrandMark({ size = 22, className = "" }: { size?: number; className?: string }) {
  const z = MARK.zone;
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden className={`shrink-0 ${className}`}>
      <rect x={z.x} y={z.y} width={z.w} height={z.h} className="fill-accent" />
      {MARK.wicks.map((w) => (
        <rect key={w.x} x={w.x} y={w.y} width={w.w} height={w.h} className="fill-foreground" />
      ))}
      {MARK.bodies.map((b) => (
        <rect key={b.x} x={b.x} y={b.y} width={b.w} height={b.h} rx={b.r} className="fill-foreground" />
      ))}
    </svg>
  );
}
