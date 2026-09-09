export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
        {value}
      </p>
    </div>
  );
}
