import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "porcelain" | "slate" | "midnight" | "system";
export const THEMES = [
  { id: "porcelain", name: "Porcelain", description: "Warm white, charcoal and indigo", colors: ["#faf9f6", "#ffffff", "#4338ca"] },
  { id: "slate", name: "Slate", description: "Cool grey, ink and blue", colors: ["#e8edf3", "#f8fafc", "#1d4ed8"] },
  { id: "midnight", name: "Midnight", description: "Deep navy and soft silver", colors: ["#101827", "#192438", "#a5b4fc"] },
] as const;
function normalize(value: string | null, fallback: Theme): Theme {
  if (value === "dark") return "midnight";
  if (value === "light") return "porcelain";
  return value === "system" || THEMES.some((t) => t.id === value) ? value as Theme : fallback;
}
const Context = createContext<{ theme: Theme; resolvedTheme: Exclude<Theme, "system">; setTheme: (theme: Theme) => void; previewTheme: (theme: Theme | null) => void } | null>(null);
export function ThemeProvider({ children, defaultTheme = "porcelain", storageKey = "starlights-ui-theme" }: { children: React.ReactNode; defaultTheme?: Theme | "light" | "dark"; storageKey?: string }) {
  const fallback = normalize(defaultTheme, "porcelain");
  const [theme, update] = useState<Theme>(() => {
    try { return normalize(localStorage.getItem(storageKey), fallback); } catch { return fallback; }
  });
  const [preview, previewTheme] = useState<Theme | null>(null);
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const changed = () => setDark(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    const changed = (event: StorageEvent) => { if (event.key === storageKey) update(normalize(event.newValue, fallback)); };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [storageKey, fallback]);
  const chosen = preview ?? theme;
  const resolvedTheme = chosen === "system" ? (dark ? "midnight" : "porcelain") : chosen;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.classList.toggle("dark", resolvedTheme === "midnight");
    root.classList.toggle("light", resolvedTheme !== "midnight");
    root.style.colorScheme = resolvedTheme === "midnight" ? "dark" : "light";
  }, [resolvedTheme]);
  function setTheme(next: Theme) {
    update(next);
    previewTheme(null);
    try { localStorage.setItem(storageKey, next); } catch { /* Still usable when storage is unavailable. */ }
  }
  return <Context.Provider value={{ theme, resolvedTheme, setTheme, previewTheme }}>{children}</Context.Provider>;
}
export function useTheme() {
  const context = useContext(Context);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
