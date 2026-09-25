import { PrimaryButton } from "@/components/primary-button";

export function AnalyticsEmptyState() {
  return (
    <div className="card mt-8">
      <p className="eyebrow">No data yet</p>
      <h2 className="mt-2 text-xl">Analytics fill in as you practice</h2>
      <p className="mt-2 text-sm text-muted">
        After your first exercises you&apos;ll see accuracy over time, by concept and difficulty, how real market data
        compares with constructed exercises, and what to practice next.
      </p>
      <div className="mt-6">
        <PrimaryButton href="/practice">Start practicing</PrimaryButton>
      </div>
    </div>
  );
}
