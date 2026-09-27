// DEMO MODE (see src/lib/demo/gate.ts). The browser half of the fake
// Supabase client sends its queries here; they run against the in-memory
// demo store. Outside demo mode this route answers 404 as if it didn't
// exist, and a production build never loads the store.

import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/demo/gate";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" || !isDemoMode()) {
    return new NextResponse(null, { status: 404 });
  }
  const body: unknown = await request.json().catch(() => null);
  const b = body as Record<string, unknown> | null;
  if (!b || (typeof b.table !== "string" && typeof b.rpc !== "string")) {
    return NextResponse.json({ data: null, error: { code: "400", message: "Bad demo query." }, count: null }, { status: 400 });
  }
  const { executeDemo } = await import("@/lib/demo/store");
  return NextResponse.json(await executeDemo(b as Parameters<typeof executeDemo>[0]));
}
