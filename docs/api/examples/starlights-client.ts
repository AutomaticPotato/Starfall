/**
 * A small, read-only Starlights API client in TypeScript (fetch; Node 22.18+ runs it directly, or any bundler/browser).
 * Prints each character's attack list: the weapons on the attack list and the custom attacks written by hand.
 *
 *   node starlights-client.ts http://localhost:8093
 *   STARLIGHTS_PLAYER="Name" STARLIGHTS_PASSWORD=... node starlights-client.ts http://localhost:8093
 *
 * Types follow docs/api/openapi.json (generate full ones with e.g. `npx openapi-typescript docs/api/openapi.json`).
 */

interface CharacterSummary { characterId: string; name: string; level: number; playerName?: string | null }
interface InventoryItem { id: string; elementId?: string | null; baseElementId?: string | null; name?: string | null; attack?: number | null; equipped?: string | null }
interface CustomAttack { id: string; name: string; range?: string | null; toHit?: string | null; damage?: string | null; ability?: string | null; description?: string | null; place?: number | null }
interface Inventory { revision: number; items: InventoryItem[]; coins: Record<string, number>; customAttacks?: CustomAttack[] | null }
interface ItemInfo { id: string; name: string; weapon?: { damage: string; damageType: string; range?: string | null; properties?: string[] } | null }

export class Starlights {
  private tokens: string[] = [];
  private readonly baseUrl: string;
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.tokens.length) headers["X-Player-Token"] = this.tokens.join(","); // several tokens: comma separated
    const response = await fetch(this.baseUrl.replace(/\/$/, "") + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`);
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  /** a locked player's password for a token (valid 180 days, until the password changes) */
  async unlock(name: string, password: string): Promise<void> {
    const { token } = await this.request<{ name: string; token: string }>("POST", "/api/characters/players/unlock", { name, password });
    this.tokens.push(token);
  }

  characters(player?: string) {
    return this.request<{ characters: CharacterSummary[] }>("GET", `/api/characters${player ? `?player=${encodeURIComponent(player)}` : ""}`).then((r) => r.characters);
  }
  inventory(id: string) {
    return this.request<Inventory>("GET", `/api/characters/${id}/inventory`);
  }
  itemCatalog() {
    return this.request<{ version: number; items: ItemInfo[] }>("GET", "/api/elements/items").then((r) => new Map(r.items.map((i) => [i.id, i])));
  }
}

/** The sheet's attack rows in order: custom attacks with their written figures; weapons as item + dice (see README). */
export function attackList(inventory: Inventory, catalog: Map<string, ItemInfo>) {
  const weapons = inventory.items.filter((e) => e.attack).map((e) => {
    const item = catalog.get(e.baseElementId ?? e.elementId ?? "");
    return { place: e.attack!, kind: "weapon" as const, name: e.name ?? catalog.get(e.elementId ?? "")?.name ?? "?", range: item?.weapon?.range ?? "5 ft", damage: item?.weapon ? `${item.weapon.damage} ${item.weapon.damageType}` : "" };
  });
  const custom = (inventory.customAttacks ?? []).map((a) => ({ place: a.place ?? 10_000, kind: "custom" as const, name: a.name, range: a.range ?? "", toHit: a.toHit ?? "", damage: a.damage ?? "" }));
  return [...weapons, ...custom].sort((a, b) => a.place - b.place);
}

const url = process.argv[2];
if (url) {
  const api = new Starlights(url);
  const player = process.env.STARLIGHTS_PLAYER;
  if (player && process.env.STARLIGHTS_PASSWORD) await api.unlock(player, process.env.STARLIGHTS_PASSWORD);
  const catalog = await api.itemCatalog();
  for (const c of await api.characters(player)) {
    console.log(`${c.name} — level ${c.level}`);
    for (const row of attackList(await api.inventory(c.characterId), catalog)) {
      console.log(`  ${row.place}. ${row.name} [${row.kind}] ${row.range} — ${row.kind === "custom" ? `${row.toHit}, ${row.damage}` : `${row.damage} (bonus from the character)`}`);
    }
  }
}
