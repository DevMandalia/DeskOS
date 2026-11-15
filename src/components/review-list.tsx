"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { withBasePath } from "@/lib/base-path";
import type { ReviewItem } from "../../contract";

export function ReviewList({ items }: { items: ReviewItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (items.length === 0) return <p className="empty">Nothing to review.</p>;

  async function act(item: ReviewItem, action: string) {
    if (item.type === "chat") {
      if (action === "Kill") {
        await fetch(withBasePath(`/api/v1/chats/${item.id}/close`), { method: "POST" });
        router.refresh();
        return;
      }
      router.push(withBasePath("/chats"));
      return;
    }
    if (item.type !== "decision" || item.id === "wip") {
      router.push(withBasePath("/board"));
      return;
    }
    if (action === "Keep") {
      router.refresh();
      return;
    }
    setBusy(`${item.id}:${action}`);
    await fetch(withBasePath("/api/decide"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        row_id: item.id,
        action: action === "Kill" ? "Decline" : action,
        choice: action === "Kill" ? "Decline" : action,
        note: "",
      }),
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <ol className="home-list">
      {items.map((item) => (
        <li key={`${item.type}-${item.id}-${item.kind}`}>
          <p className="home-item-title">{item.title}</p>
          <p className="home-item-meta">{item.reason}</p>
          {item.type === "chat" ? (
            <p className="review-actions">
              <button type="button" className="text-btn" disabled={Boolean(busy)} onClick={() => void act(item, "Keep")}>
                Open Chats
              </button>
              <button type="button" className="text-btn" disabled={Boolean(busy)} onClick={() => void act(item, "Kill")}>
                Close — I won’t return
              </button>
            </p>
          ) : item.type === "decision" && item.kind !== "wip_overflow" ? (
            <p className="review-actions">
              {item.kind === "split" ? (
                <button type="button" className="text-btn" disabled={Boolean(busy)} onClick={() => void act(item, "Split")}>
                  Send back to split
                </button>
              ) : (
                <button type="button" className="text-btn" disabled={Boolean(busy)} onClick={() => void act(item, "Keep")}>
                  Keep
                </button>
              )}
              <button type="button" className="text-btn" disabled={Boolean(busy)} onClick={() => void act(item, "Park")}>
                Park
              </button>
              <button type="button" className="text-btn" disabled={Boolean(busy)} onClick={() => void act(item, "Kill")}>
                Kill
              </button>
            </p>
          ) : (
            <p className="home-item-meta">Open the Board to keep, move to ready, or drop. Rows are never deleted.</p>
          )}
        </li>
      ))}
    </ol>
  );
}
