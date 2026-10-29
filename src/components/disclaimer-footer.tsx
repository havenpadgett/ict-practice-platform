import Link from "next/link";

const LINKS = [
  { href: "/about", label: "How it works" },
  { href: "/glossary", label: "Glossary" },
  { href: "/disclaimer", label: "Disclaimer" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

// On every page, from the root layout.
export function DisclaimerFooter() {
  return (
    <footer className="border-t border-line px-4 py-6 text-center text-xs text-muted">
      For educational purposes only. Not financial advice.
      {LINKS.map((l) => (
        <span key={l.href}>
          <span aria-hidden> · </span>
          <Link href={l.href} className="underline-offset-4 hover:text-foreground hover:underline">
            {l.label}
          </Link>
        </span>
      ))}
    </footer>
  );
}
