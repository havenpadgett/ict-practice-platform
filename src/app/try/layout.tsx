import type { Metadata } from "next";

// The page is a Client Component, which can't export metadata itself.
export const metadata: Metadata = {
  title: "Try a sample",
  description: "Answer three graded chart exercises (a Fair Value Gap, a liquidity level and an order block) without an account.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
