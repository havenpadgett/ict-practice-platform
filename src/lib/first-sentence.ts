/** The opening sentence(s) of a piece of feedback, up to ~170 characters:
 * enough to say why, short enough for a card or a one-line summary. Two
 * sentences at most; a leading "Right —" lead-in is dropped. */
export function firstSentence(text: string, max = 170): string {
  const clean = text.replace(/^Right\s*[—-]\s*/, "").trim();
  const sentences = clean.match(/[^.!?]+[.!?]+(\s|$)/g)?.map((x) => x.trim()) ?? [clean];
  let out = sentences[0] ?? clean;
  const next = sentences[1];
  if (next && `${out} ${next}`.length <= max) out = `${out} ${next}`;
  return out.length > max ? `${out.slice(0, max - 1).trimEnd()}…` : out;
}
