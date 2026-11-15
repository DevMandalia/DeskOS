"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { withBasePath } from "@/lib/base-path";

type ChatPointer = {
  id: string;
  url: string | null;
  app: string;
  title: string;
  nextStep: string;
  comeBackBy: string;
  status: string;
};

export function ChatCapture({
  initialUrl = "",
  defaultComeBack,
  bookmarkletHref,
}: {
  initialUrl?: string;
  defaultComeBack: string;
  bookmarkletHref: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl);
  const [nextStep, setNextStep] = useState("");
  const [comeBackBy, setComeBackBy] = useState(defaultComeBack);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(withBasePath("/api/v1/chats"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url || null, next_step: nextStep, come_back_by: comeBackBy || undefined }),
    });
    const body = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Could not save pointer.");
      return;
    }
    setUrl("");
    setNextStep("");
    setComeBackBy(defaultComeBack);
    router.refresh();
  }

  const bookmarklet = `javascript:void(location.href=${JSON.stringify(bookmarkletHref)}+encodeURIComponent(location.href))`;

  return (
    <form className="chat-capture" onSubmit={(e) => void save(e)}>
      <label className="chat-capture-label">
        Paste a chat link
        <input
          className="chat-capture-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
          name="url"
        />
      </label>
      <label className="chat-capture-label">
        Left off / next step
        <input
          className="chat-capture-input"
          value={nextStep}
          onChange={(e) => setNextStep(e.target.value)}
          placeholder="Where you stopped"
          name="next_step"
          required
          maxLength={240}
        />
      </label>
      <label className="chat-capture-label">
        Come back by
        <input className="chat-capture-input" type="date" value={comeBackBy} onChange={(e) => setComeBackBy(e.target.value)} />
      </label>
      <p className="review-actions">
        <button type="submit" className="btn btn-approve" disabled={busy}>
          Save pointer
        </button>
      </p>
      {error ? <p className="board-alert">{error}</p> : null}
      <p className="desk-sub">
        Bookmarklet (no scrape — it only opens this paste form):{" "}
        <a href={bookmarklet}>Save to Chats</a>
      </p>
    </form>
  );
}

export function ChatLane({
  groups,
  extra,
  snoozeDate,
}: {
  groups: { app: string; rows: ChatPointer[] }[];
  extra: number;
  snoozeDate: string;
}) {
  if (groups.length === 0) return <p className="empty">No open chats.</p>;
  return (
    <div>
      {groups.map((group) => (
        <section key={group.app} className="home-section">
          <h2 className="home-h2">{group.app}</h2>
          <ul className="home-list">
            {group.rows.map((chat) => (
              <ChatRow key={chat.id} chat={chat} snoozeDate={snoozeDate} />
            ))}
          </ul>
        </section>
      ))}
      {extra > 0 ? <p className="desk-sub">{extra} more closed or converted — hidden on the default lane.</p> : null}
    </div>
  );
}

export function ChatRow({ chat, snoozeDate }: { chat: ChatPointer; snoozeDate: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(path: string, body?: object) {
    setBusy(true);
    await fetch(withBasePath(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : "{}",
    });
    setBusy(false);
    router.refresh();
  }

  async function patch(body: object) {
    setBusy(true);
    await fetch(withBasePath(`/api/v1/chats/${chat.id}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <li>
      <p className="home-item-title">{chat.title}</p>
      <p className="home-item-meta">
        {chat.nextStep} · come back {chat.comeBackBy}
        {chat.url ? (
          <>
            {" · "}
            <a href={chat.url} target="_blank" rel="noreferrer">
              Open
            </a>
          </>
        ) : null}
      </p>
      <p className="review-actions">
        <button
          type="button"
          className="text-btn"
          disabled={busy}
          onClick={() => {
            if (chat.url) window.open(chat.url, "_blank", "noopener");
            void patch({ status: "resumed" });
          }}
        >
          Resume
        </button>
        <button type="button" className="text-btn" disabled={busy} onClick={() => void patch({ come_back_by: snoozeDate, status: "resumed" })}>
          Snooze
        </button>
        <button type="button" className="text-btn" disabled={busy} onClick={() => void act(`/api/v1/chats/${chat.id}/close`)}>
          Close — I won’t return
        </button>
        <button type="button" className="text-btn" disabled={busy} onClick={() => void act(`/api/v1/chats/${chat.id}/convert`, { to: "task" })}>
          Convert to task
        </button>
        <button type="button" className="text-btn" disabled={busy} onClick={() => void act(`/api/v1/chats/${chat.id}/convert`, { to: "decision" })}>
          Convert to decision
        </button>
      </p>
    </li>
  );
}
