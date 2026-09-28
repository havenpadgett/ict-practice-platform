"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PasswordField } from "@/components/auth/password-field";
import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { LoadingState } from "@/components/loading-state";
import { useAuth } from "@/contexts/auth-context";
import { authErrorMessage, MIN_PASSWORD_LENGTH } from "@/lib/auth-errors";
import { createClient } from "@/lib/supabase/client";

/** Where a password-reset email lands (via /auth/callback, which turns the
 * link into a session). Sets the new password on that session. */
export default function ResetPasswordPage() {
  const { user, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await createClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        {loading ? (
          <LoadingState />
        ) : !user ? (
          <div className="w-full max-w-sm">
            <h1 className="page-title">Link expired</h1>
            <p className="mt-2 text-sm text-muted">This reset link has expired or was already used. Request a new one.</p>
            <Link href="/login" className="mt-6 btn-primary">
              Back to log in
            </Link>
          </div>
        ) : done ? (
          <div className="w-full max-w-sm" role="status">
            <h1 className="page-title">Password updated</h1>
            <p className="mt-2 text-sm text-muted">You&apos;re logged in with your new password.</p>
            <Link href="/dashboard" className="mt-6 btn-primary">
              Go to your dashboard
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="w-full max-w-sm">
            <h1 className="page-title">Choose a new password</h1>
            <p className="mt-2 text-sm text-muted">For {user.email}.</p>
            <div className="mt-8">
              <PasswordField
                id="new-password"
                label="New password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
                invalid={error !== null}
                describedBy={error ? "reset-error" : undefined}
              />
            </div>
            {error && (
              <p id="reset-error" className="text-error mt-4" role="alert">
                {error}
              </p>
            )}
            <button type="submit" disabled={saving} aria-busy={saving} className="mt-6 w-full btn-primary">
              {saving ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
      </div>
      <DisclaimerFooter />
    </div>
  );
}
