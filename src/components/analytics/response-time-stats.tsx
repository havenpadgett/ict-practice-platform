import { StatCard } from "@/components/stat-card";
import { formatResponseTime, type ResponseTimeStats } from "@/lib/analytics";

export function ResponseTimeStatsView({ stats }: { stats: ResponseTimeStats }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <StatCard
        label="Avg. Time — Correct"
        value={stats.avgCorrectMs === null ? "—" : formatResponseTime(stats.avgCorrectMs)}
      />
      <StatCard
        label="Avg. Time — Incorrect"
        value={stats.avgIncorrectMs === null ? "—" : formatResponseTime(stats.avgIncorrectMs)}
      />
    </div>
  );
}
