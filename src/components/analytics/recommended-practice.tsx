import Link from "next/link";
import type { ConceptHighlight } from "@/lib/analytics";
import { CONCEPTS, type Concept } from "@/lib/concepts";

export function RecommendedPractice({ weakest }: { weakest: ConceptHighlight }) {
  const label = CONCEPTS[weakest.concept as Concept]?.pickerLabel ?? weakest.concept;

  return (
    <div className="rounded-lg border border-line bg-surface p-4 sm:p-5">
      <p className="text-sm text-foreground">
        Your weakest concept is <span className="font-semibold">{label}</span> at{" "}
        {weakest.accuracy}% — worth another session.
      </p>
      <Link
        href={`/practice?concept=${encodeURIComponent(weakest.concept)}`}
        className="mt-3 inline-flex items-center justify-center rounded-md bg-accent px-5 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
      >
        Practice {label}
      </Link>
    </div>
  );
}
