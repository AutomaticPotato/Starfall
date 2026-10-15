import type { SpellOptionDataModel } from "@starlights/api-client";
import { ordinal } from "./magic";

/** An option a choice list can filter: what it is called, a line under it, whether it can be taken, its filter values. */
export type FilterableOption = { name: string; hint?: string | null; disabled?: boolean; facets?: Record<string, string[]> };

/** A filter group of a choice list ("Level", "School"), with the order its chips come in when it has one. */
export type Facet = { key: string; label: string; order?: readonly string[] };

/** The chips ticked per filter group, by the group's key. */
export type FacetSelection = Record<string, readonly string[]>;

/**
 * The options left after the search text, the ticked chips and "only what I can take": an option shows when its
 * name or hint has the text, it has one of the ticked values of every group with a tick, and (when asked) it can be
 * taken now.
 */
export function filterOptions<T extends FilterableOption>(options: readonly T[], query: string, selection: FacetSelection, onlyAvailable = false): T[] {
  const q = query.trim().toLowerCase();
  const groups = Object.entries(selection).filter(([, values]) => values.length > 0);
  return options.filter(
    (o) =>
      (!q || o.name.toLowerCase().includes(q) || !!o.hint?.toLowerCase().includes(q)) &&
      (!onlyAvailable || !o.disabled) &&
      groups.every(([key, values]) => o.facets?.[key]?.some((v) => values.includes(v))),
  );
}

/**
 * The chips a filter group gets: the values its options have, in the group's order (others after it, A to Z). A
 * group is only worth showing when it tells the options apart, so one with fewer than two values gets none, except
 * a tag some options have and others don't (Ritual).
 */
export function facetValues(options: readonly FilterableOption[], facet: Facet): string[] {
  const values = new Set<string>();
  let without = 0;
  for (const o of options) {
    const own = o.facets?.[facet.key] ?? [];
    if (own.length === 0) without++;
    for (const v of own) values.add(v);
  }
  if (values.size === 0 || (values.size === 1 && without === 0)) return [];
  const rank = (v: string) => (facet.order?.includes(v) ? facet.order.indexOf(v) : Number.MAX_SAFE_INTEGER);
  return [...values].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** Toggles one chip of a filter group. */
export function toggleFacet(selection: FacetSelection, key: string, value: string): FacetSelection {
  const current = selection[key] ?? [];
  return { ...selection, [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value] };
}

// --- spells ---

export const SPELL_LEVELS = ["Cantrip", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"] as const;
export const SPELL_CASTING = ["Action", "Bonus action", "Reaction", "Longer"] as const;

/** The filter groups of a spell list. */
export const SPELL_FACETS: Facet[] = [
  { key: "level", label: "Level", order: SPELL_LEVELS },
  { key: "school", label: "School" },
  { key: "casting", label: "Casting", order: SPELL_CASTING },
  { key: "tags", label: "Tags", order: ["Concentration", "Ritual"] },
];

/** How long a spell takes to cast, as a filter chip: an action, a bonus action, a reaction, or longer (1 minute, 1 hour). */
export function castingKind(castingTime?: string | null): string | null {
  const t = castingTime?.toLowerCase().trim();
  if (!t) return null;
  if (t.includes("bonus")) return "Bonus action";
  if (t.includes("reaction")) return "Reaction";
  if (/\baction\b/.test(t)) return "Action";
  return "Longer";
}

/** A spell option's filter values. */
export function spellFacets(spell: SpellOptionDataModel): Record<string, string[]> {
  const casting = castingKind(spell.castingTime);
  return {
    level: [ordinal(spell.level)],
    school: spell.school ? [spell.school] : [],
    casting: casting ? [casting] : [],
    tags: [spell.concentration && "Concentration", spell.ritual && "Ritual"].filter((t): t is string => !!t),
  };
}

/** "3rd-level evocation", "Evocation cantrip". */
export function spellKind(spell: SpellOptionDataModel): string {
  const school = spell.school ?? "";
  if (spell.level === 0) return school ? `${school} cantrip` : "Cantrip";
  return `${ordinal(spell.level)}-level ${school.toLowerCase()}`.trim();
}

/** The short line under a spell in a list: "1st · Evocation · Concentration · Ritual". */
export function spellHint(spell: SpellOptionDataModel): string {
  return [ordinal(spell.level), spell.school, spell.concentration && "Concentration", spell.ritual && "Ritual"].filter(Boolean).join(" · ");
}

/** A spell's figures, as label and value, for the details under a list. */
export function spellDetails(spell: SpellOptionDataModel): { label: string; value: string }[] {
  const rows: [string, string | null | undefined][] = [
    ["Casting time", spell.castingTime],
    ["Range", spell.range],
    ["Duration", spell.duration],
    ["Components", spell.components],
    ["Spell lists", spell.lists?.length ? spell.lists.join(", ") : null],
  ];
  return rows.filter((r): r is [string, string] => !!r[1]).map(([label, value]) => ({ label, value }));
}
