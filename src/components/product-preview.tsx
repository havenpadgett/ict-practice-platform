"use client";

import { CandlestickChart } from "@/components/practice/candlestick-chart";
import { CheckRow, Verdict } from "@/components/verdict";
import { PREVIEW_CANDLES, PREVIEW_GAP, PREVIEW_USER_BOX } from "@/data/preview-chart";

const noop = () => {};

/** The landing page's picture of the product: a real chart component with
 * a learner's box (solid), the correct gap (dashed) and the feedback it
 * produced. Built from a preview-only chart, never a practice exercise. */
export function ProductPreview() {
  return (
    <figure className="rounded-xl border border-line bg-surface p-3 sm:p-4">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <p className="text-sm text-foreground">Identify the Fair Value Gap, if there is one.</p>
        <p className="eyebrow shrink-0">FVG · Easy</p>
      </div>
      <div className="mt-2">
        <CandlestickChart
          answerType="zone"
          candles={PREVIEW_CANDLES}
          interactive={false}
          userRegion={PREVIEW_USER_BOX}
          onUserRegionChange={noop}
          correctZone={PREVIEW_GAP}
        />
      </div>
      <div className="mt-3 rounded-lg border border-line bg-background p-4">
        <Verdict correct={false} />
        <p className="mt-2 text-sm text-foreground">You found it, but your selection was too broad.</p>
        <ul className="mt-3 space-y-2">
          <CheckRow passed label="Coverage">
            Your box covers 100% of the gap (60% needed).
          </CheckRow>
          <CheckRow passed label="Candles">
            Your box spans the middle candle of the three.
          </CheckRow>
          <CheckRow passed={false} label="Size">
            Your box is 2.8× the gap&apos;s height (up to 2.5× passes).
          </CheckRow>
        </ul>
      </div>
      <figcaption className="sr-only">
        Example feedback: a box drawn over the right candles but too tall, next to the correct Fair Value Gap drawn dashed.
      </figcaption>
    </figure>
  );
}
