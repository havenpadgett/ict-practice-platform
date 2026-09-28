import type { Metadata } from "next";

// The page is a Client Component, which can't export metadata itself.
export const metadata: Metadata = {
  title: "Mistakes",
  description: "Every exercise you've answered incorrectly, with your answer, the correct one and why. Retry any of them.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
