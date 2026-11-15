"use client";

/** Right-side chat. Optional; without CHAT_COMPLETIONS_URL this is a placeholder. */
export function ChatPanel({ configured }: { configured: boolean; rowId?: string | null; title?: string | null }) {
  return (
    <div className="chat-panel">
      <p className="chat-empty-title">{configured ? "Chat" : "Chat"}</p>
      <p className="chat-empty-copy">
        {configured
          ? "Connect CHAT_COMPLETIONS_URL to talk to your own model. The desk agent cannot press Approve, Decline, Park or Discuss for you."
          : "Chat is optional. Decisions happen with the buttons — Approve, Decline, Park, Discuss."}
      </p>
    </div>
  );
}
