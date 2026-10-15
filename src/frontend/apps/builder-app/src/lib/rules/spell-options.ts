import type { SelectionRuleOptionDataModel } from "@starlights/api-client";
import type { RulesEdition, SourceBook } from "@/lib/api/sources";

export const spellNameKey = (name: string) => name.normalize("NFKC").trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");

type SpellReference = Pick<SelectionRuleOptionDataModel, "elementId" | "name" | "source">;
export interface SpellPrintingFacts {
  id: string;
  auroraId?: string | null;
  description: string;
  setters: Record<string, string>;
  supports: string[];
  stats: unknown[];
}
export interface SpellIdentityContext {
  sources: SourceBook[];
  facts: ReadonlyMap<string, SpellPrintingFacts>;
}
const EMPTY_CONTEXT: SpellIdentityContext = { sources: [], facts: new Map() };

/** Names/casting summaries alone cannot prove that damage, effects or homebrew are equivalent. */
export function spellPrintingKey(option: SpellReference, context: SpellIdentityContext): string {
  const unique = `id:${option.elementId}`;
  const source = context.sources.find((s) => s.name === option.source);
  const fact = context.facts.get(option.elementId);
  // Unknown and custom provenance must remain independent, even when it copies an official name/source label.
  if (!source || !["core", "supplements"].includes(source.group) || !fact?.description.trim() || !fact.setters?.level) return unique;
  if (!/^ID_(?:WOTC_[A-Z0-9_]+|PHB|SCAG|XGTE|EEPC)_SPELL_/.test(fact.auroraId ?? "")) return unique;
  const edition = /\((2024|2025)\)\s*$/.test(option.source ?? "") || /_PHB24_/.test(fact.auroraId ?? "") ? "2024" : "2014";
  // Only bibliographic page numbers are ignored. Keep all mechanics, including full description and setters.
  const setters = Object.entries(fact.setters).filter(([key]) => key !== "page").sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify([spellNameKey(option.name), edition, fact.description.replace(/\s+/g, " ").trim(), setters,
    [...fact.supports].sort(), fact.stats.map((stat) => JSON.stringify(stat)).sort()]);
}

/** Only same-name candidates need the existing batch endpoint's full mechanics/provenance. */
export function spellComparisonIds(options: SpellReference[]): string[] {
  const names = new Map<string, Set<string>>();
  for (const option of options) {
    const name = spellNameKey(option.name);
    if (!names.has(name)) names.set(name, new Set());
    names.get(name)!.add(option.elementId);
  }
  return [...names.values()].filter((ids) => ids.size > 1).flatMap((ids) => [...ids]).sort();
}

/** A display-only projection. Never rewrites, removes, or manufactures persisted spell references. */
export function groupSpellOptions(options: SelectionRuleOptionDataModel[], edition: RulesEdition | null, selectedId?: string, context = EMPTY_CONTEXT) {
  const groups = new Map<string, SelectionRuleOptionDataModel[]>();
  for (const option of options) {
    const key = spellPrintingKey(option, context);
    groups.set(key, [...(groups.get(key) ?? []), option]);
  }
  const revised = (o: SelectionRuleOptionDataModel) => /\b202[45]\b/.test(o.source ?? "");
  return [...groups.entries()]
    .map(([key, printings]) => {
      const rank = (o: SelectionRuleOptionDataModel) =>
        o.elementId === selectedId
          ? -100
          : (o.eligible === false ? 10 : 0) + (edition === "2014" ? Number(revised(o)) : edition === "2024" ? Number(!revised(o)) : 0);
      const sorted = [...printings].sort(
        (a, b) => rank(a) - rank(b) || (a.source ?? "").localeCompare(b.source ?? "") || a.elementId.localeCompare(b.elementId),
      );
      return { key, option: sorted[0], printings: sorted };
    })
    .sort((a, b) => (a.option.spell?.level ?? 0) - (b.option.spell?.level ?? 0) || a.option.name.localeCompare(b.option.name));
}
