"use client";

import Link from "next/link";
import { ShareButton } from "@/components/share-button";
import type { RecordState } from "@/hooks/use-record-result";
import { conceptShortName } from "@/lib/concepts";
import { signUpHref } from "@/lib/challenge";

/** Under the feedback on a public page: share it, and keep the result.
 * Signed-out visitors are asked once to make an account; their result waits
 * on this device and is added to it afterwards. */
export function ChallengeAfter({
  concept,
  sharePath,
  state,
  error,
  signedIn,
  onRetrySave,
  cardAction,
}: {
  concept: string;
  sharePath: string;
  state: RecordState;
  error: string | null;
  signedIn: boolean;
  onRetrySave: () => void;
  /** The share-card download, where there is one. */
  cardAction?: React.ReactNode;
}) {
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <ShareButton
          path={sharePath}
          title={`${conceptShortName(concept)} chart challenge`}
          text="Can you read this chart? Mark your answer and see how it compares."
        />
        {cardAction}
      </div>

      {signedIn ? (
        <p className="text-sm text-muted" role="status">
          {state === "saving" && "Saving to your history…"}
          {state === "saved" && "Saved to your history."}
          {state === "error" && (
            <span className="text-danger">
              {error}{" "}
              <button type="button" onClick={onRetrySave} className="underline underline-offset-4">
                Retry save
              </button>
            </span>
          )}
        </p>
      ) : (
        <section className="card" aria-labelledby="save-result-heading">
          <h2 id="save-result-heading" className="text-base">
            Save this result
          </h2>
          <p className="mt-1 text-sm text-muted">
            Make a free account and this answer goes into your history, your mistakes and your recommendations. Until then it
            stays on this device, and no one else can see it.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={signUpHref("/dashboard")} className="btn-primary">
              Create a free account
            </Link>
            <Link href={`/login?next=${encodeURIComponent("/dashboard")}`} className="btn-secondary">
              Log in
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
