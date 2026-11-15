import { DARK, LIGHT, THEME_STORAGE_KEY } from "./tokens";

/** Inline <head> boot: set data-theme before first paint. Keep this a pure string. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){
  try {
    var key = ${JSON.stringify(THEME_STORAGE_KEY)};
    var stored = localStorage.getItem(key);
    if (stored !== "system" && stored !== "light" && stored !== "dark") {
      var legacy = localStorage.getItem("deskos-theme") || localStorage.getItem("decision-desk-theme");
      stored = (legacy === "light" || legacy === "dark") ? legacy : "system";
    }
    var theme = stored === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : stored;
    var root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-theme-pref", stored);
    root.style.colorScheme = theme;
    root.style.backgroundColor = theme === "dark" ? ${JSON.stringify(DARK.bg)} : ${JSON.stringify(LIGHT.bg)};
  } catch (e) {}
})();`;
