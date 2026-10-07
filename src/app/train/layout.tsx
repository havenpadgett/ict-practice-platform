import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Train",
  description: "Simulate and train: replay a chart candle by candle, mark it up, and get scored on process, not outcome.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
