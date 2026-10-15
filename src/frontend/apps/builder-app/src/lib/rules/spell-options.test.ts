import { describe, expect, it } from "vitest";
import { groupSpellOptions, spellComparisonIds, spellPrintingKey, type SpellIdentityContext, type SpellPrintingFacts } from "./spell-options";
import type { SelectionRuleOptionDataModel } from "@starlights/api-client";
const old = "Player's Handbook";
const revised = "Player's Handbook (2024)";
const supplement = "Test Supplement";
const spell = (id: string, source = old, extra: Partial<SelectionRuleOptionDataModel> = {}): SelectionRuleOptionDataModel => ({
  elementId: id, name: "Magic Missile", source, eligible: true, spell: { level: 1, school: "Evocation" }, ...extra,
});
const facts = (id: string, extra: Partial<SpellPrintingFacts> = {}): SpellPrintingFacts => ({
  id, auroraId: `ID_WOTC_TEST_SPELL_${id}`, description: "<p>Deal 1d4 + 1 force damage per dart.</p>",
  setters: { level: "1", school: "Evocation", time: "1 action", page: "100" }, supports: ["Wizard", "Sorcerer"], stats: [], ...extra,
});
const context = (...entries: SpellPrintingFacts[]): SpellIdentityContext => ({
  sources: [{ name: old, group: "core", elements: 1 }, { name: revised, group: "core", elements: 1 },
    { name: supplement, group: "supplements", elements: 1 }, { name: "Table spells", group: "homebrew", elements: 1 }],
  facts: new Map(entries.map(e => [e.id, e])),
});

describe("spell printing identity", () => {
  it("consolidates verified identical same-edition reprints, ignoring only page numbers and tag order", () => {
    const ctx = context(facts("a"), facts("b", { setters: { page: "12", time: "1 action", school: "Evocation", level: "1" }, supports: ["Sorcerer", "Wizard"] }));
    const result = groupSpellOptions([spell("a"), spell("b", supplement)], "2014", undefined, ctx);
    expect(result).toHaveLength(1);
    expect(result[0].printings.map(p => p.elementId).sort()).toEqual(["a", "b"]);
  });
  it("keeps 2014 and 2024 independently selectable even if their casting summaries or descriptions match", () => {
    const ctx = context(facts("old"), facts("new"));
    expect(groupSpellOptions([spell("old"), spell("new", revised)], "mixed", undefined, ctx)).toHaveLength(2);
    expect(spellPrintingKey(spell("old"), ctx)).not.toBe(spellPrintingKey(spell("new", revised), ctx));
  });
  it("keeps changed same-edition effects separate despite identical names/casting summaries", () => {
    const ctx = context(facts("a"), facts("b", { description: "<p>Deal 2d4 + 1 force damage per dart.</p>" }));
    expect(groupSpellOptions([spell("a"), spell("b", supplement)], "2014", undefined, ctx)).toHaveLength(2);
  });
  it("keeps differing components, duration and other setters separate", () => {
    const ctx = context(facts("a"), facts("b", { setters: { ...facts("b").setters, duration: "1 minute" } }));
    expect(groupSpellOptions([spell("a"), spell("b")], "2014", undefined, ctx)).toHaveLength(2);
  });
  it("keeps different spell lists and stat rules separate", () => {
    const ctx = context(facts("a"), facts("b", { supports: ["Wizard"] }), facts("c", { stats: [{ value: "2" }] }));
    expect(groupSpellOptions([spell("a"), spell("b"), spell("c")], "mixed", undefined, ctx)).toHaveLength(3);
  });
  it("never consolidates homebrew with official spells or other homebrew, even with copied text and IDs", () => {
    const ctx = context(facts("a"), facts("b"), facts("c"));
    expect(groupSpellOptions([spell("a"), spell("b", "Table spells"), spell("c", "Table spells")], "mixed", undefined, ctx)).toHaveLength(3);
  });
  it("keeps custom Aurora IDs distinct even if they claim the official source label", () => {
    const ctx = context(facts("a"), facts("b", { auroraId: "ID_MY_TABLE_SPELL_MAGIC_MISSILE" }));
    expect(groupSpellOptions([spell("a"), spell("b")], "mixed", undefined, ctx)).toHaveLength(2);
  });
  it("keeps unknown provenance or unavailable descriptions separate", () => {
    const ctx = context(facts("a"), facts("b", { description: "" }));
    expect(groupSpellOptions([spell("a"), spell("b"), spell("c")], "mixed", undefined, ctx)).toHaveLength(3);
    expect(groupSpellOptions([spell("a"), spell("b")], "mixed")).toHaveLength(2);
  });
  it("preserves the selected reprint's exact id even when another printing is eligible", () => {
    const ctx = context(facts("a"), facts("b"));
    const result = groupSpellOptions([spell("a", old, { eligible: false }), spell("b", supplement)], "2024", "a", ctx);
    expect(result[0].option.elementId).toBe("a");
  });
  it("does not add a saved spell that is absent from current class/source choices", () => {
    const ctx = context(facts("a"), facts("removed"));
    const result = groupSpellOptions([spell("a")], "2014", "removed", ctx);
    expect(result.flatMap(g => g.printings.map(p => p.elementId))).toEqual(["a"]);
  });
  it("prefers an eligible identical reprint without modifying the input references", () => {
    const options = [spell("a", old, { eligible: false }), spell("b", supplement)];
    const before = structuredClone(options);
    expect(groupSpellOptions(options, "mixed", undefined, context(facts("a"), facts("b")))[0].option.elementId).toBe("b");
    expect(options).toEqual(before);
  });
  it("normalizes name punctuation/spacing while preserving distinct spell names", () => {
    const ctx = context(facts("a"), facts("b"), facts("c"));
    const result = groupSpellOptions([spell("a", old, { name: "  Melf’s  Acid Arrow " }), spell("b", supplement, { name: "Melf's Acid Arrow" }), spell("c", old, { name: "Acid Splash" })], "mixed", undefined, ctx);
    expect(result).toHaveLength(2);
  });
  it("compares saved reprints omitted by a class option list without manufacturing class choices", () => {
    const selected = spell("saved", supplement);
    const available = spell("a");
    const ctx = context(facts("saved"), facts("a"));
    expect(spellComparisonIds([selected, available])).toEqual(["a", "saved"]);
    expect(spellPrintingKey(selected, ctx)).toBe(spellPrintingKey(available, ctx));
    expect(groupSpellOptions([available], "2014", undefined, ctx)[0].printings).toEqual([available]);
  });
  it("only fetches comparisons for ambiguous names, and de-duplicates exact ids", () => {
    expect(spellComparisonIds([spell("a"), spell("a"), spell("b"), spell("unique", old, { name: "Shield" })])).toEqual(["a", "b"]);
  });
});
