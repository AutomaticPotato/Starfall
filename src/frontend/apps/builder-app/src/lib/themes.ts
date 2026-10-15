export type Theme = "porcelain" | "slate" | "midnight" | "system";
export const THEMES = [
  { id: "porcelain", name: "Porcelain", description: "Warm white, charcoal and indigo", colors: ["#faf9f6", "#ffffff", "#4338ca"] },
  { id: "slate", name: "Slate", description: "Cool grey, ink and blue", colors: ["#e8edf3", "#f8fafc", "#1d4ed8"] },
  { id: "midnight", name: "Midnight", description: "Deep navy and soft silver", colors: ["#101827", "#192438", "#a5b4fc"] },
] as const;
export function normalizeTheme(value: string | null, fallback: Theme): Theme {
  if (value === "dark") return "midnight";
  if (value === "light") return "porcelain";
  return value === "system" || THEMES.some((t) => t.id === value) ? (value as Theme) : fallback;
}
