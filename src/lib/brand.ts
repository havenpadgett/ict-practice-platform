// The ICT Practice mark, as data. One source for the nav, the favicon files,
// the social preview and the share cards, so they can't drift apart.
//
// The mark is the product's own geometry, a bullish Fair Value Gap: three
// candles, where the first candle's high sits below the third candle's low
// and the gap between them is the marked zone (docs/CURRICULUM.md → Fair
// Value Gap). Candles are plain off-white; the zone is the one mint element,
// as the accent is everywhere else in the app (docs/DESIGN-SYSTEM.md).
// Coordinates are on a 32 × 32 grid; y grows downward like a chart's pixels,
// so "higher price" is a smaller y.

export const BRAND_COLORS = {
  background: "#0d0e10",
  foreground: "#ededea",
  accent: "#34d399",
  muted: "#9ca0a7",
  line: "#26292e",
} as const;

type Rect = { x: number; y: number; w: number; h: number; r?: number };

export const MARK = {
  size: 32,
  /** Candle 1 (low), candle 2 (the displacement candle), candle 3 (high). */
  wicks: [
    { x: 6.25, y: 15.5, w: 1.5, h: 12.5 },
    { x: 15.25, y: 2.5, w: 1.5, h: 27 },
    { x: 24.25, y: 1.5, w: 1.5, h: 10 },
  ] satisfies Rect[],
  bodies: [
    { x: 3.5, y: 18.5, w: 7, h: 8, r: 1 },
    { x: 12.5, y: 5, w: 7, h: 20, r: 1 },
    { x: 21.5, y: 3, w: 7, h: 6.5, r: 1 },
  ] satisfies Rect[],
  /** The gap: from candle 3's low (y 11.5) down to candle 1's high
   * (y 15.5), across the three candles. */
  zone: { x: 5, y: 11.5, w: 22, h: 4 } satisfies Rect,
} as const;

/** The mark as a standalone SVG document string (the file icons, the
 * Satori share cards): a rounded dark tile, or bare when `tile` is false. */
export function markSvg(options: { tile?: boolean; ink?: string; accent?: string; tileFill?: string } = {}): string {
  const { tile = true, ink = BRAND_COLORS.foreground, accent = BRAND_COLORS.accent, tileFill = BRAND_COLORS.background } = options;
  const rect = (r: Rect, fill: string, extra = "") =>
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"${r.r ? ` rx="${r.r}"` : ""} fill="${fill}"${extra}/>`;
  const z = MARK.zone;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    (tile ? `<rect width="32" height="32" rx="7" fill="${tileFill}"/><g transform="translate(16 16) scale(.84) translate(-16 -16)">` : "") +
    `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" fill="${accent}"/>` +
    MARK.wicks.map((w) => rect(w, ink)).join("") +
    MARK.bodies.map((b) => rect(b, ink)).join("") +
    (tile ? `</g>` : "") +
    `</svg>`
  );
}

/** The mark as a data URI, for `<img>` inside generated images. */
export function markDataUri(options: Parameters<typeof markSvg>[0] = {}): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(markSvg(options))}`;
}
