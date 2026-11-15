import {
  DARK,
  LIGHT,
  THEME_STORAGE_KEY,
  nextPreference,
  readStoredPreference,
  resolveTheme,
  type Theme,
  type ThemePreference,
} from "./tokens";

const listeners = new Set<() => void>();

export function emitTheme() {
  for (const listener of listeners) listener();
}

export function applyTheme(theme: Theme, pref: ThemePreference) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.setAttribute("data-theme-pref", pref);
  root.style.colorScheme = theme;
  root.style.backgroundColor = theme === "dark" ? DARK.bg : LIGHT.bg;
}

export function systemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function readPreference(): ThemePreference {
  return readStoredPreference((key) => window.localStorage.getItem(key));
}

export function readResolvedTheme(): Theme {
  return resolveTheme(readPreference(), systemDark());
}

export function applyCurrentTheme() {
  const pref = readPreference();
  applyTheme(resolveTheme(pref, systemDark()), pref);
}

export function choosePreference(next: ThemePreference) {
  window.localStorage.setItem(THEME_STORAGE_KEY, next);
  applyTheme(resolveTheme(next, systemDark()), next);
  emitTheme();
}

export function cyclePreference() {
  choosePreference(nextPreference(readPreference()));
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (readPreference() !== "system") return;
    applyCurrentTheme();
    emitTheme();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) emitTheme();
  };
  media.addEventListener("change", onSystem);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystem);
    window.removeEventListener("storage", onStorage);
  };
}

export function getServerPreference(): ThemePreference {
  return "system";
}

export function getServerTheme(): Theme {
  return "light";
}
