"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Header controls (theme, demo badge, email, sign out). Inline on wide
 * screens; on phones they fold behind one "Account" button. Escape or a click
 * outside closes the menu and returns focus to the button.
 */
export function AccountMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointer(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onFocus(event: FocusEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("focusin", onFocus);
    };
  }, [open]);

  return (
    <div className="account" ref={rootRef} data-open={open ? "true" : "false"}>
      <button
        ref={buttonRef}
        type="button"
        className="account-btn"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        Account
        <span className="account-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      <div id={panelId} className="account-panel">
        {children}
      </div>
    </div>
  );
}
