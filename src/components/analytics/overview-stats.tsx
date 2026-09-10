import { StatCard } from "@/components/stat-card";
import type { OverallStats } from "@/lib/analytics";

export function OverviewStats({ stats }: { stats: OverallStats }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <StatCard
        label="Overall Accuracy"
        value={stats.accuracy === null ? "—" : `${stats.accuracy}%`}
      />
      <StatCard label="Total Exercises" value={String(stats.totalExercises)} />
      <StatCard label="Practice Sessions" value={String(stats.totalSessions)} />
    </div>
  );
}
