import { PrimaryButton } from "@/components/primary-button";

export function AnalyticsEmptyState() {
  return (
    <div className="mt-8 rounded-lg border border-line bg-surface p-6 text-center sm:p-8">
      <p className="text-base font-semibold text-foreground">No practice data yet</p>
      <p className="mt-2 text-sm text-muted">
        Complete a few exercises and your accuracy, trends, and recommendations will show up here.
      </p>
      <div className="mt-5 flex justify-center">
        <PrimaryButton href="/practice">Start Practicing</PrimaryButton>
      </div>
    </div>
  );
}
