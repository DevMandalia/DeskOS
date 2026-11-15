"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { withBasePath } from "@/lib/base-path";
import type { BriefRow } from "@/lib/types";

/** Owner can override door, cost of delay, and deadline. Persist before the next verdict. */
export function BriefOverrides({ row }: { row: BriefRow }) {
  const router = useRouter();
  const [door, setDoor] = useState(row.doorType ?? "");
  const [cost, setCost] = useState(row.costOfDelay ?? "");
  const [deadline, setDeadline] = useState(row.deadline ?? "");
  const [pending, setPending] = useState(false);

  async function save(patch: { door_type?: string | null; cost_of_delay?: string | null; deadline?: string | null }) {
    setPending(true);
    try {
      await fetch(withBasePath("/api/decide"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row_id: row.id, ...patch }),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="brief-overrides">
      <label>
        Door
        <select
          value={door}
          disabled={pending}
          onChange={(event) => {
            const value = event.target.value;
            setDoor(value);
            void save({ door_type: value || null });
          }}
        >
          <option value="">Not set</option>
          <option value="two_way">Two-way (reversible)</option>
          <option value="one_way">One-way (hard to reverse)</option>
        </select>
      </label>
      <label>
        Cost of delay
        <select
          value={cost}
          disabled={pending}
          onChange={(event) => {
            const value = event.target.value;
            setCost(value);
            void save({ cost_of_delay: value || null });
          }}
        >
          <option value="">Not set</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </label>
      <label>
        Deadline
        <input
          type="date"
          value={deadline}
          disabled={pending}
          onChange={(event) => {
            const value = event.target.value;
            setDeadline(value);
            void save({ deadline: value || null });
          }}
        />
      </label>
    </div>
  );
}
