"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { LoadingState } from "@/components/loading-state";
import { useAuth } from "@/contexts/auth-context";

function LoginRedirectGuard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  if (loading || user) {
    return <LoadingState />;
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <Suspense fallback={<LoadingState />}>
        <AuthForm />
      </Suspense>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col">
      <LoginRedirectGuard />
      <DisclaimerFooter />
    </div>
  );
}
