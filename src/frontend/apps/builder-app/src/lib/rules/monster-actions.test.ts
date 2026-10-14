import { describe, expect, it } from "vitest";
import { actionLimits, areaDamage, canUse, homebrewKit, monsterKit, readAction, rollAttack, rollSaveDamage, spendAction, startTurn } from "./monster-actions";
import { EMPTY_MONSTER } from "./homebrew";

// shaped like 5etools' bestiary entries (2014 and 2024 books); the texts are cut down to what is read
const goblin2014 = {
  name: "Goblin",
  action: [
    { name: "Scimitar", entries: ["{@atk mw} {@hit 4} to hit, reach 5 ft., one target. {@h}5 ({@damage 1d6 + 2}) slashing damage."] },
    { name: "Shortbow", entries: ["{@atk rw} {@hit 4} to hit, range 80/320 ft., one target. {@h}5 ({@damage 1d6 + 2}) piercing damage."] },
  ],
};
const dragon2014 = {
  name: "Adult Red Dragon",
  action: [
    { name: "Multiattack", entries: ["The dragon makes three attacks: one with its bite and two with its claws."] },
    { name: "Bite", entries: ["{@atk mw} {@hit 14} to hit, reach 10 ft., one target. {@h}19 ({@damage 2d10 + 8}) piercing damage plus 7 ({@damage 2d6}) fire damage."] },
    { name: "Fire Breath {@recharge 5}", entries: ["Each creature in a 60-foot cone must make a {@dc 21} Dexterity saving throw, taking 63 ({@damage 18d6}) fire damage on a failed save, or half as much damage on a successful one."] },
  ],
  legendary: [
    { name: "Tail Attack", entries: ["The dragon makes a tail attack."] },
    { name: "Wing Attack (Costs 2 Actions)", entries: ["Each creature within 10 feet must succeed on a {@dc 22} Dexterity saving throw or take 15 ({@damage 2d6 + 8}) bludgeoning damage."] },
  ],
};
const dragon2024 = {
  name: "Young Red Dragon",
  action: [
    { name: "Rend", entries: ["{@atkr m} {@hit 10}, reach 10 ft. {@h}13 ({@damage 2d6 + 6}) Slashing damage plus 3 ({@damage 1d6}) Fire damage."] },
    { name: "Fire Breath {@recharge 5}", entries: ["{@actSave dex} {@dc 17}, each creature in a 30-foot Cone. {@actSaveFail} 56 ({@damage 16d6}) Fire damage. {@actSaveSuccess} Half damage."] },
  ],
};
const goblinWarrior2024 = {
  name: "Goblin Warrior",
  action: [{ name: "Scimitar", entries: ["{@atkr m} {@hit 4}, reach 5 ft. {@h}5 ({@damage 1d6 + 2}) Slashing damage, plus 2 ({@damage 1d4}) Slashing damage if the attack roll had Advantage."] }],
  bonus: [{ name: "Nimble Escape", entries: ["The goblin takes the {@action Disengage|XPHB} or {@action Hide|XPHB} action."] }],
};
const mage2024 = {
  name: "Mage",
  action: [{ name: "Arcane Burst", entries: ["{@atkr m,r} {@hit 6}, reach 5 ft. or range 120 ft. {@h}16 ({@damage 3d8 + 3}) Force damage."] }],
  spellcasting: [
    {
      name: "Spellcasting",
      headerEntries: ["The mage casts one of the following spells (spell save {@dc 14}):"],
      will: ["{@spell Detect Magic|XPHB}", "{@spell Mage Hand|XPHB}"],
      daily: { "2e": ["{@spell Fireball|XPHB} (level 4 version)", "{@spell Invisibility|XPHB}"], "1e": ["{@spell Cone of Cold|XPHB}"] },
    },
  ],
};

