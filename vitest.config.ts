import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // tests/sql/* boot an in-process Postgres (PGlite) and apply every
    // migration in beforeAll. With all files in parallel that exceeds the
    // 10s hook default on a busy machine, and a timed-out hook skips every
    // test in its file.
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/supabase/**"],
      reporter: ["text-summary", "text"],
      reportOnFailure: true,
    },
  },
});
