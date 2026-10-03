import { ImageResponse } from "next/og";
import { BRAND_COLORS, markDataUri } from "@/lib/brand";
import { SITE_NAME } from "@/lib/site";

// The link preview for every page (Open Graph and Twitter). Colors come
// from src/lib/brand.ts, which mirrors the tokens in globals.css; a
// generated image can't read CSS variables.

export const alt = `${SITE_NAME}: graded practice for reading ICT concepts on NQ charts`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const c = BRAND_COLORS;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: c.background, padding: 72 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <img src={markDataUri()} width={56} height={56} alt="" />
            <div style={{ display: "flex", marginLeft: 18, fontSize: 32, color: c.foreground, fontWeight: 600 }}>{SITE_NAME}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, color: c.muted, textTransform: "uppercase", marginBottom: 28 }}>
              ICT concepts · NQ futures · Practice
            </div>
            <div style={{ display: "flex", fontSize: 68, lineHeight: 1.06, color: c.foreground, fontWeight: 700 }}>Stop watching setups.</div>
            <div style={{ display: "flex", fontSize: 68, lineHeight: 1.06, color: c.accent, fontWeight: 700 }}>Start spotting them.</div>
            <div style={{ display: "flex", marginTop: 28, fontSize: 30, color: c.muted, maxWidth: 640 }}>
              Mark the answer on the chart and get graded feedback that explains the rule.
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: c.muted }}>Educational use only. Not financial advice.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 380 }}>
          <img src={markDataUri()} width={340} height={340} alt="" />
        </div>
      </div>
    ),
    size,
  );
}
