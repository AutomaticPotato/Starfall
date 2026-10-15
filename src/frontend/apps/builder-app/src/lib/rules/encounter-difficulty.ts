/**
 * How hard an encounter is, by the books: the 2014 Dungeon Master's Guide (XP thresholds by character level, and a
 * multiplier for the number of monsters, adjusted for party size) and the 2024 Dungeon Master's Guide (XP budget per
 * character; the monsters' XP is added up without a multiplier). Tables copied from the books via the 5etools data
 * (book-dmg.json "XP Thresholds by Character Level", "Encounter Multipliers"; book-xdmg.json "XP Budget per
 * Character"; XP by challenge rating from the Monster Manual).
 *
 * Separately, and not from any book: an optional estimate that treats the magic items a character carries as extra
 * levels (weights the DM can change). It never replaces the official result; the page shows it apart.
 */

/** XP for defeating a monster of each challenge rating. */
export const XP_BY_CR: Readonly<Record<string, number>> = {
  "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800, "6": 2300, "7": 2900,
  "8": 3900, "9": 5000, "10": 5900, "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000, "16": 15000,
  "17": 18000, "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000, "23": 50000, "24": 62000, "25": 75000,
  "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000,
};

export const CHALLENGE_RATINGS = Object.keys(XP_BY_CR);

/** 2014 DMG: Easy, Medium, Hard, Deadly per character, by level 1–20. */
export const THRESHOLDS_2014: Readonly<Record<number, readonly [number, number, number, number]>> = {
  1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400], 4: [125, 250, 375, 500], 5: [250, 500, 750, 1100],
  6: [300, 600, 900, 1400], 7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100], 9: [550, 1100, 1600, 2400],
  10: [600, 1200, 1900, 2800], 11: [800, 1600, 2400, 3600], 12: [1000, 2000, 3000, 4500], 13: [1100, 2200, 3400, 5100],
  14: [1250, 2500, 3800, 5700], 15: [1400, 2800, 4300, 6400], 16: [1600, 3200, 4800, 7200], 17: [2000, 3900, 5900, 8800],
  18: [2100, 4200, 6300, 9500], 19: [2400, 4900, 7300, 10900], 20: [2800, 5700, 8500, 12700],
};

/** 2024 DMG: Low, Moderate, High budget per character, by level 1–20. */
export const BUDGET_2024: Readonly<Record<number, readonly [number, number, number]>> = {
  1: [50, 75, 100], 2: [100, 150, 200], 3: [150, 225, 400], 4: [250, 375, 500], 5: [500, 750, 1100], 6: [600, 1000, 1400],
  7: [750, 1300, 1700], 8: [1000, 1700, 2100], 9: [1300, 2000, 2600], 10: [1600, 2300, 3100], 11: [1900, 2900, 4100],
  12: [2200, 3700, 4700], 13: [2600, 4200, 5400], 14: [2900, 4900, 6200], 15: [3300, 5400, 7800], 16: [3800, 6100, 9800],
  17: [4500, 7200, 11700], 18: [5000, 8700, 14200], 19: [5500, 10700, 17200], 20: [6400, 13200, 22000],
};

/**
 * 2014 DMG multipliers, with the steps beyond the table the party-size rule uses: ×0.5 for a single monster with six
 * or more characters, ×5 for fifteen or more monsters with fewer than three.
 */
export const MULTIPLIERS_2014 = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5] as const;

/** A challenge rating as the data writes it ("1/4", "5", 0.25, { cr: "5" }) in the table's form, or null. */
export function normalizeCr(cr: unknown): string | null {
  if (cr && typeof cr === "object" && "cr" in cr) return normalizeCr((cr as { cr: unknown }).cr);
  const text = String(cr ?? "").trim();
  if (text === "") return null;
  if (text in XP_BY_CR) return text;
  const n = Number(text);
  if (n === 0.125) return "1/8";
  if (n === 0.25) return "1/4";
  if (n === 0.5) return "1/2";
  return Number.isInteger(n) && String(n) in XP_BY_CR ? String(n) : null;
}

export function crXp(cr: unknown): number | null {
  const key = normalizeCr(cr);
  return key ? XP_BY_CR[key] : null;
}

const clampLevel = (level: number) => Math.min(20, Math.max(1, level));

/** A row of a by-level table for a level that may have a fraction (the estimate's levels): between the two rows. */
function rowAt<T extends readonly number[]>(table: Readonly<Record<number, T>>, level: number): number[] {
  const l = clampLevel(level);
  const low = table[Math.floor(l)];
  const high = table[Math.min(20, Math.ceil(l))];
  const t = l - Math.floor(l);
  return low.map((v, i) => Math.round(v + (high[i] - v) * t));
}

