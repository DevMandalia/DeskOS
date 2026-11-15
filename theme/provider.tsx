"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";

import {
  applyCurrentTheme,
  cyclePreference,
  getServerPreference,
  getServerTheme,
  readPreference,
  readResolvedTheme,
  subscribeTheme,
} from "./store";
import type { Theme, ThemePreference } from "./tokens";

const THEME_LABEL: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyCurrentTheme();
  }, []);
  return <>{children}</>;
}

/** One-button cycle: System → Light → Dark → System. */
export function ThemeToggle() {
  const pref = useSyncExternalStore(subscribeTheme, readPreference, getServerPreference);
  const resolved = useSyncExternalStore(subscribeTheme, readResolvedTheme, getServerTheme);
  const label = `Theme: ${THEME_LABEL[pref]}${pref === "system" ? ` (${resolved})` : ""}`;
  return (
    <button
      type="button"
      className="theme-icon"
      aria-label={label}
      title={label}
      onClick={() => cyclePreference()}
    >
      <ThemeGlyph theme={resolved} />
    </button>
  );
}

function ThemeGlyph({ theme }: { theme: Theme }) {
  if (theme === "dark") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M13.2 10.4A6 6 0 0 1 5.6 2.8 6.2 6.2 0 1 0 13.2 10.4Z"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="3.1" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M8 1.4v1.8M8 12.8v1.8M1.4 8h1.8M12.8 8h1.8M3.2 3.2l1.3 1.3M11.5 11.5l1.3 1.3M12.8 3.2l-1.3 1.3M4.5 11.5l-1.3 1.3" />
      </g>
    </svg>
  );
}
