// Just enough Markdown to show a CURRICULUM.md section on /review:
// sub-headings, paragraphs, bullet and numbered lists, block quotes, code
// and tables (as preformatted text), **bold**, `code` and [links](...).

import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={k++} className="font-semibold text-foreground">{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) out.push(<code key={k++} className="font-mono text-[0.9em] text-foreground">{t.slice(1, -1)}</code>);
    else if (t.startsWith("[")) out.push(t.slice(1, t.indexOf("]")));
    else out.push(<em key={k++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
    } else if (line.startsWith("```")) {
      const body: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith("```"); i++) body.push(lines[i]);
      i++;
      blocks.push(<pre key={k++} className="overflow-x-auto rounded bg-background p-2 text-xs text-foreground">{body.join("\n")}</pre>);
    } else if (line.startsWith("|")) {
      const body: string[] = [];
      for (; i < lines.length && lines[i].startsWith("|"); i++) if (!/^\|[-| ]+\|$/.test(lines[i])) body.push(lines[i]);
      blocks.push(<pre key={k++} className="overflow-x-auto text-xs leading-relaxed">{body.join("\n")}</pre>);
    } else if (/^#{3,4} /.test(line)) {
      blocks.push(<h4 key={k++} className="mt-2 text-sm">{inline(line.replace(/^#+ /, ""))}</h4>);
      i++;
    } else if (/^\s*([-*]|\d+\.) /.test(line)) {
      const items: string[] = [];
      for (; i < lines.length && (/^\s*([-*]|\d+\.) /.test(lines[i]) || /^\s{2,}\S/.test(lines[i])); i++) {
        if (/^\s*([-*]|\d+\.) /.test(lines[i])) items.push(lines[i].replace(/^\s*([-*]|\d+\.) /, ""));
        else items[items.length - 1] += " " + lines[i].trim();
      }
      blocks.push(
        <ul key={k++} className="list-disc space-y-1 pl-5">
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </ul>,
      );
    } else if (line.startsWith(">")) {
      const body: string[] = [];
      for (; i < lines.length && lines[i].startsWith(">"); i++) body.push(lines[i].replace(/^>\s?/, ""));
      blocks.push(<blockquote key={k++} className="border-l-2 border-line pl-3">{inline(body.join(" "))}</blockquote>);
    } else {
      const body: string[] = [];
      for (; i < lines.length && lines[i].trim() && !/^(\||```|#|>|\s*([-*]|\d+\.) )/.test(lines[i]); i++) body.push(lines[i]);
      blocks.push(<p key={k++}>{inline(body.join(" "))}</p>);
    }
  }
  return <div className="space-y-3 text-sm leading-relaxed">{blocks}</div>;
}
