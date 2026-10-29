"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/settings/actions";
import { useAuth } from "@/contexts/auth-context";
import { clearSession } from "@/lib/storage";

const CONFIRM_WORD = "DELETE";

export function DeleteAccount() {
  const { user, signOut } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!user) return null;

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteAccount();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      clearSession();
      await signOut().catch(() => {});
      // A full reload on purpose: nothing of the old account stays in memory.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    });
  }

  return (
    <section aria-labelledby="settings-delete" className="mt-section">
      <h2 id="settings-delete" className="text-lg">
        Delete my account
      </h2>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Permanently deletes your account and everything saved to it: practice history, mistakes, reports and progress. This can&apos;t be
        undone.
      </p>
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="btn-secondary mt-4">
          Delete my account
        </button>
      ) : (
        <div className="card mt-4 max-w-xl space-y-3">
          <label htmlFor="delete-confirm" className="block text-sm text-foreground">
            Type {CONFIRM_WORD} to confirm.
          </label>
          <input
            id="delete-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="field"
            aria-describedby={error ? "delete-error" : undefined}
          />
          {error && (
            <p id="delete-error" className="text-error" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={confirm}
              disabled={typed !== CONFIRM_WORD || pending}
              aria-busy={pending}
              className="btn-primary"
            >
              {pending ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setTyped("");
                setError(null);
              }}
              disabled={pending}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
