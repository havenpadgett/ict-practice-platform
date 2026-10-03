import { redirect } from "next/navigation";
import { dailyPath, utcDateKey } from "@/lib/daily";

export const dynamic = "force-dynamic";

/** /daily is always today's challenge; the dated address is the one to share. */
export default function DailyIndex() {
  redirect(dailyPath(utcDateKey()));
}
