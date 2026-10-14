/**
 * What a monster can do in a fight, read from its Compendium stat block (5etools' bestiary JSON, 2014 and 2024 books):
 * each trait, action, bonus action, reaction and legendary action with its attack bonus, damage, saving throw, recharge
 * and uses per day, its legendary actions per round, and its spells. Encounter mode runs them for the DM: rolls,
 * hit chances against the party's armor class, recharges at the start of its turn, uses spent.
 */
import { stripTags } from "@/lib/lore/tags";
import { parseRoll, type Roll } from "@/lib/rules/battle";
import type { HomebrewMonster } from "@/lib/rules/homebrew";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export type ActionSection = "trait" | "action" | "bonus" | "reaction" | "legendary" | "mythic";

export const SECTION_TITLES: Record<ActionSection, string> = {
  trait: "Traits",
  action: "Actions",
  bonus: "Bonus actions",
  reaction: "Reactions",
  legendary: "Legendary actions",
  mythic: "Mythic actions",
};

export interface MonsterDamage extends Roll {
  /** only when something holds ("if the attack roll had Advantage", "if the target is a creature") */
  condition?: string;
}

export interface MonsterAction {
  section: ActionSection;
  /** the name without its limits ("Fire Breath") */
  name: string;
  /** what it does, as plain text */
  text: string;
  attack?: { bonus: number; kind: "melee" | "ranged" | "melee or ranged"; reach?: string };
  damage: MonsterDamage[];
  /** ability "" when the book names none ("a DC 21 saving throw") */
  save?: { ability: string; dc: number; halfOnSuccess: boolean };
  /** the lowest d6 roll that brings it back (5 for "Recharge 5–6") */
  recharge?: number;
  /** uses per day ("3/Day") */
  perDay?: number;
  /** a legendary action's cost in actions ("Costs 2 Actions") */
  cost?: number;
  multiattack: boolean;
}

export interface MonsterSpells {
  /** "At will", "2/Day each", "1st level (4 slots)" */
  label: string;
  spells: string[];
  perDay?: number;
  slots?: number;
}

export interface MonsterKit {
  actions: MonsterAction[];
  /** legendary actions it can take each round (0 without them) */
  legendaryActions: number;
  spellcasting: { name: string; dc?: number; attack?: number; groups: MonsterSpells[] }[];
}

const ABILITY: Record<string, string> = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

/** Every string an entry holds, nested lists and items included, joined. */
function rawText(entries: unknown): string {
  if (typeof entries === "string") return entries;
  if (Array.isArray(entries)) return entries.map(rawText).filter(Boolean).join(" ");
  if (isObj(entries)) return [entries.name ? `${entries.name}.` : "", rawText(entries.entries ?? entries.items ?? entries.entry)].filter(Boolean).join(" ");
  return "";
}

/** "Fire Breath {@recharge 5}", "Teleport (Costs 2 Actions)", "Spit Venom (3/Day)": the name and its limits. */
export function actionLimits(rawName: string): { name: string; recharge?: number; perDay?: number; cost?: number } {
  const out: { name: string; recharge?: number; perDay?: number; cost?: number } = { name: rawName };
  const recharge = rawName.match(/\{@recharge\s*(\d)?\s*\}/i) ?? rawName.match(/\(Recharge (\d)(?:[–-]6)?\)/i);
  if (recharge) out.recharge = recharge[1] ? Number(recharge[1]) : 6;
  const perDay = rawName.match(/\((\d+)\/Day(?: each)?\)/i);
  if (perDay) out.perDay = Number(perDay[1]);
  const cost = rawName.match(/\(Costs (\d+|one|two|three) Actions?\)/i);
  if (cost) out.cost = NUMBER_WORDS[cost[1].toLowerCase()] ?? Number(cost[1]);
  out.name = stripTags(rawName.replace(/\{@recharge[^}]*\}/gi, "").replace(/\((?:Recharge [^)]*|\d+\/Day(?: each)?|Costs [^)]*)\)/gi, ""))
    .replace(/\s+/g, " ")
    .trim();
  return out;
}

