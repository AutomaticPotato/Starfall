import { describe, expect, it } from "vitest";
import type { SheetData } from "@/lib/api/sheet";
import { buildBattleModel } from "@/lib/battle-model";
import { sheetAttackLines } from "@/lib/sheet-model";
import { attackModes, type CharacterFacts, type Inventory, type ItemInfo } from "@/lib/rules/items";

// a synthetic artificer: an equipped longsword, and an armor attack written by hand in Aurora (no item behind it)
const longsword: ItemInfo = {
  id: "longsword", name: "Longsword", elementType: "Weapon", auroraId: "ID_LONGSWORD", categories: ["Weapons"], weight: 3, slot: "onehand",
  weapon: { damage: "1d8", damageType: "slashing", versatile: "1d10", properties: ["Versatile"], martial: true },
};
const catalog = new Map([[longsword.id, longsword]]);
const facts: CharacterFacts = {
  mod: (a) => ({ STR: 2, INT: 3 })[a as "STR" | "INT"] ?? 0,
  proficiencyBonus: 3,
  stat: () => undefined,
  statNames: [],
  has: new Set(["ID_PROFICIENCY_WEAPON_PROFICIENCY_MARTIAL_WEAPONS"]),
};
const inventory: Inventory = {
  items: [{ id: "sword", elementId: "longsword", quantity: 1, equipped: "Main Hand", attack: 1 }],
  coins: {},
  customAttacks: [{ id: "custom-1", name: "Thunder Gauntlets", range: "5 ft", toHit: "+6 vs AC", damage: "1d8+3 thunder", description: "Guardian armor", place: 2 }],
};

function sheet(inv: Inventory): SheetData {
  return {
    edition: "2024",
    abilities: [{ abbreviation: "STR", calculatedModifier: 2 }, { abbreviation: "INT", calculatedModifier: 3 }],
    proficiencyBonus: 3,
    skills: [],
    spellcasting: [],
    features: [],
    speciesTraits: [],
    backgroundFeature: null,
    cardSpells: [],
    items: [],
    speeds: { walk: 30 },
    attacks: sheetAttackLines(inv, catalog, facts),
    attackModes: attackModes(inv, catalog, facts),
  } as unknown as SheetData;
}

describe("custom attacks in the Battle Action Simulator", () => {
  it("offers an armor attack that no item stands behind, with its written figures, next to the weapons", () => {
    const model = buildBattleModel(sheet(inventory));
    expect(model.weapons.map((w) => w.name)).toContain("Longsword");
    const gauntlets = model.weapons.find((w) => w.name === "Thunder Gauntlets");
    expect(gauntlets).toMatchObject({ bonus: 6, range: "5 ft", melee: true, notes: ["Guardian armor"], properties: [] });
    expect(gauntlets?.roll).toEqual({ dice: [{ count: 1, sides: 8 }], bonus: 3, type: "thunder" });
  });

  it("offers it when the character carries no weapon at all", () => {
    const model = buildBattleModel(sheet({ ...inventory, items: [] }));
    expect(model.weapons.map((w) => w.name)).toEqual(["Thunder Gauntlets"]);
  });
});

it("uses edited custom figures in the sheet/PDF data and battle, then removes deleted attacks", async () => {
  const { saveCustomAttack, removeCustomAttack } = await import("@/lib/rules/custom-attacks");
  const edited = { ...inventory, ...saveCustomAttack(inventory, { ...inventory.customAttacks![0], name: "Frost Gauntlets", damage: "2d8+4 cold", toHit: "+8 vs AC" }, false) };
  expect(sheet(edited).attacks.find((a) => a.name === "Frost Gauntlets")).toMatchObject({ damage: "2d8+4 cold", attack: "+8 vs AC" });
  expect(buildBattleModel(sheet(edited)).weapons.find((a) => a.name === "Frost Gauntlets")).toMatchObject({ bonus: 8, roll: { dice: [{ count: 2, sides: 8 }], bonus: 4, type: "cold" } });
  const removed = { ...edited, ...removeCustomAttack(edited, "custom-1") };
  expect(sheet(removed).attacks.map((a) => a.name)).toEqual(["Longsword"]);
  expect(buildBattleModel(sheet(removed)).weapons.some((a) => a.name === "Frost Gauntlets")).toBe(false);
});
