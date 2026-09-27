import { ImageResponse } from "next/og";

// The link preview for every page (Open Graph and Twitter). Colors mirror
// the tokens in globals.css; a generated image can't read CSS variables.

export const alt = "ICT Practice: graded practice for reading ICT concepts on NQ charts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CANDLES = [
  { wick: [210, 430], body: [260, 380], color: "#e0625a" },
  { wick: [150, 400], body: [190, 330], color: "#e0625a" },
  { wick: [120, 360], body: [230, 330], color: "#2fb380" },
  { wick: [60, 300], body: [90, 250], color: "#34d399" },
  { wick: [80, 250], body: [110, 200], color: "#2fb380" },
];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0d0e10", padding: 72 }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, color: "#9ca0a7", textTransform: "uppercase" }}>
            ICT concepts · NQ futures · Practice
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 64, lineHeight: 1.08, color: "#ededea", fontWeight: 700 }}>
              Stop watching setups.
            </div>
            <div style={{ display: "flex", fontSize: 64, lineHeight: 1.08, color: "#34d399", fontWeight: 700 }}>
              Start spotting them.
            </div>
            <div style={{ display: "flex", marginTop: 28, fontSize: 30, color: "#9ca0a7", maxWidth: 620 }}>
              Mark the answer on the chart and get graded feedback that explains the rule.
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#ededea", fontWeight: 600 }}>ICT Practice</div>
        </div>
        <div style={{ display: "flex", position: "relative", width: 330, height: 480, alignSelf: "center" }}>
          {CANDLES.map((c, i) => (
            <div key={i} style={{ display: "flex", position: "absolute", left: i * 64, top: 0, width: 44, height: 480 }}>
              <div style={{ position: "absolute", left: 19, top: c.wick[0], width: 6, height: c.wick[1] - c.wick[0], background: c.color, borderRadius: 3 }} />
              <div style={{ position: "absolute", left: 0, top: c.body[0], width: 44, height: c.body[1] - c.body[0], background: c.color, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