/** An action's attack, damage and saving throw, from its raw (tagged) text. */
export function readAction(raw: string): Pick<MonsterAction, "attack" | "damage" | "save"> {
  const out: Pick<MonsterAction, "attack" | "damage" | "save"> = { damage: [] };
  const plain = stripTags(raw);

  const atk = raw.match(/\{@atkr?\s+([a-z,]+)\}/i);
  const hit = raw.match(/\{@hit\s+(-?\d+)\}/i);
  const reach = raw.match(/\b(reach \d+ ft\.(?: or range [\d/]+ ft\.)?|range [\d/]+ ft\.)/i)?.[1];
  if (atk && hit) {
    const kinds = atk[1].toLowerCase();
    const melee = /m/.test(kinds);
    const ranged = /r/.test(kinds.replace(/^m(?:w|s)?$/, ""));
    out.attack = { bonus: Number(hit[1]), kind: melee && ranged ? "melee or ranged" : ranged ? "ranged" : "melee", reach };
  } else {
    // written out without tags: "Melee Weapon Attack: +7 to hit"
    const written = plain.match(/\b(Melee or Ranged|Melee|Ranged) (?:Weapon |Spell )?Attack(?: Roll)?:\s*([+-−]\d+)/i);
    if (written) {
      const kind = written[1].toLowerCase() as "melee" | "ranged" | "melee or ranged";
      out.attack = { bonus: Number(written[2].replace("−", "-")), kind, reach };
    }
  }

  // the damage after a hit or a failed save: "17 ({@damage 2d10 + 6}) piercing damage plus 3 ({@damage 1d6}) fire damage"
  // "necrotic or radiant damage": a choice of types; {@dice} where a book does not tag it as damage
  const hits = [...raw.matchAll(/\{@(?:damage|dice)\s+([^}]+)\}\)?\s*((?:[A-Za-z]+(?:,\s*(?:or\s+)?|\s+or\s+))*[A-Za-z]+)?\s*damage/gi)];
  hits.forEach((m, i) => {
    const roll = parseRoll(`${m[1]} ${(m[2] ?? "").toLowerCase()}`) ?? parseRoll(m[1]);
    if (!roll) return;
    // what follows it, up to the next damage or the end of the sentence: ", plus …", " if the attack roll had Advantage"
    const after = raw.slice(m.index! + m[0].length, hits[i + 1]?.index ?? raw.length).split(/[.;]\s/)[0];
    const condition = stripTags(after).match(/\bif\b[^,.;]*/i)?.[0]?.trim();
    out.damage.push(condition ? { ...roll, condition } : roll);
  });
  // written out without tags (homebrew): "7 (1d8 + 3) piercing damage"
  if (hits.length === 0) {
    for (const m of plain.matchAll(/\((\d+d\d+(?:\s*[+−-]\s*\d+)?)\)\s*((?:[A-Za-z]+(?:,\s*(?:or\s+)?|\s+or\s+))*[A-Za-z]+)?\s*damage/gi)) {
      const roll = parseRoll(`${m[1].replace("−", "-")} ${(m[2] ?? "").toLowerCase()}`) ?? parseRoll(m[1].replace("−", "-"));
      if (roll) out.damage.push(roll);
    }
  }

  // 2024: "{@actSave dex} {@dc 17}"; 2014: "a {@dc 17} Dexterity saving throw"
  const dc = raw.match(/\{@dc\s+(\d+)\}/i);
  const ability2024 = raw.match(/\{@actSave\s+([a-z]{3})\}/i)?.[1]?.toLowerCase();
  const ability2014 = raw.match(/\{@dc\s+\d+\}\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i)?.[1];
  // written out without tags: "a DC 21 saving throw", "(save DC 14)"
  const writtenDc = dc ? null : plain.match(/\bDC (\d+)(?: (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma))? saving throw|\(save DC (\d+)\)/i);
  const tagged = ability2024 ? ABILITY[ability2024] : ability2014 ? ability2014.charAt(0).toUpperCase() + ability2014.slice(1).toLowerCase() : undefined;
  const written = writtenDc ? (writtenDc[2] ? writtenDc[2].charAt(0).toUpperCase() + writtenDc[2].slice(1).toLowerCase() : "") : undefined;
  // a tagged DC with no ability named ("a {@dc 21} saving throw", "(save {@dc 14})"), but not a DC for an ability check
  const ability = tagged ?? written ?? (dc && /saving throw|save DC/i.test(plain) ? "" : undefined);
  const dcValue = dc ? Number(dc[1]) : writtenDc ? Number(writtenDc[1] ?? writtenDc[3]) : null;
  if (dcValue !== null && ability !== undefined && !out.attack) {
    const halfOnSuccess = /\{@actSaveSuccess\}\s*Half damage|half as much damage on a successful|half damage on a success/i.test(raw);
    out.save = { ability, dc: dcValue, halfOnSuccess };
  }
  return out;
}

function spellGroups(sc: Obj): MonsterSpells[] {
  const names = (list: unknown) => (Array.isArray(list) ? list.map((s) => stripTags(String(isObj(s) ? (s.entry ?? "") : s)).trim()).filter(Boolean) : []);
  const groups: MonsterSpells[] = [];
  if (sc.will) groups.push({ label: "At will", spells: names(sc.will) });
  if (isObj(sc.daily)) {
    for (const [key, list] of Object.entries(sc.daily).sort(([a], [b]) => b.localeCompare(a))) {
      const n = Number(key.replace(/e$/, ""));
      groups.push({ label: `${n}/Day${key.endsWith("e") ? " each" : ""}`, spells: names(list), perDay: n });
    }
  }
  if (isObj(sc.spells)) {
    for (const [level, v] of Object.entries(sc.spells)) {
      if (!isObj(v)) continue;
      const slots = typeof v.slots === "number" ? v.slots : undefined;
      groups.push({ label: level === "0" ? "Cantrips" : `Level ${level}${slots ? ` (${slots} slots)` : ""}`, spells: names(v.spells), slots });
    }
  }
  return groups;
}

