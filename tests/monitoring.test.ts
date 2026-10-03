// Production error monitoring (src/lib/monitoring.ts): off unless a DSN is
// configured, and when on, an event carries the error and the route but no
// cookies, headers, bodies, query strings or user ids.

import { afterEach, describe, expect, it, vi } from "vitest";
import { monitoringEnabled, reportError, scrubEvent, sentryOptions, stripQuery } from "@/lib/monitoring";

const DSN = "https://publickey@o0.ingest.sentry.io/0";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("switch", () => {
  it("is off by default, so development and the demo never report", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    expect(monitoringEnabled()).toBe(false);
    expect(sentryOptions().dsn).toBeUndefined();
  });

  it("turns on with a Sentry DSN, and only an https one", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", DSN);
    expect(monitoringEnabled()).toBe(true);
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "http://publickey@host/1");
    expect(monitoringEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "not a dsn");
    expect(monitoringEnabled()).toBe(false);
  });

  it("reporting does nothing at all when off", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    // Would throw or hang if it tried to load the SDK and send.
    expect(() => reportError(new Error("x"), { action: "test" })).not.toThrow();
  });

  it("collects errors only: no tracing, no personal data by default", () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", DSN);
    const o = sentryOptions();
    expect(o.tracesSampleRate).toBe(0);
    expect(o.sendDefaultPii).toBe(false);
  });
});

describe("what leaves", () => {
  it("strips query strings and fragments, which carry user ids on Supabase URLs", () => {
    expect(stripQuery("https://x.supabase.co/rest/v1/attempts?user_id=eq.1234&select=*#frag")).toBe("https://x.supabase.co/rest/v1/attempts");
    expect(stripQuery("/practice?concept=FVG")).toBe("/practice");
    expect(stripQuery("not a url?secret=1")).toBe("not a url");
  });

  it("removes cookies, headers, bodies and the user from an event", () => {
    const event = scrubEvent({
      request: { url: "https://app.test/practice?token=abc", cookies: { sb: "secret" }, headers: { authorization: "Bearer x" }, data: "answer=21310", query_string: "token=abc" },
      user: { id: "u1", email: "a@b.c" },
      breadcrumbs: [{ category: "fetch", data: { url: "https://x.supabase.co/rest/v1/attempts?user_id=eq.1234" } }],
    } as never) as unknown as Record<string, Record<string, unknown> | unknown>;
    const json = JSON.stringify(event);
    for (const leaked of ["secret", "Bearer", "21310", "token=abc", "a@b.c", "user_id=eq"]) expect(json, leaked).not.toContain(leaked);
    expect((event.request as { url: string }).url).toBe("https://app.test/practice");
  });
});

describe("through the real SDK", () => {
  it("sends a scrubbed event with the error and the tag, and nothing else personal", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", DSN);
    const Sentry = await import("@sentry/nextjs");
    const sent: string[] = [];
    Sentry.init({
      ...sentryOptions(),
      transport: () => ({
        send: async (envelope: unknown) => {
          sent.push(JSON.stringify(envelope));
          return {};
        },
        flush: async () => true,
      }),
      defaultIntegrations: false,
    });
    Sentry.getCurrentScope().setUser({ id: "u1", email: "a@b.c" });
    Sentry.addBreadcrumb({ category: "fetch", data: { url: "https://x.supabase.co/rest/v1/attempts?user_id=eq.1234" } });
    reportError(new Error("save failed"), { action: "save this attempt" });
    await vi.waitFor(() => expect(sent.length).toBeGreaterThan(0), { timeout: 4000 });
    const body = sent.join("\n");
    expect(body).toContain("save failed");
    expect(body).toContain("save this attempt");
    for (const leaked of ["a@b.c", "user_id=eq", "1234"]) expect(body, leaked).not.toContain(leaked);
    await Sentry.close();
  });
});
