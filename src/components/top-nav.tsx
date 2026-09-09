import Link from "next/link";

export function TopNav() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-foreground sm:text-base"
        >
          ICT Practice
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted sm:gap-6">
          <Link href="/dashboard" className="transition-colors hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/practice" className="transition-colors hover:text-foreground">
            Practice
          </Link>
        </nav>
      </div>
    </header>
  );
}
