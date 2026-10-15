import { describe, expect, it } from "vitest";
import {
  crXp,
  DEFAULT_ITEM_WEIGHTS,
  difficulty2014,
  difficulty2024,
  effectiveLevel,
  itemBonus,
  multiplier2014,
  normalizeCr,
} from "./encounter-difficulty";

describe("challenge ratings", () => {
  it("reads every way the data writes them", () => {
    expect(normalizeCr("1/4")).toBe("1/4");
    expect(normalizeCr(0.5)).toBe("1/2");
    expect(normalizeCr({ cr: "5", lair: "6" })).toBe("5");
    expect(normalizeCr("31")).toBeNull();
    expect(crXp("1/8")).toBe(25);
    expect(crXp(10)).toBe(5900);
  });
});

describe("2014 Dungeon Master's Guide", () => {
  it("multiplies by the number of monsters, a step up for small parties and down for big ones", () => {
    expect(multiplier2014(1, 4)).toBe(1);
    expect(multiplier2014(2, 4)).toBe(1.5);
    expect(multiplier2014(6, 4)).toBe(2);
    expect(multiplier2014(7, 4)).toBe(2.5);
    expect(multiplier2014(15, 4)).toBe(4);
    expect(multiplier2014(1, 2)).toBe(1.5);
    expect(multiplier2014(15, 2)).toBe(5);
    expect(multiplier2014(1, 6)).toBe(0.5);
    expect(multiplier2014(3, 6)).toBe(1.5);
  });

  it("rates the DMG's own example: four 3rd-level characters against a bugbear and three hobgoblins", () => {
    // DMG p. 83: 200 + 3 × 100 = 500 XP, × 2 for four monsters = 1,000; Hard threshold 900, Deadly 1,600
    const result = difficulty2014([3, 3, 3, 3], ["1", "1/2", "1/2", "1/2"])!;
    expect(result.xp).toBe(500);
    expect(result.adjusted).toBe(1000);
    expect(result.thresholds).toEqual({ easy: 300, medium: 600, hard: 900, deadly: 1600 });
    expect(result.rating).toBe("Hard");
  });

  it("calls an encounter below Easy trivial, and needs every challenge rating", () => {
    expect(difficulty2014([5, 5, 5, 5], ["1/8"])!.rating).toBe("Trivial");
    expect(difficulty2014([5], [null])).toBeNull();
    expect(difficulty2014([], ["1"])).toBeNull();
  });
});

describe("2024 Dungeon Master's Guide", () => {
  it("adds the monsters' XP without a multiplier and finds the lowest budget it fits under", () => {
    // party 5,5,5,5,3: Low 2,150 · Moderate 3,225 · High 4,800 (the lookup skill's own example)
    const result = difficulty2024([5, 5, 5, 5, 3], ["5", "5", "2", "2"])!;
    expect(result.budgets).toEqual({ low: 2150, moderate: 3225, high: 4800 });
    expect(result.xp).toBe(4500);
    expect(result.rating).toBe("High");
    expect(difficulty2024([1, 1, 1, 1], ["1/4"])!.rating).toBe("Low");
    expect(difficulty2024([1], ["5"])!.rating).toBe("Beyond High");
  });
});

describe("the magic-item estimate (not from the books)", () => {
  it("counts carried magic items by rarity, leaving out consumables and stored ones unless asked", () => {
    const items = [
      { name: "Flame Tongue", rarity: "Rare" },
      { name: "Cloak of Protection", rarity: "uncommon" },
      { name: "Potion of Healing", rarity: "common", consumable: true },
      { name: "Potion of Giant Strength", rarity: "very rare", consumable: true },
      { name: "Staff in the bag of holding", rarity: "legendary", stored: true },
      { name: "Rope", rarity: null },
    ];
    expect(itemBonus(items, DEFAULT_ITEM_WEIGHTS)).toBe(0.75);
    expect(itemBonus(items, DEFAULT_ITEM_WEIGHTS, true)).toBe(1.75);
    expect(itemBonus(items, { ...DEFAULT_ITEM_WEIGHTS, rare: 2 })).toBe(2.25);
  });

  it("raises a character's level for the estimate, at most to 20, between the table's rows", () => {
    expect(effectiveLevel(5, 0.75)).toBe(5.75);
    expect(effectiveLevel(19, 3)).toBe(20);
    // a 5.5 "level" sits halfway between levels 5 and 6 in the tables
    expect(difficulty2024([5.5], ["1"])!.budgets.low).toBe(550);
  });
});
