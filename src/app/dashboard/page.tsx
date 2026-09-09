import { PrimaryButton } from "@/components/primary-button";
import { StatCard } from "@/components/stat-card";

const STATS = [
  { label: "Overall Accuracy", value: "0%" },
  { label: "Exercises Completed", value: "0" },
  { label: "Session Score", value: "—" },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-10 sm:px-6 sm:pt-8 sm:pb-14">
      <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        Dashboard
      </h1>
      <p className="mt-1 text-sm text-muted">
        Your practice progress at a glance.
      </p>

      <div className="mt-8 grid grid-cols-3 gap-4">
        {STATS.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      <div className="mt-10">
        <PrimaryButton href="/practice">Start FVG Practice</PrimaryButton>
      </div>
    </div>
  );
}
