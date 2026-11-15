"use client";

import { useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY, type Theme } from "@/lib/theme";

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  root.style.backgroundColor = theme === "dark" ? "#16140f" : "#f6f3ec";
}

function readTheme(): Theme {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (window.localStorage.getItem(THEME_STORAGE_KEY)) return;
    applyTheme(readTheme());
    emit();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) emit();
  };
  media.addEventListener("change", onSystem);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystem);
    window.removeEventListener("storage", onStorage);
  };
}

function choose(next: Theme) {
  window.localStorage.setItem(THEME_STORAGE_KEY, next);
  applyTheme(next);
  emit();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light");

  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      <button
        type="button"
        className={`theme-btn ${theme === "light" ? "theme-btn-active" : ""}`}
        aria-pressed={theme === "light"}
        onClick={() => choose("light")}
      >
        Light
      </button>
      <button
        type="button"
        className={`theme-btn ${theme === "dark" ? "theme-btn-active" : ""}`}
        aria-pressed={theme === "dark"}
        onClick={() => choose("dark")}
      >
        Dark
      </button>
    </div>
  );
}
