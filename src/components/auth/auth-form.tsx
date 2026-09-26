"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { safeNextPath } from "@/lib/safe-redirect";
import { useState, type FormEvent } from "react";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { GOOGLE_AUTH_ENABLED } from "@/lib/auth-flags";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign_in" | "sign_up";

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    const supabase = createClient();
    try {
      if (mode === "sign_in") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push(next);
        router.refresh();
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          router.push(next);
          router.refresh();
        } else {
          setInfo("Check your email to confirm your account, then sign in.");
          setMode("sign_in");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
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
    if (oauthError) setError(oauthError.message);
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="page-title">
        {mode === "sign_in" ? "Log in" : "Sign up"}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {mode === "sign_in"
          ? "Welcome back."
          : "Create an account to save your practice history."}
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="eyebrow block">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 w-full btn-secondary"
          />
        </div>

        <div>
          <label htmlFor="password" className="eyebrow block">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full btn-secondary"
          />
        </div>

        {error && (
          <p className="text-sm text-danger">
            {error}
          </p>
        )}
        {info && <p className="text-sm text-muted">{info}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full btn-primary"
        >
          {submitting ? "Please wait…" : mode === "sign_in" ? "Log in" : "Sign up"}
        </button>
      </form>

      {GOOGLE_AUTH_ENABLED && (
        <>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs text-muted">or</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <div className="mt-4">
            <GoogleSignInButton onClick={handleGoogleSignIn} disabled={submitting} />
          </div>
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted">
        {mode === "sign_in" ? "Don't have an account?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setError(null);
            setInfo(null);
            setMode(mode === "sign_in" ? "sign_up" : "sign_in");
          }}
          className="text-foreground underline underline-offset-2 hover:text-accent"
        >
          {mode === "sign_in" ? "Sign up" : "Log in"}
        </button>
      </p>
    </div>
  );
}
