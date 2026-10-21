export type Theme = "porcelain" | "slate" | "midnight" | "system";
export const THEMES = [
  { id: "porcelain", name: "Porcelain", description: "Warm ivory, bronze and slate blue", colors: ["#f4f0e8", "#fffdf9", "#33508a"] },
  { id: "slate", name: "Slate", description: "Slate blue, charcoal and silver", colors: ["#2d3e51", "#273749", "#b3c9e6"] },
  { id: "midnight", name: "Midnight", description: "Deep navy and champagne gold", colors: ["#0c1628", "#121e33", "#c4a564"] },
] as const;
/** Midnight and Slate are dark themes: they get the `dark` class (Tailwind's dark: styles) and a dark color scheme. */
export function isDarkTheme(theme: string) {
  return theme === "midnight" || theme === "slate";
}
export function normalizeTheme(value: string | null, fallback: Theme): Theme {
  if (value === "dark") return "midnight";
  if (value === "light") return "porcelain";
  return value === "system" || THEMES.some((t) => t.id === value) ? (value as Theme) : fallback;
}
