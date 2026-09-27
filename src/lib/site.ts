// Site identity for metadata (titles, descriptions, link previews).

export const SITE_NAME = "ICT Practice";

export const SITE_DESCRIPTION =
  "Graded practice for reading ICT concepts on NQ charts: Fair Value Gaps, liquidity, market structure, order blocks and more. Mark your answer on the chart and get feedback that explains the rule. Educational use only.";

/** Absolute base for Open Graph URLs: NEXT_PUBLIC_SITE_URL if set, else the
 * Vercel production domain, else the local dev server. */
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}
