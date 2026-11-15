"use client";

import { FOCUS_SHORTCUT } from "@/lib/layout-prefs";
import { setFocusMode, useFocusMode } from "@/components/pane-prefs";

/** Hide or restore the left nav and right chat. Shortcut: \ */
export function FocusToggle({ exit = false }: { exit?: boolean }) {
  const on = useFocusMode();
  if (exit) {
    return (
      <button
        type="button"
        className="focus-exit"
        aria-keyshortcuts="\\"
        title={`Show panels (${FOCUS_SHORTCUT})`}
        onClick={() => setFocusMode(false)}
      >
        Show panels
        <kbd>{FOCUS_SHORTCUT}</kbd>
      </button>
    );
  }
  const label = on ? "Show panels" : "Focus";
  return (
    <button
      type="button"
      className="focus-toggle"
      aria-pressed={on}
      aria-keyshortcuts="\\"
      title={`${label} (${FOCUS_SHORTCUT})`}
      onClick={() => setFocusMode(!on)}
    >
      {label}
      <kbd>{FOCUS_SHORTCUT}</kbd>
    </button>
  );
}
