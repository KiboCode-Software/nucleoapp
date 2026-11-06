import type { ReactNode } from "react";

/**
 * Renderiza el subconjunto de Markdown que generan los reportes: encabezados,
 * listas, negritas, citas, separadores y párrafos. Construye elementos de React
 * (nunca HTML crudo), así que el texto del usuario no puede inyectar marcado.
 */

type Block =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; text: string }
  | { type: "rule" }
  | { type: "paragraph"; text: string };

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };

  for (const raw of source.split("\n")) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const item = /^\s*[-*]\s+(.*)$/.exec(line);

    if (!line.trim()) {
      flush();
    } else if (heading) {
      flush();
      blocks.push({ type: "heading", level: heading[1].length as 1 | 2 | 3, text: heading[2] });
    } else if (/^-{3,}$/.test(line.trim())) {
      flush();
      blocks.push({ type: "rule" });
    } else if (item) {
      flush();
      const last = blocks.at(-1);
      if (last?.type === "list") last.items.push(item[1]);
      else blocks.push({ type: "list", items: [item[1]] });
    } else if (line.startsWith(">")) {
      flush();
      blocks.push({ type: "quote", text: line.replace(/^>\s?/, "") });
    } else {
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

export function MarkdownView({ source }: { source: string }) {
  return (
    <article className="flex flex-col gap-3 text-[14px] leading-relaxed">
      {parseMarkdown(source).map((block, i) => {
        switch (block.type) {
          case "heading":
            if (block.level === 1) return <h1 key={i} className="text-[22px] font-semibold tracking-tight">{inline(block.text)}</h1>;
            if (block.level === 2)
              return <h2 key={i} className="mt-3 text-[16px] font-semibold tracking-tight">{inline(block.text)}</h2>;
            return <h3 key={i} className="mt-1 text-[14px] font-semibold text-ink-muted">{inline(block.text)}</h3>;
          case "list":
            return (
              <ul key={i} className="flex list-disc flex-col gap-1 pl-5 marker:text-ink-muted">
                {block.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </ul>
            );
          case "quote":
            return (
              <blockquote key={i} className="border-l-2 border-accent pl-3 text-ink-muted">
                {inline(block.text)}
              </blockquote>
            );
          case "rule":
            return <hr key={i} className="my-2 border-line" />;
          default:
            return <p key={i}>{inline(block.text)}</p>;
        }
      })}
    </article>
  );
}