/** A monster's actions and spellcasting, from its bestiary entry. */
export function monsterKit(m: Obj): MonsterKit {
  const actions: MonsterAction[] = [];
  for (const section of Object.keys(SECTION_TITLES) as ActionSection[]) {
    for (const a of Array.isArray(m[section]) ? (m[section] as unknown[]) : []) {
      if (!isObj(a) || typeof a.name !== "string") continue;
      const raw = rawText(a.entries);
      const limits = actionLimits(a.name);
      actions.push({ section, ...limits, text: stripTags(raw), ...readAction(raw), multiattack: /^multiattack$/i.test(limits.name) });
    }
  }
  const spellcasting = (Array.isArray(m.spellcasting) ? (m.spellcasting as unknown[]) : []).filter(isObj).map((sc) => {
    const header = rawText(sc.headerEntries);
    const dc = header.match(/\{@dc\s+(\d+)\}/i);
    const hit = header.match(/\{@hit\s+(-?\d+)\}/i);
    return { name: stripTags(String(sc.name ?? "Spellcasting")), dc: dc ? Number(dc[1]) : undefined, attack: hit ? Number(hit[1]) : undefined, groups: spellGroups(sc) };
  });
  const legendaryActions = typeof m.legendaryActions === "number" ? m.legendaryActions : actions.some((a) => a.section === "legendary") ? 3 : 0;
  return { actions, legendaryActions, spellcasting };
}

const HOMEBREW_SECTIONS: [keyof HomebrewMonster, ActionSection][] = [
  ["traits", "trait"],
  ["actions", "action"],
  ["bonusActions", "bonus"],
  ["reactions", "reaction"],
  ["legendary", "legendary"],
];

/** A homebrew monster's actions (the Homebrew page's form: one per line, "Name. What it does."). */
export function homebrewKit(m: HomebrewMonster): MonsterKit {
  const actions: MonsterAction[] = [];
  for (const [field, section] of HOMEBREW_SECTIONS) {
    for (const line of String(m[field] ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
      const dot = line.indexOf(". ");
      const head = dot > 0 && dot < 80 ? line.slice(0, dot) : "";
      const text = head ? line.slice(dot + 2) : line;
      const limits = actionLimits(head || (section === "legendary" ? "Legendary action" : "Trait"));
      actions.push({ section, ...limits, text, ...readAction(text), multiattack: /^multiattack$/i.test(limits.name) });
    }
  }
  return { actions, legendaryActions: actions.some((a) => a.section === "legendary") ? 3 : 0, spellcasting: [] };
}

// ---- a monster's state in a fight (kept with its combatant in the DM's fight)

export interface MonsterState {
  /** uses spent today, by action name */
  used?: Record<string, number>;
  /** recharge actions spent, by name: the lowest d6 roll that brings each back */
  recharging?: Record<string, number>;
  /** legendary actions spent since its last turn */
  legendarySpent?: number;
}

/** Whether it can use an action now, and why not. */
export function canUse(action: MonsterAction, state: MonsterState, legendaryActions: number): { ok: boolean; why?: string } {
  if (action.recharge && state.recharging?.[action.name]) return { ok: false, why: `recharging (${action.recharge}–6 on a d6 at the start of its turn)` };
  if (action.perDay && (state.used?.[action.name] ?? 0) >= action.perDay) return { ok: false, why: "no uses left today" };
  if (action.section === "legendary" && (state.legendarySpent ?? 0) + (action.cost ?? 1) > legendaryActions) return { ok: false, why: "no legendary actions left this round" };
  return { ok: true };
}

/** The state after using an action: a use spent, a recharge spent, legendary actions spent. */
export function spendAction(action: MonsterAction, state: MonsterState): MonsterState {
  const next: MonsterState = { ...state };
  if (action.perDay) next.used = { ...state.used, [action.name]: (state.used?.[action.name] ?? 0) + 1 };
  if (action.recharge) next.recharging = { ...state.recharging, [action.name]: action.recharge };
  if (action.section === "legendary") next.legendarySpent = (state.legendarySpent ?? 0) + (action.cost ?? 1);
  return next;
}

/**
 * The start of its turn: its legendary actions come back, and each spent recharge action rolls a d6 to come back.
 * Returns the new state and what was rolled ("Fire Breath: 6, back").
 */
export function startTurn(state: MonsterState, random: () => number = Math.random): { state: MonsterState; rolls: string[] } {
  const rolls: string[] = [];
  const recharging: Record<string, number> = {};
  for (const [name, min] of Object.entries(state.recharging ?? {})) {
    const d6 = 1 + Math.floor(random() * 6);
    if (d6 >= min) rolls.push(`${name}: ${d6}, back`);
    else {
      rolls.push(`${name}: ${d6}, not yet`);
      recharging[name] = min;
    }
  }
  const next: MonsterState = { ...state, legendarySpent: 0, recharging: Object.keys(recharging).length ? recharging : undefined };
  return { state: next, rolls };
}
