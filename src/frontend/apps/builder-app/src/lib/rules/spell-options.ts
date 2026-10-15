import type { SelectionRuleOptionDataModel } from "@starlights/api-client";
import type { RulesEdition } from "@/lib/api/sources";

export const spellNameKey = (name: string) => name.normalize("NFKC").trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");

/** Group reprints without changing persisted ids. The explicit edition/printing control resolves mixed rules. */
export function groupSpellOptions(options: SelectionRuleOptionDataModel[], edition: RulesEdition | null, selectedId?: string) {
  const groups = new Map<string, SelectionRuleOptionDataModel[]>();
  for (const option of options) {
    const key = spellNameKey(option.name);
    groups.set(key, [...(groups.get(key) ?? []), option]);
  }
  const revised = (o: SelectionRuleOptionDataModel) => /\b202[45]\b/.test(o.source ?? "");
  return [...groups.values()].map((printings) => {
    const rank = (o: SelectionRuleOptionDataModel) => o.elementId === selectedId ? -100 :
      (o.eligible === false ? 10 : 0) + (edition === "2014" ? Number(revised(o)) : edition === "2024" ? Number(!revised(o)) : 0);
    const sorted = [...printings].sort((a, b) => rank(a) - rank(b) || (a.source ?? "").localeCompare(b.source ?? "") || a.elementId.localeCompare(b.elementId));
    return { option: sorted[0], printings: sorted };
  }).sort((a, b) => (a.option.spell?.level ?? 0) - (b.option.spell?.level ?? 0) || a.option.name.localeCompare(b.option.name));
}
