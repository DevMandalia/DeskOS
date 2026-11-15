"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { withBasePath } from "@/lib/base-path";
import { isStaticDemo } from "@/lib/demo-mode";
import { addDemoDiscussion } from "@/lib/demo-store";
import type { DiscussionMessage } from "@/lib/types";

export function DiscussionThread({
  decisionId,
  messages,
  closed,
  ownerTurn,
}: {
  decisionId: string;
  messages: DiscussionMessage[];
  closed: boolean;
  ownerTurn: boolean;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [local, setLocal] = useState<DiscussionMessage[]>([]);
  const shown = [...messages, ...local];

  async function send(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (isStaticDemo()) {
        addDemoDiscussion(decisionId, text);
        setLocal((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            decisionId,
            author: "owner",
            agentId: null,
            agentName: null,
            body: text,
            at: new Date().toISOString(),
          },
        ]);
        setText("");
        return;
      }
      const res = await fetch(withBasePath("/api/discussion"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision_id: decisionId, message: text }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Could not send");
        return;
      }
      setText("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (shown.length === 0 && closed) return null;

  return (
    <section className="page-body" aria-labelledby="discussion-title">
      <h2 id="discussion-title" className="page-body-title">
        Discussion
      </h2>
      {shown.length === 0 ? (
        <p className="desk-sub">
          Discuss keeps this item open. The agent replies here, then you take turns until you Approve, Decline, or Park.
        </p>
      ) : (
        <ol className="home-list">
          {shown.map((m) => (
            <li key={m.id}>
              <p className="home-item-title">{m.author === "owner" ? "You" : m.agentName ?? "Agent"}</p>
              <p className="home-item-meta">{m.body}</p>
            </li>
          ))}
        </ol>
      )}
      {!closed && ownerTurn ? (
        <form className="settings-form" onSubmit={send}>
          <label>
            Your reply
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} required />
          </label>
          <button type="submit" className="btn btn-discuss" disabled={pending}>
            {pending ? "Sending…" : "Reply"}
          </button>
          {error ? <p className="signin-error">{error}</p> : null}
        </form>
      ) : null}
      {!closed && !ownerTurn && shown.length > 0 ? (
        <p className="desk-sub">Waiting for the agent to reply.</p>
      ) : null}
    </section>
  );
}