describe("a monster's actions", () => {
  it("reads 2014 weapon attacks: bonus, melee or ranged, reach, damage and its type", () => {
    const [scimitar, bow] = monsterKit(goblin2014).actions;
    expect(scimitar).toMatchObject({ section: "action", name: "Scimitar", attack: { bonus: 4, kind: "melee", reach: "reach 5 ft." } });
    expect(scimitar.damage).toEqual([{ dice: [{ count: 1, sides: 6 }], bonus: 2, type: "slashing" }]);
    expect(bow.attack).toMatchObject({ bonus: 4, kind: "ranged", reach: "range 80/320 ft." });
    expect(scimitar.text).toContain("Melee Weapon Attack:");
  });

  it("reads 2024 attack rolls, and damage that only counts when something holds", () => {
    const [scimitar, escape] = monsterKit(goblinWarrior2024).actions;
    expect(scimitar.attack).toMatchObject({ bonus: 4, kind: "melee" });
    expect(scimitar.damage.map((d) => [d.type, d.condition])).toEqual([
      ["slashing", undefined],
      ["slashing", "if the attack roll had Advantage"],
    ]);
    expect(escape).toMatchObject({ section: "bonus", name: "Nimble Escape", damage: [] });
    expect(monsterKit(mage2024).actions[0].attack?.kind).toBe("melee or ranged");
  });

  it("keeps an \"if\" about something else off the damage", () => {
    const bite = readAction("{@atk mw} {@hit 8} to hit, reach 5 ft., one target. {@h}22 ({@damage 5d8}) piercing damage, and the target is {@condition grappled} (escape {@dc 15}) if it is a Large or smaller creature.");
    expect(bite.damage).toEqual([{ dice: [{ count: 5, sides: 8 }], bonus: 0, type: "piercing" }]);
  });

  it("reads several damage types on one hit", () => {
    const bite = monsterKit(dragon2014).actions[1];
    expect(bite.damage.map((d) => d.type)).toEqual(["piercing", "fire"]);
  });

  it("reads saving throws in both books' wording, with half damage on a success", () => {
    const breath2014 = monsterKit(dragon2014).actions[2];
    expect(breath2014).toMatchObject({ name: "Fire Breath", recharge: 5, save: { ability: "Dexterity", dc: 21, halfOnSuccess: true } });
    expect(breath2014.damage[0]).toMatchObject({ dice: [{ count: 18, sides: 6 }], type: "fire" });
    const breath2024 = monsterKit(dragon2024).actions[1];
    expect(breath2024).toMatchObject({ recharge: 5, save: { ability: "Dexterity", dc: 17, halfOnSuccess: true } });
    expect(breath2024.attack).toBeUndefined();
  });

  it("knows multiattack, legendary actions and their cost", () => {
    const kit = monsterKit(dragon2014);
    expect(kit.actions[0].multiattack).toBe(true);
    expect(kit.legendaryActions).toBe(3);
    const wing = kit.actions.find((a) => a.name === "Wing Attack")!;
    expect(wing).toMatchObject({ section: "legendary", cost: 2, save: { dc: 22, ability: "Dexterity", halfOnSuccess: false } });
  });

  it("reads limits from names", () => {
    expect(actionLimits("Spit Venom (3/Day)")).toEqual({ name: "Spit Venom", perDay: 3 });
    expect(actionLimits("Lightning Breath (Recharge 6)")).toEqual({ name: "Lightning Breath", recharge: 6 });
    expect(actionLimits("Fire Breath {@recharge}")).toEqual({ name: "Fire Breath", recharge: 6 });
  });

  it("reads spellcasting: save DC, at will, per day", () => {
    const [sc] = monsterKit(mage2024).spellcasting;
    expect(sc.dc).toBe(14);
    expect(sc.groups.map((g) => [g.label, g.spells.length, g.perDay])).toEqual([
      ["At will", 2, undefined],
      ["2/Day each", 2, 2],
      ["1/Day each", 1, 1],
    ]);
    expect(sc.groups[1].spells[0]).toBe("Fireball (level 4 version)");
  });

  it("reads what a book writes out without tags, and a choice of damage types", () => {
    expect(readAction("Melee Weapon Attack: +7 to hit, reach 5 ft., one target. Hit: 7 (1d6 + 4) piercing damage.").attack).toMatchObject({ bonus: 7, kind: "melee" });
    expect(readAction("{@atk ms} {@hit 8} to hit, reach 10 ft. {@h}22 ({@dice 5d6 + 5}) poison damage.").damage[0]).toMatchObject({ bonus: 5, type: "poison" });
    expect(readAction("{@atk ms,rs} {@hit 6} to hit. {@h}19 ({@damage 3d10 + 3}) necrotic or radiant damage (its choice).").damage[0].type).toBe("necrotic or radiant");
    expect(readAction("Each creature in the area must make a DC 21 saving throw, taking 55 ({@damage 10d10}) necrotic damage on a failed save, or half as much damage on a successful one.").save).toEqual({ ability: "", dc: 21, halfOnSuccess: true });
  });

  it("finds no attack in plain text", () => {
    expect(readAction("The dragon makes a tail attack.")).toEqual({ damage: [] });
  });
});

describe("a homebrew monster's actions", () => {
  it("reads the Homebrew page's lines: name, attack, damage, save, limits", () => {
    const kit = homebrewKit({
      ...EMPTY_MONSTER,
      name: "Barovian Witch",
      actions: "Multiattack. The witch makes two Claw attacks.\nClaw. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage.\nHex Bolt (Recharge 5–6). Each creature in a 10-foot cube must make a DC 13 Wisdom saving throw, taking 10 (3d6) psychic damage on a failed save, or half as much damage on a successful one.",
      bonusActions: "Vanish (2/Day). The witch turns invisible until the start of her next turn.",
    });
    const [multi, claw, hex, vanish] = kit.actions;
    expect(multi.multiattack).toBe(true);
    expect(claw).toMatchObject({ name: "Claw", attack: { bonus: 5, kind: "melee" } });
    expect(claw.damage[0]).toMatchObject({ dice: [{ count: 1, sides: 8 }], bonus: 3, type: "slashing" });
    expect(hex).toMatchObject({ name: "Hex Bolt", recharge: 5, save: { ability: "Wisdom", dc: 13, halfOnSuccess: true } });
    expect(hex.damage[0].type).toBe("psychic");
    expect(vanish).toMatchObject({ section: "bonus", name: "Vanish", perDay: 2 });
    expect(kit.legendaryActions).toBe(0);
  });
});

