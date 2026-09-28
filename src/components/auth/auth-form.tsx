"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { PasswordField } from "@/components/auth/password-field";
import { authErrorMessage, MIN_PASSWORD_LENGTH } from "@/lib/auth-errors";
import { GOOGLE_AUTH_ENABLED } from "@/lib/auth-flags";
import { safeNextPath } from "@/lib/safe-redirect";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign_in" | "sign_up" | "reset";

const HEADINGS: Record<Mode, { title: string; lede: string; submit: string; busy: string }> = {
  sign_in: { title: "Log in", lede: "Welcome back.", submit: "Log in", busy: "Logging in…" },
  sign_up: {
    title: "Create an account",
    lede: "Free. Your practice history, mistakes and recommendations are saved to it, and only you can see them.",
    submit: "Create account",
    busy: "Creating your account…",
  },
  reset: {
    title: "Reset your password",
    lede: "Enter your email and we'll send you a link to choose a new password.",
    submit: "Send reset link",
    busy: "Sending…",
  },
};

export function AuthForm() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "signup" ? "sign_up" : "sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth_callback_error" ? "That link didn't work or has expired. Try again." : null,
  );
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const next = safeNextPath(searchParams.get("next"));
  const copy = HEADINGS[mode];

  function switchTo(m: Mode) {
    setError(null);
    setInfo(null);
    setMode(m);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter your email address.");
      return;
    }
    if (mode !== "reset" && password.length === 0) {
      setError("Enter your password.");
      return;
    }
    if (mode === "sign_up" && password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      return;
    }
    setSubmitting(true);
    const supabase = createClient();
    try {
      if (mode === "sign_in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
        router.push(next);
        router.refresh();
      } else if (mode === "sign_up") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (signUpError) throw signUpError;
        if (data.session) {
          router.push(next);
          router.refresh();
        } else {
          setInfo(`We sent a confirmation link to ${email}. Open it, then log in here.`);
          setMode("sign_in");
        }
      } else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
        });
        if (resetError) throw resetError;
        // Same message whether or not the email has an account.
        setInfo(`If ${email} has an account, a reset link is on its way. It can take a minute to arrive.`);
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (oauthError) setError(authErrorMessage(oauthError));
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="page-title">{copy.title}</h1>
      <p className="mt-2 text-sm text-muted">{copy.lede}</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        <div>
          <label htmlFor="email" className="eyebrow block">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error !== null || undefined}
            aria-describedby={error ? "auth-error" : undefined}
            className="field"
          />
        </div>

        {mode !== "reset" && (
          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
            minLength={mode === "sign_up" ? MIN_PASSWORD_LENGTH : undefined}
            hint={mode === "sign_up" ? `At least ${MIN_PASSWORD_LENGTH} characters. A longer passphrase is safer.` : undefined}
            invalid={error !== null}
            describedBy={error ? "auth-error" : undefined}
          />
        )}

        {mode === "sign_in" && (
          <div className="-mt-2 flex justify-end">
            <button type="button" onClick={() => switchTo("reset")} className="btn-link text-xs">
              Forgot password?
            </button>
          </div>
        )}

        {error && (
          <p id="auth-error" className="text-error" role="alert">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-md border border-line bg-surface p-3 text-sm text-foreground" role="status">
            {info}
          </p>
        )}

        <button type="submit" disabled={submitting} aria-busy={submitting} className="w-full btn-primary">
          {submitting ? copy.busy : copy.submit}
        </button>
      </form>

      {GOOGLE_AUTH_ENABLED && mode !== "reset" && (
        <>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs text-muted">or</span>
            <div className="h-px flex-1 bg-line" />
          </div>
          <div className="mt-5">
            <GoogleSignInButton onClick={handleGoogleSignIn} disabled={submitting} />
          </div>
        </>
      )}

      <p className="mt-8 text-center text-sm text-muted">
        {mode === "sign_in" ? (
          <>
            New here?{" "}
            <button type="button" onClick={() => switchTo("sign_up")} className="btn-link inline text-foreground">
              Create an account
            </button>
          </>
        ) : (
          <>
            {mode === "reset" ? "Remembered it?" : "Already have an account?"}{" "}
            <button type="button" onClick={() => switchTo("sign_in")} className="btn-link inline text-foreground">
              Log in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
