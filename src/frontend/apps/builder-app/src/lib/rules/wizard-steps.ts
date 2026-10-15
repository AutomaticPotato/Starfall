/** Which of the builder's choices each step of the step-by-step builder asks for. */
import type { BuilderChoice } from "@/lib/api/builder";

export interface StepAsks {
  /** the builder's sections the step's choices come from (their spell choices go to the Spells step) */
  sections?: string[];
  /** the step for every spell choice, whatever gives it: the class, the species, the background or a feat */
  spells?: boolean;
}

/** The choices a step asks for: spells on the Spells step only, everything else by its section. */
export function stepChoices(step: StepAsks, choices: BuilderChoice[]): BuilderChoice[] {
  return choices.filter((c) => (c.type === "Spell" ? !!step.spells : !!step.sections?.includes(c.section)));
}

export interface SpellChoiceGroup {
  /** what gives these picks: "Your class", "Your species", "Your background and feats", "Your extra options" */
  title: string;
  choices: BuilderChoice[];
  /** picks still to make */
  open: number;
}

const GROUP_TITLES: Record<string, string> = { Class: "Your class", Species: "Your species", Background: "Your background and feats", Extras: "Your extra options" };

/** The character's spell choices by what gives them (class, species, background and feats), for the Magic tab. */
export function spellChoiceGroups(choices: BuilderChoice[]): SpellChoiceGroup[] {
  const groups = new Map<string, BuilderChoice[]>();
  for (const c of stepChoices({ spells: true }, choices)) {
    groups.set(c.section, [...(groups.get(c.section) ?? []), c]);
  }
  const order = Object.keys(GROUP_TITLES);
  const rank = (section: string) => (order.includes(section) ? order.indexOf(section) : order.length);
  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([section, list]) => ({ title: GROUP_TITLES[section] ?? section, choices: list, open: list.filter((c) => !c.optional && !c.selected).length }));
}

/** A choice the character still has to make (an optional one, a god or an alignment, can stay empty). */
export const isOpen = (c: BuilderChoice) => !c.optional && !c.selected;

export type BuilderTab = "build" | "magic" | "equipment";

/** The full builder's tab a choice is made on: spells on Magic, starting equipment on Equipment, the rest on Build. */
export function tabOf(c: BuilderChoice): BuilderTab {
  return c.type === "Spell" ? "magic" : c.section === "Equipment" ? "equipment" : "build";
}

/** The choices still to make on each tab of the full builder. */
export function openByTab(choices: BuilderChoice[]): Record<BuilderTab, number> {
  const out: Record<BuilderTab, number> = { build: 0, magic: 0, equipment: 0 };
  for (const c of choices) if (isOpen(c)) out[tabOf(c)]++;
  return out;
}
