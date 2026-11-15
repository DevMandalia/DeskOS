"use client";

const CHIPS = [
  "What's blocked on the Board?",
  "Summarize today's decisions",
  "What changed overnight?",
];

/** Right-side chat. Optional; without CHAT_COMPLETIONS_URL this is a placeholder. */
export function ChatPanel({ configured }: { configured: boolean; rowId?: string | null; title?: string | null }) {
  return (
    <div className="chat-panel">
      <div className="chat-head">
        <p className="chat-head-title">Desk agent</p>
        <span className="chat-live">
          <span className="live-dot" aria-hidden="true" />
          Live
        </span>
      </div>
      <p className="chat-empty-copy">
        {configured
          ? "I read the live desk. Only your buttons change anything."
          : "Chat is optional. Decisions happen with the buttons — Approve, Decline, Park, Discuss."}
      </p>
      <div className="chat-chips">
        {CHIPS.map((chip) => (
          <button key={chip} type="button" className="chat-chip" disabled={!configured}>
            {chip}
          </button>
        ))}
      </div>
      <form className="chat-composer" onSubmit={(event) => event.preventDefault()}>
        <label className="sr-only" htmlFor="desk-agent-ask">
          Ask about a decision
        </label>
        <input
          id="desk-agent-ask"
          className="chat-composer-input"
          placeholder="Ask about a decision"
          disabled={!configured}
        />
        <div className="chat-composer-row">
          <button type="button" className="chat-ask-person">
            Ask a person
          </button>
        </div>
      </form>
    </div>
  );
}
