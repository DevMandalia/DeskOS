"use client";

/** Right-side chat. Optional; without CHAT_COMPLETIONS_URL this is a placeholder. */
export function ChatPanel({ configured }: { configured: boolean; rowId?: string | null; title?: string | null }) {
  return (
    <section className="chat" aria-labelledby="chat-title">
      <header className="chat-head">
        <h2 id="chat-title" className="chat-title">
          Desk agent
        </h2>
      </header>
      <div className="chat-empty" role="note">
        <p className="chat-empty-copy">
          {configured ? "Ask me anything about your desk." : "Chat is off. Use Discuss on a decision."}
        </p>
      </div>
      <form className="chat-composer" onSubmit={(event) => event.preventDefault()}>
        <label className="sr-only" htmlFor="desk-agent-ask">
          Message
        </label>
        <input
          id="desk-agent-ask"
          className="chat-composer-input"
          placeholder="Message…"
          disabled={!configured}
        />
        <div className="chat-composer-row">
          <button type="submit" className="chat-send" disabled={!configured}>
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
