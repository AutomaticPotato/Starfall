import type { CustomAttack, Inventory } from "./items";

export const orderedCustomAttacks = (inventory: Inventory) =>
  [...(inventory.customAttacks ?? [])].sort((a, b) => (a.place ?? Infinity) - (b.place ?? Infinity));

export function saveCustomAttack(inventory: Inventory, attack: CustomAttack, creating: boolean): Partial<Inventory> {
  const attacks = inventory.customAttacks ?? [];
  // A conflict retry must not resurrect an attack another client deleted.
  if (!creating && !attacks.some((a) => a.id === attack.id)) throw new Error("This attack was deleted. Reload before editing it.");
  if (creating && attacks.length >= 100 && !attacks.some((a) => a.id === attack.id)) throw new Error("At most 100 custom attacks are allowed.");
  const saved = { ...attack, name: attack.name.trim(), edited: true };
  if (!saved.name) throw new Error("Give the attack a name.");
  return { customAttacks: attacks.some((a) => a.id === saved.id) ? attacks.map((a) => a.id === saved.id ? saved : a) : [...attacks, saved] };
}

export function removeCustomAttack(inventory: Inventory, id: string): Partial<Inventory> {
  const removedAttackIds = [...new Set([...(inventory.removedAttackIds ?? []), id])];
  if (removedAttackIds.length > 1000) throw new Error("The remembered deletion limit has been reached.");
  return { customAttacks: (inventory.customAttacks ?? []).filter((a) => a.id !== id), removedAttackIds };
}

export function moveCustomAttack(inventory: Inventory, id: string, direction: -1 | 1): Partial<Inventory> {
  const attacks = orderedCustomAttacks(inventory);
  const index = attacks.findIndex((a) => a.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= attacks.length) return {};
  const places = attacks.map((a) => a.place);
  [attacks[index], attacks[target]] = [attacks[target], attacks[index]];
  // Keep the custom rows' slots among equipment attacks. Unplaced rows retain fallback equipment visibility.
  return { customAttacks: attacks.map((a, i) => ({ ...a, place: places[i], edited: true })) };
}
