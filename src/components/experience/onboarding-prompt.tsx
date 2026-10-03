"use client";

import Link from "next/link";
import { ExperienceChoice } from "@/components/experience/experience-choice";
import { useExperience } from "@/contexts/experience-context";

/** For anyone who hasn't chosen yet (signed up on another page, or skipped
 * the welcome step): one question, once. Gone as soon as it's answered. */
export function OnboardingPrompt() {
  const { chosen } = useExperience();
  if (chosen) return null;
  return (
    <section aria-labelledby="onboarding-title" className="rounded-lg border border-line bg-surface p-4 sm:p-5">
      <h2 id="onboarding-title" className="text-base">
        How well do you know ICT concepts?
      </h2>
      <p className="mt-1 text-sm text-muted">
        This sets how much guidance you see. You can change it any time in{" "}
        <Link href="/settings" className="underline underline-offset-4 hover:text-foreground">
          Settings
        </Link>
        .
      </p>
      <div className="mt-4">
        <ExperienceChoice details={false} />
      </div>
    </section>
  );
}
