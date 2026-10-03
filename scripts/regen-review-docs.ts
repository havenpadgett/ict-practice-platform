// Re-renders the generated sections of docs/SCENARIO-VALIDATION.md from the
// scenario files and docs/review-log.json (the /review page does this after
// every decision; run it after scripts/auto_approve.py).
import { regenerateReviewDocs } from "@/lib/review/store";

await regenerateReviewDocs();
console.log("Regenerated docs/SCENARIO-VALIDATION.md.");
