import { describe, expect, it } from "vitest";
import { auroraAttackList, sheetAttacks, type Inventory } from "./items";
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
