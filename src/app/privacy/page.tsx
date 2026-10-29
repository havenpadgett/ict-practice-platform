import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacy Policy", description: "What ICT Practice collects, where it is stored, and how to delete it." };

const CONTACT_EMAIL = "[CONTACT_EMAIL]";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lede="What we collect, why, and how to delete it.">
      <LegalSection heading="What we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li>Your email address, to create and sign in to your account.</li>
          <li>Your practice results: your answers, scores, mistakes and session history.</li>
          <li>Usage analytics: which pages and practice modes you use, and errors the app runs into, so we can fix them.</li>
        </ul>
      </LegalSection>
      <LegalSection heading="Where it is stored">
        <p>
          Your data is stored in Supabase, our database and sign-in provider. Access rules in the database let you see only your
          own data.
        </p>
      </LegalSection>
      <LegalSection heading="What we don't do">
        <p>We never sell your data. We don&apos;t share it with advertisers.</p>
      </LegalSection>
      <LegalSection heading="Deleting your account">
        <p>
          Go to{" "}
          <Link href="/settings" className="btn-link inline text-foreground">
            Settings
          </Link>{" "}
          and choose <strong className="text-foreground">Delete my account</strong>. This permanently deletes your account and your
          practice history. You can also email {CONTACT_EMAIL} and we will delete it for you.
        </p>
      </LegalSection>
      <LegalSection heading="Questions">
        <p>Email {CONTACT_EMAIL}.</p>
      </LegalSection>
    </LegalPage>
  );
}
