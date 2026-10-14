import { describe, expect, it } from "vitest";
import type { BuilderChoice } from "@/lib/api/builder";
import { spellChoiceGroups, stepChoices } from "./wizard-steps";

const choice = (name: string, section: string, type: string, parentName = "", selected = false): BuilderChoice => ({
  ruleId: name,
  registrationId: name,
  section,
  depth: 1,
  name,
  type,
  parentName,
  parentType: "",
  parentElementId: "",
  level: 1,
  slot: 1,
  slots: 1,
  optional: false,
  selected: selected ? { elementId: name, name, source: null } : null,
});

const choices = [
  choice("Class", "Class", "Class"),
  choice("Skill Proficiency (Bard)", "Class", "Proficiency"),
  choice("Cantrip (Bard)", "Class", "Spell"),
  choice("Spell (Bard)", "Class", "Spell"),
  choice("Wizard Cantrip (High Elf)", "Species", "Spell"),
  choice("Feat (Background)", "Background", "Feat"),
  choice("Level 1 Spell (Magic Initiate)", "Background", "Spell"),
];
const names = (list: BuilderChoice[]) => list.map((c) => c.name);

describe("the step-by-step builder's steps", () => {
  it("asks for every spell on the Spells step, whatever gives it", () => {
    expect(names(stepChoices({ spells: true }, choices))).toEqual(["Cantrip (Bard)", "Spell (Bard)", "Wizard Cantrip (High Elf)", "Level 1 Spell (Magic Initiate)"]);
  });

  it("keeps spells off the class, species and background steps", () => {
    expect(names(stepChoices({ sections: ["Class"] }, choices))).toEqual(["Class", "Skill Proficiency (Bard)"]);
    expect(names(stepChoices({ sections: ["Species"] }, choices))).toEqual([]);
    expect(names(stepChoices({ sections: ["Background", "Alignment", "Deity"] }, choices))).toEqual(["Feat (Background)"]);
  });

  it("asks for nothing on a step without choices (ability scores, equipment)", () => {
    expect(stepChoices({}, choices)).toEqual([]);
  });
});

describe("the Magic tab's spell picks", () => {
  it("groups them by what gives them (class, species, background), counting the picks still to make", () => {
    const list = [
      choice("Level 1 Spell (Magic Initiate)", "Background", "Spell", "Wizard"),
      choice("Cantrip (Wizard)", "Class", "Spell", "Level 1: Spellcasting", true),
      choice("Spellbook (Wizard)", "Class", "Spell", "Level 1: Spellcasting"),
      choice("Skill Proficiency (Wizard)", "Class", "Proficiency", "Wizard"),
      choice("Wizard Cantrip (High Elf)", "Species", "Spell", "Intelligence"),
      choice("Spellbook (Wizard)", "Class", "Spell", "Level 1: Spellcasting"),
      choice("Spell (Additional Spell)", "Extras", "Spell", "Additional Spell"),
    ];
    expect(spellChoiceGroups(list).map((g) => [g.title, g.choices.length, g.open])).toEqual([
      ["Your class", 3, 2],
      ["Your species", 1, 1],
      ["Your background and feats", 1, 1],
      ["Your extra options", 1, 1],
    ]);
  });

  it("has none for a character without spell choices", () => {
    expect(spellChoiceGroups([choice("Class", "Class", "Class")])).toEqual([]);
  });
});
