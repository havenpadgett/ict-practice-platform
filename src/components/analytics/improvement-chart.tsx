import type { AccuracyBlock } from "@/lib/analytics";

export function ImprovementChart({ blocks }: { blocks: AccuracyBlock[] }) {
  if (blocks.length === 0) return null;

  if (blocks.length === 1) {
    return (
      <p className="text-sm text-muted">
        {blocks[0].accuracy}% so far — keep practicing to see whether that&rsquo;s improving over time.
      </p>
    );
  }

  return (
    <div className="flex h-36 items-end gap-3">
      {blocks.map((block) => (
        <div key={block.label} className="flex h-full flex-1 flex-col justify-end gap-2">
          <div
            className="w-full rounded-t-sm bg-accent"
            style={{ height: `${Math.max(block.accuracy, 4)}%` }}
            title={`Attempts ${block.label}: ${block.accuracy}%`}
          />
          <span className="text-center text-xs text-muted">{block.accuracy}%</span>
          <span className="whitespace-nowrap text-center text-[10px] text-muted/70">
            {block.label}
          </span>
        </div>
      ))}
    </div>
  );
}