/** The 2014 multiplier for this many monsters, moved one step for a party of fewer than three or six and more. */
export function multiplier2014(monsters: number, partySize: number): number {
  if (monsters <= 0) return 0;
  // the table's rows: 1, 2, 3–6, 7–10, 11–14, 15+ → steps 1..6 of MULTIPLIERS_2014
  const step = monsters === 1 ? 1 : monsters === 2 ? 2 : monsters <= 6 ? 3 : monsters <= 10 ? 4 : monsters <= 14 ? 5 : 6;
  const shifted = partySize < 3 ? step + 1 : partySize >= 6 ? step - 1 : step;
  return MULTIPLIERS_2014[Math.min(MULTIPLIERS_2014.length - 1, Math.max(0, shifted))];
}

export type Rating2014 = "Trivial" | "Easy" | "Medium" | "Hard" | "Deadly";
export type Rating2024 = "Low" | "Moderate" | "High" | "Beyond High";

export interface Result2014 {
  xp: number;
  multiplier: number;
  adjusted: number;
  thresholds: { easy: number; medium: number; hard: number; deadly: number };
  rating: Rating2014;
}

export interface Result2024 {
  xp: number;
  budgets: { low: number; moderate: number; high: number };
  rating: Rating2024;
}

/**
 * 2014: the monsters' XP times the multiplier, against the party's summed thresholds. The highest threshold the
 * adjusted XP reaches is the difficulty; below Easy the book calls it trivial.
 */
export function difficulty2014(levels: readonly number[], crs: readonly unknown[]): Result2014 | null {
  const xps = crs.map(crXp);
  if (levels.length === 0 || xps.length === 0 || xps.some((x) => x === null)) return null;
  const xp = (xps as number[]).reduce((a, b) => a + b, 0);
  const multiplier = multiplier2014(xps.length, levels.length);
  const adjusted = Math.round(xp * multiplier);
  const [easy, medium, hard, deadly] = levels.map((l) => rowAt(THRESHOLDS_2014, l)).reduce((a, r) => a.map((v, i) => v + r[i]), [0, 0, 0, 0]);
  const rating: Rating2014 = adjusted >= deadly ? "Deadly" : adjusted >= hard ? "Hard" : adjusted >= medium ? "Medium" : adjusted >= easy ? "Easy" : "Trivial";
  return { xp, multiplier, adjusted, thresholds: { easy, medium, hard, deadly }, rating };
}

/** 2024: the monsters' XP (no multiplier) against the party's summed budgets: the lowest budget it fits under. */
export function difficulty2024(levels: readonly number[], crs: readonly unknown[]): Result2024 | null {
  const xps = crs.map(crXp);
  if (levels.length === 0 || xps.length === 0 || xps.some((x) => x === null)) return null;
  const xp = (xps as number[]).reduce((a, b) => a + b, 0);
  const [low, moderate, high] = levels.map((l) => rowAt(BUDGET_2024, l)).reduce((a, r) => a.map((v, i) => v + r[i]), [0, 0, 0]);
  const rating: Rating2024 = xp <= low ? "Low" : xp <= moderate ? "Moderate" : xp <= high ? "High" : "Beyond High";
  return { xp, budgets: { low, moderate, high }, rating };
}

// --- the estimate (not in either book) ---

export const RARITIES = ["common", "uncommon", "rare", "very rare", "legendary", "artifact"] as const;
export type Rarity = (typeof RARITIES)[number];

/** Levels a carried magic item of each rarity adds in the estimate; the DM can change them. */
export const DEFAULT_ITEM_WEIGHTS: Readonly<Record<Rarity, number>> = {
  common: 0,
  uncommon: 0.25,
  rare: 0.5,
  "very rare": 1,
  legendary: 2,
  artifact: 3,
};

/** A magic item a character has, as the estimate counts it. */
export interface HeldItem {
  name: string;
  rarity?: string | null;
  /** potions, scrolls and other things used up once */
  consumable?: boolean;
  /** in storage rather than on them */
  stored?: boolean;
}

export function rarityOf(text: string | null | undefined): Rarity | null {
  const t = (text ?? "").toLowerCase().replace(/[^a-z ]/g, "").trim();
  return (RARITIES as readonly string[]).includes(t) ? (t as Rarity) : null;
}

/** The levels a character's carried magic items add (consumables and stored items only when asked). */
export function itemBonus(items: readonly HeldItem[], weights: Readonly<Record<Rarity, number>>, countConsumables = false): number {
  let bonus = 0;
  for (const item of items) {
    const rarity = rarityOf(item.rarity);
    if (!rarity || item.stored || (item.consumable && !countConsumables)) continue;
    bonus += Math.max(0, weights[rarity] ?? 0);
  }
  return Math.round(bonus * 100) / 100;
}

/** A character's level for the estimate: their level plus their items' bonus, at most 20. */
export function effectiveLevel(level: number, bonus: number): number {
  return Math.min(20, Math.round((level + bonus) * 100) / 100);
}
