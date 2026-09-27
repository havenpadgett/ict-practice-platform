"use server";

// Marks an exercise's open reports resolved once it's been re-reviewed
// (/admin → Flagged for re-review). The admin role is checked here and
// again by admin_resolve_reports() in the database.

import { revalidatePath } from "next/cache";
import { getAccess } from "@/lib/review/access";
import { createClient } from "@/lib/supabase/server";

export async function resolveReports(formData: FormData): Promise<void> {
  const access = await getAccess();
  if (access.kind !== "ok" || access.role !== "admin") return;
  const exerciseId = formData.get("exerciseId");
  if (typeof exerciseId !== "string" || exerciseId.length === 0 || exerciseId.length > 100) return;
  const supabase = await createClient();
  await supabase.rpc("admin_resolve_reports", { target_exercise_id: exerciseId });
  revalidatePath("/admin");
}
