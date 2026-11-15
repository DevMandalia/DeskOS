import type { ReactNode } from "react";

import type { RichSpan } from "@/lib/types";

export function RichText({ rich }: { rich: RichSpan[] }) {
  if (rich.length === 0) return null;
  return (
    <>
      {rich.map((span, index) => {
        const content = span.text;
        let node: ReactNode = content;
        if (span.code) node = <code>{node}</code>;
        if (span.bold) node = <strong>{node}</strong>;
        if (span.italic) node = <em>{node}</em>;
        if (span.strike) node = <s>{node}</s>;
        if (span.underline) node = <u>{node}</u>;
        if (span.href) {
          node = (
            <a href={span.href} target="_blank" rel="noreferrer">
              {node}
            </a>
          );
        }
        return <span key={`${index}-${content.slice(0, 12)}`}>{node}</span>;
      })}
    </>
  );
}
