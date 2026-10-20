import { describe, expect, it } from "vitest";
import { auroraAttackList, sheetAttacks, withAttackIdentifiers, type AuroraAttack, type Inventory } from "./items";
import { moveCustomAttack, removeCustomAttack, saveCustomAttack } from "./custom-attacks";

const inventory = (): Inventory => ({ items: [], coins: {}, customAttacks: [{ id: "a", name: "Claws", damage: "1d6", place: 1 }, { id: "b", name: "Bite", place: 3 }] });
const imported = [{ identifier: "a", name: "Claws", damage: "2d6" }, { identifier: "b", name: "Bite" }];
describe("custom attack editing", () => {
  it("creates once by stable id and preserves unrelated inventory", () => {
    const original = inventory();
    const change = saveCustomAttack(original, { id: "c", name: " Tail " }, true);
    const saved = { ...original, ...change };
    expect(saved.customAttacks?.at(-1)).toMatchObject({ name: "Tail", edited: true });
    expect(saveCustomAttack(saved, { id: "c", name: "Tail" }, true).customAttacks).toHaveLength(3);
    expect(saved.items).toBe(original.items);
  });
  it("preserves edited figures and order on repeated Aurora imports", () => {
    let current = inventory();
    current = { ...current, ...saveCustomAttack(current, { ...current.customAttacks![0], damage: "3d8 cold", toHit: "DC 15 Dex", description: "Manual" }, false) };
    current = { ...current, ...moveCustomAttack(current, "a", 1) };
    const first = auroraAttackList(imported, new Set(), current.customAttacks!).customAttacks;
    expect(first).toEqual(current.customAttacks);
    expect(auroraAttackList(imported, new Set(), first).customAttacks).toEqual(first);
    expect(first.map((a) => [a.id, a.place])).toEqual([["b", 1], ["a", 3]]);
  });
  it("does not resurrect deleted attacks, including deleting the last one", () => {
    let current = inventory();
    for (const id of ["a", "b"]) current = { ...current, ...removeCustomAttack(current, id) };
    expect(current.customAttacks).toEqual([]);
    expect(auroraAttackList(imported, new Set(), [], current.removedAttackIds!).customAttacks).toEqual([]);
    expect(() => saveCustomAttack(current, { id: "a", name: "Stale edit" }, false)).toThrow("deleted");
  });
  it("keeps unplaced attacks unplaced when reordered", () => {
    const current: Inventory = { ...inventory(), customAttacks: [{ id: "a", name: "Claws" }, { id: "b", name: "Bite" }] };
    const moved = { ...current, ...moveCustomAttack(current, "b", -1) };
    expect(moved.customAttacks?.map((a) => a.place)).toEqual([undefined, undefined]);
    // Sheet/PDF use this shared ordering without requiring an item catalog entry.
    expect(sheetAttacks(moved, new Map(), {} as never).map((a) => a.name)).toEqual(["Bite", "Claws"]);
  });
  it("enforces limits without dropping existing attacks during import", () => {
    const current: Inventory = { ...inventory(), customAttacks: Array.from({ length: 100 }, (_, i) => ({ id: String(i), name: "Attack" })) };
    expect(() => saveCustomAttack(current, { id: "new", name: "More" }, true)).toThrow("100");
    expect(auroraAttackList(imported, new Set(), current.customAttacks!).customAttacks).toHaveLength(100);
    expect(() => saveCustomAttack(current, { id: "0", name: "  " }, false)).toThrow("name");
  });
});

// Aurora writes identifier="" for some attacks entered by hand (Manage → Attacks), as in this character file:
// <attack identifier="" name="Mace" range="5 ft" attack="+2 vs AC" damage="1d6+0 bludgeoning" displayed="true">
// (the importer reads a missing identifier attribute as "" too)
const mace: AuroraAttack = { identifier: "", name: "Mace", range: "5 ft", attack: "+2 vs AC", damage: "1d6+0 bludgeoning", description: "Sap", displayed: true };
const dagger: AuroraAttack = { identifier: "e6a35aa1-854d-4f2f-9e94-c941e47e12a7", name: "Dagger", range: "20/60 ft", attack: "+5 vs AC", damage: "1d4+3 piercing" };

