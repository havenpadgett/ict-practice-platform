export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="eyebrow">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
        {value}
      </p>
    </div>
  );
}
