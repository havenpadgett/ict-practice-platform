import type { Metadata } from "next";

// The page is a Client Component, which can't export metadata itself.
export const metadata: Metadata = {
  title: "Practice",
  description: "Practice ICT concepts on NQ charts: mark the answer, then get graded feedback that explains the rule.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
