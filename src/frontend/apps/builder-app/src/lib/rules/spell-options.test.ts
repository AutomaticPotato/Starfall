import { describe, expect, it } from "vitest";
import { groupSpellOptions } from "./spell-options";
import type { SelectionRuleOptionDataModel } from "@starlights/api-client";
const spell = (id: string, source: string, extra: Partial<SelectionRuleOptionDataModel> = {}): SelectionRuleOptionDataModel => ({
  elementId: id,
  name: "Magic Missile",
  source,
  eligible: true,
  spell: { level: 1, school: "Evocation" },
  ...extra,
});
describe("spell reprints", () => {
  it("shows one card for repeated book entries while retaining every printing id", () => {
    const result = groupSpellOptions([spell("a", "Player's Handbook"), spell("b", "Supplement"), spell("c", "Player's Handbook (2024)")], "2024");
    expect(result).toHaveLength(1);
    expect(result[0].option.elementId).toBe("c");
    expect(result[0].printings).toHaveLength(3);
  });
  it("prefers 2014 for a legacy character", () => {
    expect(groupSpellOptions([spell("new", "Player's Handbook (2024)"), spell("old", "Player's Handbook")], "2014")[0].option.elementId).toBe("old");
  });
  it("preserves the exact learned id even when another printing is preferred", () => {
    expect(groupSpellOptions([spell("new", "Player's Handbook (2024)"), spell("old", "Player's Handbook")], "2024", "old")[0].option.elementId).toBe("old");
  });
  it("prefers an eligible printing and never manufactures options from disabled books", () => {
    const result = groupSpellOptions([spell("locked", "Player's Handbook (2024)", { eligible: false }), spell("allowed", "Supplement")], "2024");
    expect(result[0].option.elementId).toBe("allowed");
    expect(result[0].printings.map((p) => p.elementId).sort()).toEqual(["allowed", "locked"]);
  });
  it("normalizes punctuation/spacing but keeps distinct spell names separate", () => {
    const result = groupSpellOptions(
      [spell("a", "A", { name: "  Melf’s  Acid Arrow " }), spell("b", "B", { name: "Melf's Acid Arrow" }), spell("c", "C", { name: "Acid Splash" })],
      "mixed",
    );
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.printings.length === 2)?.printings.map((p) => p.elementId)).toEqual(["a", "b"]);
  });
});
