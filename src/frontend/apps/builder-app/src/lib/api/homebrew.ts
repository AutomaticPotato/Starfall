/**
 * The group's homebrew made on the Homebrew page: magic items (imported as Aurora items, so the builder treats them
 * like book items) and monsters (stat blocks for campaigns' encounters). Reading is open; saving needs the admin.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { homebrewSources, type SourceBook } from "@/lib/api/sources";
import type { HomebrewMonster } from "@/lib/rules/homebrew";

export interface HomebrewItem {
  id?: string | null;
  name: string;
  source?: string | null;
  kind: string;
  rarity: string;
  attunement: boolean;
  attunementBy?: string | null;
  charges?: number | null;
  base?: string | null;
  /** a magic weapon's own damage dice ("1d6"), instead of its base weapon's */
  damage?: string | null;
  weight?: number | null;
  cost?: number | null;
  description: string;
}

/** A feature a homebrew class or subclass gains at a level. */
export interface HomebrewFeature {
  id?: string | null;
  level: number;
  name: string;
  description: string;
}

export interface HomebrewSpell {
  id?: string | null;
  name: string;
  source?: string | null;
  /** 0 is a cantrip */
  level: number;
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  verbal: boolean;
  somatic: boolean;
  material: boolean;
  materialText?: string | null;
  concentration: boolean;
  ritual: boolean;
  /** the class spell lists it is on */
  lists: string[];
  description: string;
  higherLevels?: string | null;
}

export interface HomebrewSubclass {
  id?: string | null;
  name: string;
  source?: string | null;
  /** the class's subclass choice it joins (its supports) */
  classSupports: string;
  className: string;
  description: string;
  features: HomebrewFeature[];
}

export interface HomebrewClass {
  id?: string | null;
  name: string;
  source?: string | null;
  description: string;
  hitDie: number;
  savingThrows: string[];
  armor: string[];
  weapons: string[];
  skillChoices: number;
  skills: string[];
  multiclassArmor: string[];
  multiclassWeapons: string[];
  multiclassAbility?: string | null;
  subclassLevel: number;
  subclassSupports?: string | null;
  asiLevels: number[];
  epicBoon: boolean;
  features: HomebrewFeature[];
  /** None, Full (prepares, like the 2024 Cleric), Half (learns, like the Paladin) or Pact (like the Warlock) */
  casting: string;
  castingAbility?: string | null;
  /** existing lists it also casts from ("Wizard") */
  spellLists: string[];
  cantrips: number;
  spellListName?: string | null;
}

/** A class a homebrew subclass can join: its name, book and the supports of its subclass choice. */
export interface SubclassTarget {
  className: string;
  source?: string | null;
  supports: string;
}

export function useHomebrewSpells() {
  return useQuery({ queryKey: ["homebrew", "spells"], queryFn: async () => (await apiClient.get<{ spells: HomebrewSpell[] }>("/api/elements/homebrew/spells")).spells });
}

export function useHomebrewSubclasses() {
  return useQuery({ queryKey: ["homebrew", "subclasses"], queryFn: async () => (await apiClient.get<{ subclasses: HomebrewSubclass[] }>("/api/elements/homebrew/subclasses")).subclasses });
}

export function useHomebrewClasses() {
  return useQuery({ queryKey: ["homebrew", "classes"], queryFn: async () => (await apiClient.get<{ classes: HomebrewClass[] }>("/api/elements/homebrew/classes")).classes });
}

export function useSubclassTargets(enabled = true) {
  return useQuery({
    queryKey: ["homebrew", "subclass-targets"],
    enabled,
    queryFn: async () => (await apiClient.get<{ targets: SubclassTarget[] }>("/api/elements/homebrew/subclass-targets")).targets,
  });
}

export function useHomebrewItems() {
  return useQuery({ queryKey: ["homebrew", "items"], queryFn: async () => (await apiClient.get<{ items: HomebrewItem[] }>("/api/elements/homebrew/items")).items });
}

export function useHomebrewMonsters(enabled = true) {
  return useQuery({ queryKey: ["homebrew", "monsters"], enabled, queryFn: async () => (await apiClient.get<{ monsters: HomebrewMonster[] }>("/api/elements/homebrew/monsters")).monsters });
}

const bookNames = async () => (await apiClient.get<{ sources: SourceBook[] }>("/api/elements/sources")).sources.map((s) => s.name);

/**
 * Sources lists the books a character has switched off, so a homebrew book that did not exist before would be on for
 * every character. After a homebrew save brings in a new book, it is switched off for all of them: a player who wants
 * it ticks it in their Sources.
 */
export async function withNewBooksOff(save: () => Promise<unknown>) {
  const before = new Set(await bookNames());
  await save();
  const { sources } = await apiClient.get<{ sources: SourceBook[] }>("/api/elements/sources");
  const fresh = homebrewSources(sources).filter((name) => !before.has(name));
  if (fresh.length === 0) return;
  const { characters } = await apiClient.get<{ characters: { characterId: string }[] }>("/api/characters");
  for (const c of characters) {
    const path = `/api/characters/${c.characterId}/sources`;
    const { restricted } = await apiClient.get<{ restricted: string[] }>(path);
    const add = fresh.filter((name) => !restricted.includes(name));
    if (add.length) await apiClient.put(path, { restricted: [...restricted, ...add] });
  }
}

/** Saves a spell, subclass or class; a book it brings in starts switched off for every character. */
async function saveNew<T>(kind: string, body: T): Promise<T> {
  let saved: T | undefined;
  await withNewBooksOff(async () => (saved = await apiClient.put<T, T>(`/api/elements/homebrew/${kind}`, body)));
  return saved!;
}

export function useHomebrewActions() {
  const qc = useQueryClient();
  const refresh = () => {
    for (const key of [["homebrew"], ["compendium"], ["sources"], ["item-catalog"], ["items"], ["builder"]]) qc.invalidateQueries({ queryKey: key }).catch(() => {});
  };
  return {
    saveItem: useMutation({
      mutationFn: async (item: HomebrewItem) => {
        let saved: HomebrewItem | undefined;
        await withNewBooksOff(async () => (saved = await apiClient.put<HomebrewItem, HomebrewItem>("/api/elements/homebrew/items", item)));
        return saved!;
      },
      onSettled: refresh,
    }),
    deleteItem: useMutation({ mutationFn: (id: string) => apiClient.delete(`/api/elements/homebrew/items/${encodeURIComponent(id)}`), onSettled: refresh }),
    saveMonster: useMutation({ mutationFn: (m: HomebrewMonster) => apiClient.put<HomebrewMonster, HomebrewMonster>("/api/elements/homebrew/monsters", m), onSettled: refresh }),
    deleteMonster: useMutation({ mutationFn: (id: string) => apiClient.delete(`/api/elements/homebrew/monsters/${encodeURIComponent(id)}`), onSettled: refresh }),
    saveSpell: useMutation({ mutationFn: (spell: HomebrewSpell) => saveNew<HomebrewSpell>("spells", spell), onSettled: refresh }),
    saveSubclass: useMutation({ mutationFn: (subclass: HomebrewSubclass) => saveNew<HomebrewSubclass>("subclasses", subclass), onSettled: refresh }),
    saveClass: useMutation({ mutationFn: (cls: HomebrewClass) => saveNew<HomebrewClass>("classes", cls), onSettled: refresh }),
    deleteMade: useMutation({
      mutationFn: ({ kind, id }: { kind: "spells" | "subclasses" | "classes"; id: string }) =>
        apiClient.delete(`/api/elements/homebrew/${kind}/${encodeURIComponent(id)}`),
      onSettled: refresh,
    }),
  };
}