describe("Aurora attacks without an identifier", () => {
  it("are kept, with an identifier that is the same on every import", () => {
    const [id] = withAttackIdentifiers([mace]).map((a) => a.identifier);
    expect(id).toMatch(/^aurora-mace-[0-9a-f]{8}-1$/);
    expect(withAttackIdentifiers([{ ...mace, identifier: "  " }])[0].identifier).toBe(id);
    const { places, customAttacks } = auroraAttackList([dagger, mace], new Set(["e6a35aa1-854d-4f2f-9e94-c941e47e12a7"]));
    expect(customAttacks).toEqual([{ id, name: "Mace", range: "5 ft", toHit: "+2 vs AC", damage: "1d6+0 bludgeoning", ability: null, description: "Sap", place: 2 }]);
    expect(places.get(id)).toBe(2);
    expect(places.get(dagger.identifier)).toBe(1);
  });

  it("leave the identifiers Aurora did write alone", () => {
    expect(withAttackIdentifiers([dagger, mace])[0]).toBe(dagger);
  });

  it("are not added twice by repeated imports, and keep their identity when their figures change", () => {
    const first = auroraAttackList([mace], new Set()).customAttacks;
    expect(auroraAttackList([mace], new Set(), first).customAttacks).toEqual(first);
    const changed = auroraAttackList([{ ...mace, attack: "+4 vs AC", damage: "1d6+2 bludgeoning" }], new Set(), first).customAttacks;
    expect(changed).toHaveLength(1);
    expect(changed[0]).toMatchObject({ id: first[0].id, toHit: "+4 vs AC", damage: "1d6+2 bludgeoning" });
  });

  it("tell identical attacks apart by their order, and do not collide with other names", () => {
    const list = auroraAttackList([mace, { ...mace }, { ...mace, name: "  mace " }, { ...mace, name: "Unarmed Strike" }], new Set()).customAttacks;
    expect(new Set(list.map((a) => a.id)).size).toBe(4);
    expect(list.map((a) => a.id.slice(-2))).toEqual(["-1", "-2", "-3", "-1"]);
    const long = "Very Long Hand Written Attack Name";
    const [a, b] = withAttackIdentifiers([{ ...mace, name: `${long} A` }, { ...mace, name: `${long} B` }]).map((x) => x.identifier);
    expect(a).not.toBe(b);
    expect(a.length).toBeLessThanOrEqual(64);
  });

  it("count hidden attacks too, so hiding one in Aurora does not swap the others' identity", () => {
    const shown = auroraAttackList([mace, { ...mace, damage: "1d6+1 bludgeoning" }], new Set()).customAttacks;
    const hidden = auroraAttackList([{ ...mace, displayed: false }, { ...mace, damage: "1d6+1 bludgeoning" }], new Set()).customAttacks;
    expect(hidden.map((x) => x.id)).toEqual([shown[1].id]);
  });

  it("keep manual edits, order and deletions across re-imports", () => {
    let current: Inventory = { items: [], coins: {}, customAttacks: auroraAttackList([mace, { ...mace, name: "Claw" }], new Set()).customAttacks };
    const [maceId, clawId] = current.customAttacks!.map((a) => a.id);
    current = { ...current, ...saveCustomAttack(current, { ...current.customAttacks![0], damage: "1d6+3 bludgeoning", description: "Blessed" }, false) };
    current = { ...current, ...moveCustomAttack(current, maceId, 1) };
    current = { ...current, ...removeCustomAttack(current, clawId) };
    const again = auroraAttackList([mace, { ...mace, name: "Claw" }], new Set(), current.customAttacks!, current.removedAttackIds!).customAttacks;
    expect(again).toEqual(current.customAttacks);
    expect(again.map((a) => a.id)).toEqual([maceId]);
    expect(again[0]).toMatchObject({ damage: "1d6+3 bludgeoning", description: "Blessed", edited: true });
  });

  it("reach the sheet, PDF and battle attack list like any custom attack", () => {
    const inventory: Inventory = { items: [], coins: {}, customAttacks: auroraAttackList([mace], new Set()).customAttacks };
    const [row] = sheetAttacks(inventory, new Map(), {} as never);
    expect(row).toMatchObject({ name: "Mace", attack: "+2 vs AC", damage: "1d6+0 bludgeoning", range: "5 ft" });
  });
});

