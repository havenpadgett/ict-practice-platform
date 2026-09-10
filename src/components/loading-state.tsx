export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
