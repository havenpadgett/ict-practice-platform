const FEATURES = [
  "Draw your answer directly on the chart",
  "Get instant feedback with a real explanation, not just right or wrong",
  "Track your accuracy as recognition builds over time",
];

export function FeatureList() {
  return (
    <ul className="space-y-3 text-left">
      {FEATURES.map((feature) => (
        <li
          key={feature}
          className="flex gap-3 text-sm text-foreground/85 sm:text-base"
        >
          <span
            aria-hidden
            className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent"
          />
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}
