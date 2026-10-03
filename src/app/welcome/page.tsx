"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ExperienceChoice } from "@/components/experience/experience-choice";
import { useExperience } from "@/contexts/experience-context";
import { safeNextPath } from "@/lib/safe-redirect";

function Welcome() {
  const router = useRouter();
  const { chosen } = useExperience();
  const next = safeNextPath(useSearchParams().get("next"));
  return (
    <div className="page max-w-3xl">
      <p className="eyebrow">Welcome</p>
      <h1 className="page-title mt-2">One question before you start</h1>
      <p className="page-lede max-w-xl">
        How well do you know ICT concepts? It decides how much guidance you see while you practice. It&apos;s a preference, not a test, and
        you can change it in Settings whenever you like.
      </p>
      <div className="mt-8">
        <ExperienceChoice />
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button type="button" disabled={!chosen} onClick={() => router.push(next)} className="btn-primary">
          Continue
        </button>
        <Link href={next} className="btn-link">
          Skip for now
        </Link>
      </div>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense>
      <Welcome />
    </Suspense>
  );
}
