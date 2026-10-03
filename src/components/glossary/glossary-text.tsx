"use client";

import { Fragment } from "react";
import { Term } from "@/components/glossary/term";
import { segment } from "@/lib/glossary-match";

/** Text with its ICT terms made hoverable, and the first-use-per-page
 * wording applied (src/lib/glossary-match.ts). Use it on sentences (prompts,
 * explanations, feedback), not on headings or inside buttons: pass `plain`
 * there to get the wording without the tooltip. */
export function GlossaryText({ text, plain = false }: { text: string; plain?: boolean }) {
  return (
    <>
      {segment(text).map((seg, i) =>
        "text" in seg ? (
          <Fragment key={i}>{seg.text}</Fragment>
        ) : (
          <Term key={i} id={seg.match.entry.id} match={seg.match} plain={plain} />
        ),
      )}
    </>
  );
}
