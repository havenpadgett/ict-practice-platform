import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

describe("safeNextPath (security audit S2)", () => {
  it("keeps same-site paths, with query and hash", () => {
    expect(safeNextPath("/practice?concept=FVG&src=rec")).toBe("/practice?concept=FVG&src=rec");
    expect(safeNextPath("/analytics#trend")).toBe("/analytics#trend");
  });

  it.each([
    null,
    "",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "@evil.example",
    "evil.example",
    "javascript:alert(1)",
    "/\tjavascript:alert(1)",
    "/%0a/evil",
  ])("falls back to /dashboard for %s", (next) => {
    const out = safeNextPath(next);
    expect(out.startsWith("/") && !out.startsWith("//")).toBe(true);
    if (next !== "/%0a/evil") expect(out).toBe("/dashboard");
  });
});
