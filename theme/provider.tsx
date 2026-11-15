"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";

import {
  applyCurrentTheme,
  choosePreference,
  getServerPreference,
  readPreference,
  subscribeTheme,
} from "./store";
import type { ThemePreference } from "./tokens";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyCurrentTheme();
  }, []);
  return <>{children}</>;
}

export function ThemeToggle() {
  const pref = useSyncExternalStore(
    subscribeTheme,
    readPreference,
    getServerPreference,
  );

  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`theme-btn ${pref === option.value ? "theme-btn-active" : ""}`}
          aria-pressed={pref === option.value}
          onClick={() => choosePreference(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
