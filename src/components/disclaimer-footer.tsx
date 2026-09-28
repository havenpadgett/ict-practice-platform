import Link from "next/link";

export function DisclaimerFooter() {
  return (
    <footer className="border-t border-line px-4 py-6 text-center text-xs text-muted">
      For educational purposes only. Not financial advice.
      <span aria-hidden> · </span>
      <Link href="/about" className="underline-offset-4 hover:text-foreground hover:underline">
        How it works
      </Link>
    </footer>
  );
}
