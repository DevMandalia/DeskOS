"use client";

/** Right-side chat. Optional; without CHAT_COMPLETIONS_URL this is a placeholder. */
export function ChatPanel({ configured }: { configured: boolean; rowId?: string | null; title?: string | null }) {
  return (
    <div className="chat-panel">
      <p className="chat-head-title">Desk agent</p>
      <p className="chat-empty-copy">Ask me anything about your desk.</p>
      <form className="chat-composer" onSubmit={(event) => event.preventDefault()}>
        <label className="sr-only" htmlFor="desk-agent-ask">
          Message
        </label>
        <input
          id="desk-agent-ask"
          className="chat-composer-input"
          placeholder="Ask me anything about your desk."
          disabled={!configured}
        />
        <div className="chat-composer-row">
          <button type="submit" className="chat-send" disabled={!configured}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
