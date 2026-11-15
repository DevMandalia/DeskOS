import type { RichSpan } from "@/lib/types";

type NotionRich = {
  plain_text?: string;
  href?: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
  };
  text?: { content?: string; link?: { url?: string } | null };
};

export function spansFromNotion(items: unknown): RichSpan[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map((raw) => {
    const item = raw as NotionRich;
    return {
      text: item.plain_text ?? item.text?.content ?? "",
      href: item.href ?? item.text?.link?.url ?? null,
      bold: Boolean(item.annotations?.bold),
      italic: Boolean(item.annotations?.italic),
      strike: Boolean(item.annotations?.strikethrough),
      underline: Boolean(item.annotations?.underline),
      code: Boolean(item.annotations?.code),
    };
  });
}

export function chunkRichText(content: string): { type: "text"; text: { content: string } }[] {
  const chunks: { type: "text"; text: { content: string } }[] = [];
  const size = 1900;
  for (let i = 0; i < content.length; i += size) {
    chunks.push({ type: "text", text: { content: content.slice(i, i + size) } });
  }
  if (chunks.length === 0) chunks.push({ type: "text", text: { content: "" } });
  return chunks;
}
