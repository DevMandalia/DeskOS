"use client";

import { useState, type ReactNode } from "react";

export function ContinueAnyway({
  complete,
  children,
}: {
  complete: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(!complete);
  if (open) return <>{children}</>;
  return (
    <div className="session-complete">
      <p>Session complete. Further verdicts still save.</p>
      <button type="button" className="btn btn-discuss" onClick={() => setOpen(true)}>
        Continue anyway
      </button>
    </div>
  );
}
