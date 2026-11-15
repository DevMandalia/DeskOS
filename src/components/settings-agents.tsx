"use client";

import { useState } from "react";

import { withBasePath } from "@/lib/base-path";
import type { AgentPublic } from "@/lib/types";

type Created = { api_key?: string; webhook_secret?: string | null };

export function SettingsAgents({ initial }: { initial: AgentPublic[] }) {
  const [agents, setAgents] = useState(initial);
  const [name, setName] = useState("");
  const [role, setRole] = useState<"lead" | "sub">("lead");
  const [parentId, setParentId] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [error, setError] = useState<string | null>(null);

  const leads = agents.filter((a) => a.role === "lead" && !a.revokedAt);

  async function createAgent(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setCreated(null);
    const res = await fetch(withBasePath("/api/settings/agents"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        role,
        parent_id: role === "sub" ? parentId : null,
        webhook_url: webhookUrl || null,
      }),
    });
    const body = (await res.json()) as Created & { agent?: AgentPublic; error?: string };
    if (!res.ok || !body.agent) {
      setError(body.error ?? "Could not create the key");
      return;
    }
    setAgents((list) => [body.agent!, ...list]);
    setCreated({ api_key: body.api_key, webhook_secret: body.webhook_secret });
    setName("");
    setWebhookUrl("");
  }

  async function revoke(id: string) {
    const res = await fetch(withBasePath(`/api/settings/agents/${id}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke" }),
    });
    const body = (await res.json()) as { agent?: AgentPublic };
    if (body.agent) {
      setAgents((list) => list.map((a) => (a.id === id ? body.agent! : a)));
    }
  }

  return (
    <div className="settings">
      <form className="settings-form" onSubmit={createAgent}>
        <label>
          Agent name
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Acme Ops" />
        </label>
        <label>
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value === "sub" ? "sub" : "lead")}
          >
            <option value="lead">Lead</option>
            <option value="sub">Sub-agent</option>
          </select>
        </label>
        {role === "sub" ? (
          <label>
            Parent (lead)
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} required>
              <option value="">Choose a lead</option>
              {leads.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          Per-agent webhook URL (optional)
          <input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://example.test/hooks/desk"
          />
        </label>
        <button type="submit" className="btn btn-approve">
          Create API key
        </button>
      </form>
      {error ? <p className="signin-error">{error}</p> : null}
      {created?.api_key ? (
        <div className="saved-box" role="status">
          <p className="kicker">Copy now — it will not be shown again</p>
          <pre>{created.api_key}</pre>
          {created.webhook_secret ? (
            <>
              <p className="kicker">Webhook HMAC secret</p>
              <pre>{created.webhook_secret}</pre>
            </>
          ) : null}
        </div>
      ) : null}
      <ul className="home-list">
        {agents.map((agent) => (
          <li key={agent.id} className="home-item" style={{ display: "block" }}>
            <span className="home-item-title">
              {agent.name}{" "}
              <span className="kicker muted">
                {agent.role}
                {agent.parentId ? " · sub" : ""}
                {agent.revokedAt ? " · revoked" : ""}
              </span>
            </span>
            <span className="home-item-meta">
              key {agent.keyPrefix}…{agent.webhookUrl ? " · webhook on" : ""}
            </span>
            {!agent.revokedAt ? (
              <button type="button" className="text-btn" onClick={() => void revoke(agent.id)}>
                Revoke
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
