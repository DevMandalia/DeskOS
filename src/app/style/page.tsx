import type { Metadata } from "next";

import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Components" };

export default async function StylePage() {
  await requireUser();
  return (
    <main className="d2-style app-main">
      <h1 className="home-hello">
        Components. <span className="home-hello-muted">Every state, light mode.</span>
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
          <article key={state} className="side-panel" style={{ position: "relative", minHeight: 420, padding: 16 }}>
            <div className="chat-head">
              <p className="chat-head-title">Desk agent</p>
              <span className="chat-live">
                <span className="live-dot" aria-hidden="true" />
                Live
              </span>
            </div>
            {state === "empty" ? (
              <>
                <p className="chat-empty-copy">I read the live desk. Only your buttons change anything.</p>
                <div className="chat-chips">
                  <button type="button" className="chat-chip">
                    What&apos;s blocked on the Board?
                  </button>
                  <button type="button" className="chat-chip">
                    Summarize today&apos;s decisions
                  </button>
                  <button type="button" className="chat-chip">
                    What changed overnight?
                  </button>
                </div>
              </>
            ) : (
              <p className="chat-bubble">Morning. The oldest decision has waited 9 days.</p>
            )}
            <form className="chat-composer">
              <input
                className="chat-composer-input"
                placeholder="Ask about a decision"
                defaultValue={state === "focused" ? "Should I renew for 12 months?" : ""}
              />
              <div className="chat-composer-row">
                <button type="button" className="chat-ask-person">
                  Ask a person
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
