import type { ReactNode } from "react";

import { RichText } from "@/components/rich-text";
import { textOf } from "@/lib/rich";
import type { DeskBlock } from "@/lib/types";

function isListItem(
  block: DeskBlock,
): block is Extract<DeskBlock, { type: "bulleted_list_item" | "numbered_list_item" }> {
  return block.type === "bulleted_list_item" || block.type === "numbered_list_item";
}

function groupBlocks(blocks: DeskBlock[]): DeskBlock[][] {
  const groups: DeskBlock[][] = [];
  for (const block of blocks) {
    const prev = groups[groups.length - 1];
    if (
      prev &&
      isListItem(prev[0]) &&
      isListItem(block) &&
      prev[0].type === block.type
    ) {
      prev.push(block);
    } else {
      groups.push([block]);
    }
  }
  return groups;
}

function Block({ block }: { block: DeskBlock }) {
  switch (block.type) {
    case "heading_1":
      return (
        <h2 className="body-h1">
          <RichText rich={block.rich} />
        </h2>
      );
    case "heading_2":
      return (
        <h3 className="body-h2">
          <RichText rich={block.rich} />
        </h3>
      );
    case "heading_3":
      return (
        <h4 className="body-h3">
          <RichText rich={block.rich} />
        </h4>
      );
    case "paragraph":
      if (textOf(block.rich).trim() === "") return <div className="body-gap" />;
      return (
        <p>
          <RichText rich={block.rich} />
        </p>
      );
    case "quote":
      return (
        <blockquote className="body-quote">
          <RichText rich={block.rich} />
        </blockquote>
      );
    case "callout":
      return (
        <aside className="callout">
          {block.icon ? <span className="callout-icon">{block.icon}</span> : null}
          <div>
            <RichText rich={block.rich} />
          </div>
        </aside>
      );
    case "code":
      return (
        <pre className="body-code">
          <code>{block.text}</code>
        </pre>
      );
    case "image":
      return (
        <figure className="body-figure">
          {/* Remote file URLs may expire; they are fetched on each load. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.url} alt={block.caption ?? ""} />
          {block.caption ? <figcaption>{block.caption}</figcaption> : null}
        </figure>
      );
    case "video":
      return (
        <figure className="body-figure">
          <video src={block.url} controls preload="metadata" />
          {block.caption ? <figcaption>{block.caption}</figcaption> : null}
        </figure>
      );
    case "toggle":
      return (
        <details className="body-toggle">
          <summary>
            <RichText rich={block.rich} />
          </summary>
          {block.children ? <BlockList blocks={block.children} /> : null}
        </details>
      );
    case "divider":
      return <hr className="body-hr" />;
    case "bookmark":
    case "link_preview":
    case "embed":
      return (
        <a className="body-link-card" href={block.url} target="_blank" rel="noreferrer">
          <span className="kicker">{block.type.replace("_", " ")}</span>
          <span>{block.title || block.url}</span>
        </a>
      );
    case "to_do":
      return (
        <label className="body-todo">
          <input type="checkbox" checked={block.checked} readOnly />
          <span>
            <RichText rich={block.rich} />
          </span>
        </label>
      );
    case "bulleted_list_item":
    case "numbered_list_item":
      return (
        <li>
          <RichText rich={block.rich} />
          {block.children ? <BlockList blocks={block.children} /> : null}
        </li>
      );
    default:
      return null;
  }
}

export function BlockList({ blocks }: { blocks: DeskBlock[] }) {
  const groups = groupBlocks(blocks);
  return (
    <div className="block-list">
      {groups.map((group, index) => {
        const first = group[0];
        if (first.type === "bulleted_list_item") {
          return (
            <ul key={`ul-${first.id}-${index}`}>
              {group.map((item) => (
                <Block key={item.id} block={item} />
              ))}
            </ul>
          );
        }
        if (first.type === "numbered_list_item") {
          return (
            <ol key={`ol-${first.id}-${index}`}>
              {group.map((item) => (
                <Block key={item.id} block={item} />
              ))}
            </ol>
          );
        }
        const nodes: ReactNode[] = group.map((item) => (
          <Block key={item.id} block={item} />
        ));
        return nodes;
      })}
    </div>
  );
}
