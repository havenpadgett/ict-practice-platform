// One-line definitions of the things a trader marks, for the beginner tier
// of the explanations. An advanced reader is never shown these (docs/ENGINE.md
// → Explanations that mature with skill). Source: docs/CURRICULUM.md.

import type { AnnotationKind } from "@/lib/engine/types";

export const KIND_DEFINITION: Partial<Record<AnnotationKind, string>> = {
  liquidity: "Liquidity is resting stop orders above highs and below lows. Price is drawn toward them because that's where orders are.",
  fvg: "A Fair Value Gap is a three-candle imbalance: candle 1's high sits below candle 3's low (bullish), or candle 1's low above candle 3's high (bearish).",
  ob: "An order block is the last opposing candle before a displacement that breaks structure; its range is the zone.",
  zone: "A zone is a price range where something happened that you expect to matter again.",
  swing_high: "A swing high is a high with lower highs on both sides. Stops rest above it.",
  swing_low: "A swing low is a low with higher lows on both sides. Stops rest below it.",
};

export type ExplanationTier = "define" | "relate" | "decide";
