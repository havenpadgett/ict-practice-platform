// DEMO MODE (branch demo-mode; src/lib/demo/gate.ts). The login bypass
// must exist only when NEXT_PUBLIC_DEMO_MODE=true AND NODE_ENV isn't
// production. These tests fail if any way into it (the browser and server
// Supabase clients, the proxy, the demo route, the banner) is reachable
// when either condition is false, or if demo mode ever creates a real
// Supabase client.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const real = { createBrowserClient: vi.fn(), createServerClient: vi.fn() };
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: (...args: unknown[]) => {
    real.createBrowserClient(...args);
    return { real: "browser" };
  },
  createServerClient: (...args: unknown[]) => {
    real.createServerClient(...args);
    return { real: "server", auth: { getUser: async () => ({ data: { user: null } }) } };
  },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));

const { isDemoMode, DEMO_USER } = await import("@/lib/demo/gate");
const { createClient: browserClient } = await import("@/lib/supabase/client");
const { createClient: serverClient } = await import("@/lib/supabase/server");
const { proxy } = await import("@/proxy");
const { POST: demoRoute } = await import("@/app/api/demo/route");
const { DemoBanner } = await import("@/components/demo-banner");
const { resetDemoStore } = await import("@/lib/demo/store");

/** Every combination; only the first may open demo mode. */
const COMBOS: { nodeEnv: string; flag: string | undefined; demo: boolean }[] = [
  { nodeEnv: "development", flag: "true", demo: true },
  { nodeEnv: "production", flag: "true", demo: false },
  { nodeEnv: "development", flag: undefined, demo: false },
  { nodeEnv: "development", flag: "false", demo: false },
  { nodeEnv: "development", flag: "1", demo: false },
  { nodeEnv: "development", flag: "TRUE", demo: false },
  { nodeEnv: "production", flag: undefined, demo: false },
];
const label = (c: (typeof COMBOS)[number]) => `NODE_ENV=${c.nodeEnv}, NEXT_PUBLIC_DEMO_MODE=${c.flag ?? "(unset)"}`;

function setEnv(nodeEnv: string, flag: string | undefined) {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", flag);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
}

const demoQuery = (body: unknown) =>
  demoRoute(new Request("http://localhost/api/demo", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  real.createBrowserClient.mockClear();
  real.createServerClient.mockClear();
  resetDemoStore();
});
afterEach(() => vi.unstubAllEnvs());

describe.each(COMBOS)("$nodeEnv / $flag", (combo) => {
  beforeEach(() => setEnv(combo.nodeEnv, combo.flag));

  it(`the gate is ${combo.demo ? "open" : "closed"}`, () => {
    expect(isDemoMode(), label(combo)).toBe(combo.demo);
  });

  it("browser Supabase client is real unless the gate is open", () => {
    const c = browserClient() as unknown as Record<string, unknown>;
    expect("real" in c, label(combo)).toBe(!combo.demo);
    expect(real.createBrowserClient).toHaveBeenCalledTimes(combo.demo ? 0 : 1);
  });

  it("server Supabase client is real unless the gate is open", async () => {
    const c = (await serverClient()) as unknown as Record<string, unknown>;
    expect("real" in c, label(combo)).toBe(!combo.demo);
    expect(real.createServerClient).toHaveBeenCalledTimes(combo.demo ? 0 : 1);
  });

  it("the proxy only skips login when the gate is open", async () => {
    const res = await proxy(new NextRequest("http://localhost/dashboard"));
    const location = res.headers.get("location");
    if (combo.demo) expect(location, label(combo)).toBeNull();
    else expect(location, label(combo)).toMatch(/\/login/);
  });

  it("the demo route doesn't exist unless the gate is open", async () => {
    const res = await demoQuery({ table: "attempts", action: "select", columns: "*", filters: [], order: null, limit: null });
    expect(res.status, label(combo)).toBe(combo.demo ? 200 : 404);
  });

  it("the demo banner shows exactly when the gate is open", () => {
    expect(DemoBanner() !== null, label(combo)).toBe(combo.demo);
  });
});

describe("in demo mode", () => {
  beforeEach(() => setEnv("development", "true"));

  it("the reviewer reads seeded data, writes only to the demo store, and never reaches Supabase", async () => {
    const supabase = await serverClient();
    const { data: { user } } = await supabase.auth.getUser();
    expect(user?.id).toBe(DEMO_USER.id);

    const before = await supabase.from("attempts").select("exercise_id, is_correct").eq("user_id", DEMO_USER.id).order("created_at", { ascending: true });
    expect((before.data ?? []).length).toBeGreaterThan(20);

    // A write claiming to be someone else still lands as the demo reviewer.
    await supabase.from("attempts").insert({ user_id: "11111111-1111-1111-1111-111111111111", exercise_id: "fvg-001", is_correct: true });
    const other = await supabase.from("attempts").select("id").eq("user_id", "11111111-1111-1111-1111-111111111111");
    expect(other.data).toEqual([]);
    const { count } = await supabase.from("attempts").select("id", { count: "exact", head: true }).eq("user_id", DEMO_USER.id);
    expect(count).toBe((before.data ?? []).length + 1);

    // Only the tables the app writes exist; views fall back, admin stays closed.
    expect((await supabase.from("v_accuracy_by_concept").select("*")).error?.code).toBe("42P01");
    expect((await supabase.rpc("current_role_name")).data).toBe("user");

    expect(real.createServerClient).not.toHaveBeenCalled();
    expect(real.createBrowserClient).not.toHaveBeenCalled();
  });

  it("the browser client goes through the demo route to the same store", async () => {
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => demoQuery(JSON.parse(String(init.body))));
    try {
      const supabase = browserClient();
      await supabase.from("question_reports").insert({ exercise_id: "fvg-001", reason: "other", note: "x", stage: "exercise" });
      const server = await serverClient();
      const { data } = await server.from("question_reports").select("exercise_id, user_id");
      expect(data).toEqual([{ exercise_id: "fvg-001", user_id: DEMO_USER.id }]);
      expect(real.createBrowserClient).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
