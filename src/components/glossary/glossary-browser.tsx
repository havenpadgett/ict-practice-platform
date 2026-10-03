"use client";

import { useMemo, useState } from "react";
import { GLOSSARY, GLOSSARY_GROUPS, getGlossaryEntry, type GlossaryEntry, type Review } from "@/data/glossary";
import { DEFINITIONS, type DefinitionId } from "@/lib/curriculum";

const REVIEW_TEXT: Record<Review, string> = {
  validated: "Validated",
  pending: "Pending review",
  partly: "Partly validated",
};

function matches(entry: GlossaryEntry, q: string): boolean {
  const hay = [entry.name, entry.abbr ?? "", ...(entry.aliases ?? []), entry.short, entry.long].join(" ").toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => hay.includes(word));
}

function Entry({ entry }: { entry: GlossaryEntry }) {
  const section = entry.curriculum ? DEFINITIONS[entry.curriculum as DefinitionId]?.section : undefined;
  return (
    <article id={entry.id} className="scroll-mt-20 border-t border-line py-6 first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-lg">
          {entry.name}
          {entry.abbr && <span className="ml-2 font-normal text-muted">({entry.abbr})</span>}
        </h3>
        <span
          className={`eyebrow ${entry.review === "validated" ? "text-accent" : ""}`}
          title={
            entry.review === "validated"
              ? "Checked against source material by Haven."
              : "Written by AI and approved on a read-through, not independently verified. Treat as needing review."
          }
        >
          {REVIEW_TEXT[entry.review]}
        </span>
      </div>
      <p className="mt-2 max-w-2xl text-base text-foreground">{entry.short}</p>
      <p className="mt-2 max-w-2xl text-sm text-muted">{entry.long}</p>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {section && <span>Curriculum: {section}</span>}
        {entry.related && entry.related.length > 0 && (
          <span>
            See also:{" "}
            {entry.related.map((id, i) => {
              const r = getGlossaryEntry(id);
              return r ? (
                <span key={id}>
                  {i > 0 && ", "}
                  <a href={`#${id}`} className="underline underline-offset-4 hover:text-foreground">
                    {r.name}
                  </a>
                </span>
              ) : null;
            })}
          </span>
        )}
      </p>
    </article>
  );
}

/** Every term, grouped, with a filter that matches names, acronyms,
 * alternative spellings and the definitions themselves. */
export function GlossaryBrowser() {
  const [q, setQ] = useState("");
  const shown = useMemo(() => GLOSSARY.filter((e) => matches(e, q)), [q]);

  return (
    <div>
      <label className="block max-w-md text-sm text-muted">
        <span className="sr-only">Find a term</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Find a term, e.g. MSS or sweep"
          className="field"
          autoComplete="off"
        />
      </label>
      <p className="mt-2 text-xs text-muted" role="status">
        {q ? `${shown.length} of ${GLOSSARY.length} terms` : `${GLOSSARY.length} terms`}
      </p>

      {!q && (
        <nav aria-label="Groups" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {GLOSSARY_GROUPS.map((g) => (
            <a key={g} href={`#group-${g.replace(/\s+/g, "-").toLowerCase()}`} className="text-muted underline underline-offset-4 hover:text-foreground">
              {g}
            </a>
          ))}
        </nav>
      )}

      {shown.length === 0 && <p className="mt-8 text-sm text-muted">No term matches that. Try a shorter word.</p>}

      {GLOSSARY_GROUPS.map((group) => {
        const entries = shown.filter((e) => e.group === group);
        if (entries.length === 0) return null;
        return (
          <section key={group} id={`group-${group.replace(/\s+/g, "-").toLowerCase()}`} className="mt-10 scroll-mt-20" aria-labelledby={`g-${group}`}>
            <h2 id={`g-${group}`} className="eyebrow">
              {group}
            </h2>
            <div className="mt-2">
              {entries.map((e) => (
                <Entry key={e.id} entry={e} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
