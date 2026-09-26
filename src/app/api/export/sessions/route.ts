// GET /api/export/sessions — the signed-in user's practice sessions (the
// v_sessions view over practice_events) as a flat CSV, one row per started
// session. Column reference: docs/ANALYTICS.md. Needs migration
// 20260926130000_practice_events.sql; answers 503 until it's applied.

import { NextResponse } from "next/server";
import { sessionsToCsv, type ExportSession } from "@/lib/export";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to export your sessions." }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("v_sessions")
    .select("*")
    .eq("user_id", user.id)
    .order("started_at", { ascending: true });
  if (error) {
    console.error("export/sessions:", error.code);
    return NextResponse.json({ error: "Session data isn't available yet." }, { status: 503 });
  }
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(sessionsToCsv((data ?? []) as ExportSession[], { id: user.id, email: user.email ?? null }), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ict-practice-sessions-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
