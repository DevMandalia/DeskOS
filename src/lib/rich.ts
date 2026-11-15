import type { RichSpan } from "@/lib/types";

export function textOf(rich: RichSpan[]): string {
  return rich.map((span) => span.text).join("");
}

export function spansFromPlain(text: string, href?: string | null): RichSpan[] {
  return [{ text, href: href ?? null }];
}
