import { describe, expect, it } from "vitest";
import { fromRow, resample, seriesAt, supportedTimeframes, type SimCandle, type TimeframeData } from "@/lib/engine/candles";
import { bucketStart, etMinutes } from "@/lib/engine/time";
import type { Scenario } from "@/lib/engine/types";
import sim001 from "@/data/sim-scenarios/sim-001.json";

const s = sim001 as unknown as Scenario;
const data: TimeframeData = {
  history: Object.fromEntries(Object.entries(s.data.history).map(([k, v]) => [k, (v ?? []).map(fromRow)])),
  stream: s.data.stream.map(fromRow),
  streamTimeframe: "1m",
};

describe("buckets", () => {
  it("anchors Daily and 4H at 18:00 ET and the rest on the clock", () => {
    const t = etMinutes(2030, 1, 22, 9, 37);
    expect(bucketStart(t, "5m")).toBe(etMinutes(2030, 1, 22, 9, 35));
    expect(bucketStart(t, "15m")).toBe(etMinutes(2030, 1, 22, 9, 30));
    expect(bucketStart(t, "1H")).toBe(etMinutes(2030, 1, 22, 9, 0));
    expect(bucketStart(t, "4H")).toBe(etMinutes(2030, 1, 22, 6, 0));
    expect(bucketStart(t, "1D")).toBe(etMinutes(2030, 1, 21, 18, 0));
  });
});

describe("resampling", () => {
  it("builds each coarse candle from the finer ones inside it", () => {
    const fives = resample(data.stream, "5m");
    for (const bar of fives.slice(10, 20)) {
      const inside = data.stream.filter((c) => c.t >= bar.t && c.t < bar.t + 5);
      expect(bar.o).toBe(inside[0].o);
      expect(bar.c).toBe(inside[inside.length - 1].c);
      expect(bar.h).toBe(Math.max(...inside.map((c) => c.h)));
      expect(bar.l).toBe(Math.min(...inside.map((c) => c.l)));
    }
  });

  it("is consistent across timeframes: the 1H high is the highest 5m high in it", () => {
    const hours = resample(data.stream, "1H");
    const fives = resample(data.stream, "5m");
    for (const h of hours.slice(2, 8)) {
      const inside = fives.filter((c) => c.t >= h.t && c.t < h.t + 60);
      expect(h.h).toBe(Math.max(...inside.map((c) => c.h)));
      expect(h.l).toBe(Math.min(...inside.map((c) => c.l)));
    }
  });
});

describe("no lookahead", () => {
  it("the forming candle at the cursor uses only revealed candles", () => {
    const revealed = s.cursorStart;
    const known = data.stream.slice(0, revealed);
    for (const tf of ["4H", "1H", "15m", "5m"] as const) {
      const series = seriesAt(data, tf, revealed);
      const last = series[series.length - 1];
      const inBucket = known.filter((c) => bucketStart(c.t, tf) === last.t);
      expect(last.h).toBe(Math.max(...inBucket.map((c) => c.h)));
      expect(last.l).toBe(Math.min(...inBucket.map((c) => c.l)));
      expect(last.c).toBe(inBucket[inBucket.length - 1].c);
    }
  });

  it("every timeframe's last candle opens at or before the cursor", () => {
    const cursorT = data.stream[s.cursorStart - 1].t;
    for (const tf of ["1D", "4H", "1H", "15m", "5m", "1m"] as const) {
      const series = seriesAt(data, tf, s.cursorStart);
      expect(series[series.length - 1].t).toBeLessThanOrEqual(cursorT);
    }
  });

  it("revealing one more candle only ever changes the last candle", () => {
    const a = seriesAt(data, "5m", s.cursorStart);
    const b = seriesAt(data, "5m", s.cursorStart + 1);
    expect(b.slice(0, a.length - 1)).toEqual(a.slice(0, a.length - 1));
  });
});

describe("timeframe support", () => {
  it("offers all six where the data holds them, and never a finer one than the stream", () => {
    expect(supportedTimeframes(data, s.cursorStart)).toEqual(["1D", "4H", "1H", "15m", "5m", "1m"]);
    const coarse: TimeframeData = { ...data, stream: resample(data.stream, "5m"), streamTimeframe: "5m" };
    expect(supportedTimeframes(coarse, 50)).not.toContain("1m");
  });

  it("withholds a timeframe without enough bars", () => {
    const thin: TimeframeData = { ...data, history: { ...data.history, "1D": data.history["1D"]?.slice(-2) ?? [] } };
    expect(supportedTimeframes(thin, s.cursorStart)).not.toContain("1D");
  });

  it("the stream starts on a Daily boundary so no bucket straddles the seam", () => {
    const first = data.stream[0] as SimCandle;
    expect(bucketStart(first.t, "1D")).toBe(first.t);
  });
});
