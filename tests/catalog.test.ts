import { describe, expect, it } from "vitest";
import { catalog } from "@/data/catalog";
import { buildCatalog } from "@/data/catalog-builder";

describe("exercise catalog", () => {
  it("matches the full exercise data (run `npm run catalog` if this fails)", () => {
    expect(catalog).toEqual(buildCatalog());
  });
});
