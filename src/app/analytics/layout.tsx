import type { Metadata } from "next";

// The page is a Client Component, which can't export metadata itself.
export const metadata: Metadata = {
  title: "Analytics",
  description: "Your accuracy over time, by concept and difficulty, Guided Entry steps and Free Trade process.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
