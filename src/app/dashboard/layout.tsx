import type { Metadata } from "next";

// The page is a Client Component, which can't export metadata itself.
export const metadata: Metadata = {
  title: "Dashboard",
  description: "Your practice progress: overall and per-concept accuracy, streak, mistakes to review and a recommended next session.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
