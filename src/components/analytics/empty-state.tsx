import { PrimaryButton } from "@/components/primary-button";

export function AnalyticsEmptyState() {
  return (
    <div className="card mt-8">
      <p className="eyebrow">No data yet</p>
      <h2 className="mt-2 text-xl">Analytics fill in as you practice</h2>
      <p className="mt-2 text-sm text-muted">
        Complete your first practice session to unlock accuracy over time, per-concept and per-difficulty breakdowns,
        and a recommendation for what to practice next.
      </p>
      <div className="mt-6">
        <PrimaryButton href="/practice">Start practicing</PrimaryButton>
      </div>
    </div>
  );
}
