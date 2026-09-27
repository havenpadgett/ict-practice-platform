import type { Metadata } from "next";

// The page is a Client Component, which can't export metadata itself.
export const metadata: Metadata = {
  title: "Log in",
  description: "Log in or create an account to track your ICT practice: accuracy by concept, streaks and recommendations.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