describe("a monster's uses in a fight", () => {
  const kit = monsterKit(dragon2014);
  const breath = kit.actions.find((a) => a.name === "Fire Breath")!;
  const wing = kit.actions.find((a) => a.name === "Wing Attack")!;
  const tail = kit.actions.find((a) => a.name === "Tail Attack")!;

  it("spends a recharge action until a d6 brings it back at the start of its turn", () => {
    let state = spendAction(breath, {});
    expect(canUse(breath, state, 3).ok).toBe(false);
    const miss = startTurn(state, () => 0.5); // a 4
    expect(miss.rolls).toEqual(["Fire Breath: 4, not yet"]);
    expect(canUse(breath, miss.state, 3).ok).toBe(false);
    state = startTurn(miss.state, () => 0.99).state; // a 6
    expect(canUse(breath, state, 3).ok).toBe(true);
  });

  it("spends legendary actions by their cost, and gets them back at the start of its turn", () => {
    let state = spendAction(wing, {});
    state = spendAction(tail, state);
    expect(state.legendarySpent).toBe(3);
    expect(canUse(tail, state, 3)).toMatchObject({ ok: false });
    expect(canUse(tail, startTurn(state).state, 3).ok).toBe(true);
  });

  it("counts uses per day", () => {
    const venom = { ...monsterKit(goblin2014).actions[0], name: "Spit Venom", perDay: 2 };
    const state = spendAction(venom, spendAction(venom, {}));
    expect(canUse(venom, state, 0)).toMatchObject({ ok: false, why: "no uses left today" });
  });
});

// a die that rolls the given faces in turn (a d20's 17 is 16/20, a d6's 4 is 3/6, …)
const dice = (...faces: [number, number][]) => {
  let i = 0;
  return () => {
    const [face, sides] = faces[i++ % faces.length];
    return (face - 1) / sides + 0.001;
  };
};

describe("rolling a monster's actions", () => {
  const [, bite, breath] = monsterKit(dragon2014).actions;

  it("hits an armor class and rolls each damage type", () => {
    // d20 17 + 14 = 31; bite 2d10 (5, 5) + 8 piercing, 2d6 (3, 3) fire
    const r = rollAttack(bite, 18, "normal", dice([17, 20], [5, 10], [5, 10], [3, 6], [3, 6]))!;
    expect(r).toMatchObject({ kept: 17, total: 31, hit: true, crit: false, totalDamage: 24 });
    expect(r.damage.map((d) => [d.amount, d.type])).toEqual([[18, "piercing"], [6, "fire"]]);
  });

  it("rolls the dice twice on a 20, misses on a 1, and keeps the better d20 with advantage", () => {
    expect(rollAttack(bite, 40, "normal", dice([20, 20], [1, 10]))!).toMatchObject({ hit: true, crit: true });
    expect(rollAttack(bite, 40, "normal", dice([20, 20], [1, 10]))!.damage[0].dice).toBe("4d10+8");
    expect(rollAttack(bite, 5, "normal", dice([1, 20]))!).toMatchObject({ hit: false, damage: [], totalDamage: 0 });
    expect(rollAttack(bite, 18, "advantage", dice([3, 20], [15, 20], [1, 10]))!).toMatchObject({ rolls: [3, 15], kept: 15, hit: true });
  });

  it("rolls a breath weapon once: the full damage and half on a success", () => {
    const r = rollSaveDamage(breath, () => 0.5); // every d6 a 4
    expect(r).toMatchObject({ full: 72, half: 36 });
  });

  it("rolls each creature's save against an area, with its own bonus", () => {
    const out = areaDamage([{ id: "a", name: "Goblin 1", bonus: 2 }, { id: "b", name: "Goblin 2", bonus: 2 }], 28, { dc: 15, halfOnSuccess: true }, dice([15, 20], [3, 20]));
    expect(out.map((o) => [o.name, o.roll, o.saved, o.damage])).toEqual([["Goblin 1", 17, true, 14], ["Goblin 2", 5, false, 28]]);
    expect(areaDamage([{ id: "a", name: "Goblin 1", bonus: 2 }], 10, null)[0].damage).toBe(10);
  });
});
