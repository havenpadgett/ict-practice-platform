import type { Metadata } from "next";
import { DisclaimerFooter } from "@/components/disclaimer-footer";
import { GlossaryBrowser } from "@/components/glossary/glossary-browser";
import { GLOSSARY } from "@/data/glossary";

export const metadata: Metadata = {
  title: "Glossary",
  description: "Every ICT term used in the app, defined once: Fair Value Gap, liquidity, Market Structure Shift, order blocks, premium and discount, and the trade-building terms.",
};

export default function GlossaryPage() {
  const pending = GLOSSARY.filter((e) => e.review !== "validated").length;
  return (
    <div className="flex flex-1 flex-col">
      <div className="page max-w-4xl">
        <h1 className="page-title">Glossary</h1>
        <p className="page-lede max-w-2xl">
          Every term in the curriculum, defined once. The same definitions appear as hover tips throughout the app, and the first use of a
          term on a page spells out its full name before its acronym.
        </p>
        <p className="mt-3 max-w-2xl text-xs text-muted">
          These follow the written curriculum, the text every answer key is checked against. {pending} of {GLOSSARY.length} entries come
          from sections that were written by AI and approved on a read-through rather than independently validated; they are marked
          &ldquo;Pending review&rdquo;. For educational purposes only.
        </p>
        <div className="mt-8">
          <GlossaryBrowser />
        </div>
      </div>
      <DisclaimerFooter />
    </div>
  );
}
