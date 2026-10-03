/* eslint-disable @next/next/no-img-element -- Satori draws <img>; next/image does not apply in generated images */
import { ImageResponse } from "next/og";
import type { Exercise } from "@/data/exercises";
import { BRAND_COLORS, markDataUri } from "@/lib/brand";
import { ChartSvg } from "@/lib/card/chart";
import { cardFonts } from "@/lib/card/fonts";
import { conceptDisplayName, DIFFICULTY_LABELS } from "@/lib/concepts";
import { toPublicExercise } from "@/lib/public-exercise";
import { SITE_NAME } from "@/lib/site";

export const OG_SIZE = { width: 1200, height: 630 };

/** The link preview for a public chart: the chart and the question, never
 * the answer. It draws only what the page itself shows before anyone
 * answers (toPublicExercise strips the rest). `badge` names the daily. */
export function challengeOgImage(exercise: Exercise | null, badge: string | null = null): ImageResponse {
  const c = BRAND_COLORS;
  const pub = exercise ? toPublicExercise(exercise) : null;
  const candles = pub && pub.answer_type !== "free" ? pub.candles : null;
  const context = pub?.answer_type === "choice" ? pub : null;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: c.background, padding: 56, fontFamily: "Geist" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 380 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <img src={markDataUri()} width={48} height={48} alt="" />
            <div style={{ display: "flex", marginLeft: 14, fontSize: 28, color: c.foreground, fontWeight: 600 }}>{SITE_NAME}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {badge && <div style={{ display: "flex", fontSize: 22, letterSpacing: 3, color: c.accent, textTransform: "uppercase", marginBottom: 12 }}>{badge}</div>}
            <div style={{ display: "flex", fontSize: 22, letterSpacing: 3, color: c.muted, textTransform: "uppercase", marginBottom: 20 }}>
              {pub ? `${conceptDisplayName(pub.concept)} · ${DIFFICULTY_LABELS[pub.difficulty]}` : "Chart challenge"}
            </div>
            <div style={{ display: "flex", fontSize: 52, lineHeight: 1.08, color: c.foreground, fontWeight: 600 }}>Can you read this chart?</div>
            <div style={{ display: "flex", marginTop: 22, fontSize: 26, color: c.accent, fontWeight: 600 }}>Mark your answer. No account needed.</div>
          </div>
          <div style={{ display: "flex", fontSize: 20, color: c.muted }}>Educational use only.</div>
        </div>
        <div
          style={{
            display: "flex",
            flex: 1,
            marginLeft: 48,
            alignItems: "center",
            justifyContent: "center",
            background: "#15171a",
            border: `2px solid ${c.line}`,
            borderRadius: 16,
          }}
        >
          {candles ? (
            <ChartSvg
              candles={candles}
              width={640}
              height={500}
              marks={{ contextZone: context?.fvg_zone ?? null, dealingRange: context?.dealing_range ?? null }}
            />
          ) : (
            <img src={markDataUri()} width={240} height={240} alt="" />
          )}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: cardFonts },
  );
}
