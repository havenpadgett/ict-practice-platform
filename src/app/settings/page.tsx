"use client";

import { ExperienceChoice } from "@/components/experience/experience-choice";
import { useExperience } from "@/contexts/experience-context";
import { DeleteAccount } from "@/app/settings/delete-account";

export default function SettingsPage() {
  const { level, chosen } = useExperience();
  return (
    <div className="page max-w-3xl">
      <h1 className="page-title">Settings</h1>
      <p className="page-lede">Preferences for how practice looks and moves.</p>

      <section aria-labelledby="settings-experience" className="mt-8">
        <h2 id="settings-experience" className="text-lg">
          Experience level
        </h2>
        <p className="mt-1 max-w-xl text-sm text-muted">
          {chosen
            ? `Set to ${level === "beginner" ? "new to ICT concepts" : "experienced"}. Changes apply straight away.`
            : "Not chosen yet, so you're seeing the guided version. Pick one to set it."}{" "}
          It changes the interface only: grading, answer keys and what counts as correct are the same for everyone.
        </p>
        <div className="mt-4">
          <ExperienceChoice />
        </div>
      </section>

      <DeleteAccount />
    </div>
  );
}
