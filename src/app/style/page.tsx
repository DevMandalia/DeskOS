import type { Metadata } from "next";

import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Components" };

export default async function StylePage() {
  await requireUser();
  return (
    <main className="d2-style app-main">
      <h1 className="home-hello">
        Components.
      </h1>

      <section className="d2-style-grid" aria-label="Shell pieces">
        <article className="side-nav" style={{ position: "relative", minHeight: 420 }}>
          <nav className="side-nav-inner" aria-label="Expanded nav">
            <p className="side-brand">
              <span className="live-dot" aria-hidden="true" />
              Desk
            </p>
            <a className="side-link side-link-active" href="/">
              <span className="side-link-name">Home</span>
            </a>
            <a className="side-link" href="/board">
              <span className="side-link-name">Board</span>
            </a>
            <a className="side-link side-link-wait" href="/waiting">
              <span className="side-link-name">Waiting on you</span>
              <span className="side-count">12</span>
            </a>
            <a className="side-link" href="/in-flight">
              <span className="side-link-name">In flight</span>
              <span className="side-count">7</span>
            </a>
          </nav>
        </article>
        <article className="side-nav" style={{ width: 64, minHeight: 420 }}>
          <div className="side-rail" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 16 }}>
            <span className="live-dot" />
            <span className="rail-link">⌂</span>
            <span className="rail-link rail-link-wait">12</span>
          </div>
        </article>
        {["empty", "conversation", "focused"].map((state) => (
          <article key={state} className="side-panel chat-preview" style={{ position: "relative", minHeight: 420, padding: 16 }}>
            <div className="chat-head">
              <p className="chat-head-title">Desk agent</p>
            </div>
            {state === "empty" ? (
              <div className="chat-empty" role="note">
                <p className="chat-empty-copy">Ask me anything about your desk.</p>
              </div>
            ) : (
              <p className="chat-bubble">The oldest waiting item is 9 days old.</p>
            )}
            <form className="chat-composer">
              <input
                className="chat-composer-input"
                placeholder="Message…"
                defaultValue={state === "focused" ? "Should I renew for 12 months?" : ""}
              />
              <div className="chat-composer-row">
                <button type="button" className="chat-send">
                  Send
                </button>
              </div>
            </form>
          </article>
        ))}
      </section>

      <section className="d2-style-kit" aria-label="Controls">
        <div>
          <p className="kicker">Buttons</p>
          <p>
            <button type="button" className="btn btn-approve">
              Primary
            </button>{" "}
            <button type="button" className="btn btn-discuss">
              Secondary
            </button>
          </p>
        </div>
        <div>
          <p className="kicker">Pills</p>
          <p>
            <span className="pill">Operations</span> <span className="pill">9 days</span>{" "}
            <span className="pill pill-live">Done</span>
          </p>
        </div>
        <div>
          <p className="kicker">Board card</p>
          <div className="task" style={{ padding: 12 }}>
            <p className="task-title">Payroll export</p>
            <p className="task-meta">Finance · 8d</p>
          </div>
        </div>
        <div className="object-card">
          <p className="object-pills">
            <span className="pill">Product</span>
            <span className="pill">4 days</span>
          </p>
          <h2 className="decision-title" style={{ fontSize: 22, margin: "8px 0" }}>
            Choose a launch date for the beta
          </h2>
          <p className="verdict-need">Decision needed: one line, what you&apos;re choosing between.</p>
          <p>
            <button type="button" className="btn btn-approve">
              Approve
            </button>{" "}
            <button type="button" className="btn btn-decline">
              Decline
            </button>{" "}
            <button type="button" className="btn btn-discuss">
              Discuss
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
