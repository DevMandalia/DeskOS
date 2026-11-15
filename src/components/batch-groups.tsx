"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { withBasePath } from "@/lib/base-path";
import type { BatchRow } from "../../contract";

export function BatchGroups({
  groups,
  parkDate,
}: {
  groups: { id: string; label: string; rows: BatchRow[] }[];
  parkDate: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.flatMap((g) => g.rows.map((r) => [r.id, true]))),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(choice: "Approve" | "Decline" | "Park", continueAnyway = false) {
    const ids = Object.entries(selected).filter(([, on]) => on).map(([id]) => id);
    if (!ids.length) return;
    setBusy(true);
    setError(null);
    const res = await fetch(withBasePath("/api/decide/batch"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, choice, revisit_at: choice === "Park" ? parkDate : null, continue_anyway: continueAnyway }),
    });
    const body = (await res.json()) as { error?: string; code?: string };
    setBusy(false);
    if (res.status === 409 && body.code === "session_cap") {
      if (window.confirm(`${body.error} Continue anyway?`)) return apply(choice, true);
      return;
    }
    if (!res.ok) {
      setError(body.error ?? "Batch failed.");
      return;
    }
    router.push(withBasePath("/"));
    router.refresh();
  }

  return (
    <div>
      {error ? <p className="board-alert">{error}</p> : null}
      {groups.map((group) => (
        <section key={group.id} className="home-section">
          <h2 className="home-h2">{group.label}</h2>
          <ul className="home-list">
            {group.rows.map((row) => (
              <li key={row.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(selected[row.id])}
                    onChange={(e) => setSelected((s) => ({ ...s, [row.id]: e.target.checked }))}
                  />{" "}
                  {row.item}
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="review-actions">
        <button type="button" className="btn btn-approve" disabled={busy} onClick={() => void apply("Approve")}>
          Approve selected
        </button>
        <button type="button" className="btn btn-decline" disabled={busy} onClick={() => void apply("Decline")}>
          Decline selected
        </button>
        <button type="button" className="btn btn-park" disabled={busy} onClick={() => void apply("Park")}>
          Park selected
        </button>
      </p>
    </div>
  );
}
