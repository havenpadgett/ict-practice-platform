// GET /api/export/attempts — the signed-in user's attempts as a flat CSV
// for Power BI / Excel (column reference: docs/ANALYTICS.md). Login is
// required (src/proxy.ts redirects browsers; this also answers 401), and
// Row Level Security means the query can only ever return the caller's own
// rows. Session columns come from the v_sessions view; if the
// practice_events migration isn't applied yet they're left blank.

import { NextResponse } from "next/server";
import { attemptsToCsv, type ExportSession } from "@/lib/export";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to export your attempts." }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("attempts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: `Couldn't load attempts: ${error.message}` }, { status: 500 });
  }
  const sessions = await supabase.from("v_sessions").select("*").eq("user_id", user.id);
  const date = new Date().toISOString().slice(0, 10);
  const csv = attemptsToCsv(data ?? [], { id: user.id, email: user.email ?? null }, (sessions.data ?? []) as ExportSession[]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ict-practice-attempts-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
