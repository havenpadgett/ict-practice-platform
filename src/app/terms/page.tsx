import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Terms of Service", description: "The rules for using ICT Practice." };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lede="By using ICT Practice, you agree to these terms.">
      <LegalSection heading="Using the site">
        <ul className="list-disc space-y-1 pl-5">
          <li>Use it for your own learning.</li>
          <li>Don&apos;t try to break, overload or get around its security, or access other people&apos;s accounts or data.</li>
          <li>Don&apos;t scrape it, copy its content in bulk, or resell it.</li>
          <li>Keep your login details to yourself. You are responsible for activity on your account.</li>
        </ul>
        <p>We may suspend or delete accounts that break these rules.</p>
      </LegalSection>
      <LegalSection heading="Not advice, no guarantees">
        <p>
          ICT Practice is educational only and is not financial advice (see the{" "}
          <Link href="/disclaimer" className="btn-link inline text-foreground">
            Disclaimer
          </Link>
          ). We don&apos;t guarantee any trading results, that the content is free of errors, or that the site will always be available.
        </p>
      </LegalSection>
      <LegalSection heading="As is">
        <p>
          The service is provided &quot;as is&quot; and &quot;as available&quot;, without warranties of any kind. To the fullest extent the law
          allows, we are not liable for any loss, including trading losses, that comes from using it.
        </p>
      </LegalSection>
      <LegalSection heading="Changes">
        <p>
          We may change the service or these terms. If you keep using it after a change, you accept the new terms. Your data is
          covered by the{" "}
          <Link href="/privacy" className="btn-link inline text-foreground">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
