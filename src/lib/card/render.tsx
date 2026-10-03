// The share card's layout: clean and plain, in the app's own colors and
// type. A chart with the learner's mark (solid) against the correct one
// (dashed mint), the result, the concept, the brand. It carries no money,
// P&L or R figure and no engagement number: a score is the session's own
// count, nothing else.

import { BRAND_COLORS as C, markDataUri } from "@/lib/brand";
import { ChartSvg } from "@/lib/card/chart";
import type { CardData } from "@/lib/card/model";
import { SITE_NAME } from "@/lib/site";

export const CARD_SIZE = { width: 1200, height: 630 };

const TONE: Record<CardData["tone"], string> = {
  correct: C.accent,
  could_improve: "#fbbf24",
  incorrect: "#f0766b",
  neutral: C.foreground,
};

function Swatch({ dashed, solid }: { dashed?: boolean; solid?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        width: 30,
        height: 18,
        borderRadius: 4,
        border: `3px ${dashed ? "dashed" : "solid"} ${solid ? C.foreground : C.accent}`,
        background: solid ? "rgba(237,237,234,0.1)" : "rgba(52,211,153,0.14)",
      }}
    />
  );
}

function VerdictIcon({ tone }: { tone: CardData["tone"] }) {
  if (tone === "neutral") return null;
  const color = TONE[tone];
  const path =
    tone === "correct"
      ? "M4.75 8.25 7 10.5l4.25-4.75"
      : tone === "incorrect"
        ? "M5.5 5.5l5 5m0-5-5 5"
        : "M4.5 9.25c.9-1.5 1.8-1.5 2.7 0s1.8 1.5 2.7 0 1.8-1.5 2.7 0";
  return (
    <svg width={64} height={64} viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="7.25" fill="none" stroke={color} strokeWidth="1.2" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CardView({ card }: { card: CardData }) {
  const color = TONE[card.tone];
  const hasMarks = card.chart && (card.chart.marks.userZone || card.chart.marks.userLevel != null || card.chart.marks.userGuided);
  const isScore = card.headline.includes("/");

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: C.background, padding: 44, fontFamily: "Geist" }}>
      {/* Chart */}
      <div style={{ display: "flex", flexDirection: "column", width: 700 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 700,
            height: hasMarks ? 480 : 542,
            background: "#15171a",
            border: `2px solid ${C.line}`,
            borderRadius: 18,
          }}
        >
          {card.chart ? (
            <ChartSvg candles={card.chart.candles} width={672} height={hasMarks ? 452 : 514} marks={card.chart.marks} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              {card.chips.map((chip) => (
                <div key={chip} style={{ display: "flex", fontSize: 40, color: C.foreground, marginBottom: 14 }}>
                  {chip}
                </div>
              ))}
            </div>
          )}
        </div>
        {hasMarks && (
          <div style={{ display: "flex", alignItems: "center", marginTop: 18, fontSize: 22, color: C.muted }}>
            <Swatch solid />
            <div style={{ display: "flex", marginLeft: 12 }}>Your mark</div>
            <div style={{ display: "flex", marginLeft: 34 }}>
              <Swatch dashed />
            </div>
            <div style={{ display: "flex", marginLeft: 12 }}>Correct answer</div>
          </div>
        )}
      </div>

      {/* Result */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, marginLeft: 48 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {card.badge && (
            <div style={{ display: "flex", fontSize: 20, letterSpacing: 2.5, color: C.accent, textTransform: "uppercase", marginBottom: 12 }}>{card.badge}</div>
          )}
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 2, color: C.muted, textTransform: "uppercase", lineHeight: 1.3 }}>{card.eyebrow}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {!isScore && <VerdictIcon tone={card.tone} />}
            <div
              style={{
                display: "flex",
                marginLeft: isScore ? 0 : 18,
                fontSize: isScore ? 120 : card.headline.length > 14 ? 46 : 62,
                lineHeight: 1,
                fontWeight: 600,
                color,
              }}
            >
              {card.headline}
            </div>
          </div>
          {card.sub && <div style={{ display: "flex", marginTop: 14, fontSize: 32, color: C.foreground }}>{card.sub}</div>}
          {card.detail && <div style={{ display: "flex", marginTop: 22, fontSize: 25, lineHeight: 1.35, color: C.muted }}>{card.detail}</div>}
          {card.chart && card.chips.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", marginTop: 26 }}>
              {card.chips.map((chip) => (
                <div
                  key={chip}
                  style={{
                    display: "flex",
                    fontSize: 21,
                    color: C.foreground,
                    border: `2px solid ${C.line}`,
                    borderRadius: 999,
                    padding: "6px 16px",
                    marginRight: 10,
                    marginBottom: 10,
                  }}
                >
                  {chip}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={markDataUri()} width={44} height={44} alt="" />
            <div style={{ display: "flex", marginLeft: 14, fontSize: 28, fontWeight: 600, color: C.foreground }}>{SITE_NAME}</div>
          </div>
          <div style={{ display: "flex", marginTop: 8, fontSize: 18, color: C.muted }}>Educational use only. Not financial advice.</div>
        </div>
      </div>
    </div>
  );
}
