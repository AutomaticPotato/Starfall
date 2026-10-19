import { describe, expect, it } from "vitest";
import { withProficiencies, type SheetData } from "@/lib/api/sheet";
import { detailsValues } from "@/lib/aurora-sheet";
import { proficiencyLevel, type ProficiencyRegistration } from "@/lib/rules/proficiencies";

// What the character endpoints return (skills, saving-throws, registrations, statistics), the way the sheet
// combines them; the statistics are the groups the engine adds to the bonuses ("<name>:proficiency", "<name>:misc").

const ABBREVIATION: Record<string, string> = {
  Acrobatics: "DEX", Arcana: "INT", Athletics: "STR", Insight: "WIS", Nature: "INT", Perception: "WIS", Religion: "INT", Stealth: "DEX", Survival: "WIS",
};
const slug = (name: string) => name.toLowerCase().replace(/ /g, "-");

function character(stats: Record<string, number>, modifier = 0) {
  const bonus = (name: string, abbreviation: string) => {
    const additionalBonus = (stats[`${slug(name)}:proficiency`] ?? 0) + (stats[`${slug(name)}:misc`] ?? 0);
    return { name, abilityScoreAbbreviation: abbreviation, abilityScoreModifier: modifier, additionalBonus, calculatedBonus: modifier + additionalBonus };
  };
  return {
    skills: Object.entries(ABBREVIATION).map(([name, abbreviation]) => bonus(name, abbreviation)),
    saves: ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"].map((a) => bonus(`${a} Saving Throw`, a.slice(0, 3).toUpperCase())),
    stat: (name: string) => stats[name],
  };
}

let n = 0;
function reg(name: string, type: string, parent?: ProficiencyRegistration): ProficiencyRegistration {
  n++;
  return { registrationId: `r${String(n).padStart(4, "0")}`, name, type, associatedElementId: `e-${name}`, parentRegistrationId: parent?.registrationId ?? null };
}

function marks(registrations: ProficiencyRegistration[] | undefined, stats: Record<string, number>, proficiencyBonus: number) {
  const c = character(stats);
  const marked = withProficiencies(c.skills, c.saves, registrations, c.stat, proficiencyBonus);
  const skill = (name: string) => marked.skills.find((s) => s.name === name)!;
  const save = (ability: string) => marked.saves.find((s) => s.name === `${ability} Saving Throw`)!;
  // the PDF's checkboxes, from the same model the interactive sheet shows
  const pdf = detailsValues({
    story: {}, armor: {}, abilities: [], attacks: [], attacksPerAction: 1, speeds: { walk: 30, fly: 0, climb: 0, swim: 0 }, vision: [],
    proficiencyBonus, skills: marked.skills, saves: marked.saves,
  } as unknown as SheetData);
  return { skill, save, pdf };
}

describe("proficiencyLevel", () => {
  it("takes what the character has", () => {
    expect(proficiencyLevel({}, undefined, 2)).toBe("proficient");
    expect(proficiencyLevel({ expertise: true }, undefined, 2)).toBe("expertise");
    expect(proficiencyLevel(undefined, undefined, 2)).toBe("none");
  });

  it("reads the proficiency statistic in steps of the proficiency bonus", () => {
    expect(proficiencyLevel(undefined, 3, 3)).toBe("proficient");
    expect(proficiencyLevel(undefined, 6, 3)).toBe("expertise");
    expect(proficiencyLevel({}, 6, 3)).toBe("expertise");
    expect(proficiencyLevel(undefined, 2, 3)).toBe("none");
    expect(proficiencyLevel(undefined, 4, 0)).toBe("none");
  });
});

describe("skill and saving throw proficiency on the sheet", () => {
  it("2014 Scout rogue: Survivalist's expertise comes as a statistic, the stealth expertise as an element", () => {
    const rogue = reg("Rogue", "Class");
    const survivalist = reg("Level 3: Survivalist", "Archetype Feature", reg("Scout", "Archetype", rogue));
    const expertise = reg("Level 1: Expertise", "Class Feature", rogue);
    const registrations = [
      rogue, reg("Stealth", "Proficiency", rogue), reg("Acrobatics", "Proficiency", rogue), expertise,
      reg("Skill Expertise (Stealth)", "Proficiency", expertise), survivalist, reg("Nature", "Proficiency", survivalist), reg("Survival", "Proficiency", survivalist),
    ];
    const { skill, pdf } = marks(registrations, {
      "stealth:proficiency": 6, "acrobatics:proficiency": 3, "nature:proficiency": 6, "survival:proficiency": 6, "dexterity-saving-throw:proficiency": 3,
    }, 3);

    expect(skill("Nature").proficiency).toBe("expertise");
    expect(skill("Survival").proficiency).toBe("expertise");
    expect(skill("Stealth").proficiency).toBe("expertise");
    expect(skill("Acrobatics").proficiency).toBe("proficient");
    expect(skill("Arcana").proficiency).toBe("none");
    expect(skill("Nature").calculatedBonus).toBe(6);
    expect(pdf).toMatchObject({ details_nature_proficiency: "Yes", details_nature_expertise: "Yes", details_survival_expertise: "Yes", details_acrobatics_proficiency: "Yes" });
    expect(pdf.details_acrobatics_expertise).toBeUndefined();
    expect(pdf.details_arcana_proficiency).toBeUndefined();
  });

  it("2014 Knowledge cleric: Blessings of Knowledge doubles the proficiency it grants", () => {
    const blessings = reg("Level 1: Blessings of Knowledge (Arcana)", "Archetype Feature", reg("Knowledge Domain", "Archetype", reg("Cleric", "Class")));
    const { skill, pdf } = marks([blessings, reg("Arcana", "Proficiency", blessings)], { "arcana:proficiency": 4 }, 2);
    expect(skill("Arcana").proficiency).toBe("expertise");
    expect(pdf).toMatchObject({ details_arcana_proficiency: "Yes", details_arcana_expertise: "Yes", details_arcana_total: "+4" });
  });

  it("2024 Resilient: the saving throw proficiency is only a statistic", () => {
    const fighter = reg("Fighter", "Class");
    const registrations = [fighter, reg("Saving Throw Proficiency (Strength)", "Proficiency", fighter), reg("Constitution", "Feat Feature", reg("Resilient", "Feat"))];
    const { save, pdf } = marks(registrations, { "strength-saving-throw:proficiency": 3, "constitution-saving-throw:proficiency": 3 }, 3);
    expect(save("Constitution").proficiency).toBe("proficient");
    expect(save("Strength").proficiency).toBe("proficient");
    expect(save("Dexterity").proficiency).toBe("none");
    expect(pdf).toMatchObject({ details_con_save_proficiency: "Yes", details_str_save_proficiency: "Yes", details_con_save_total: "+3" });
    expect(pdf.details_dex_save_proficiency).toBeUndefined();
  });

  it("2024 Thaumaturge: Wisdom on Arcana checks is no proficiency, though the bonus is as large", () => {
    const cleric = reg("Cleric", "Class");
    const { skill, pdf } = marks([cleric, reg("Thaumaturge", "Class Feature", cleric), reg("Religion", "Proficiency", cleric)], {
      "arcana:misc": 3, "religion:proficiency": 2, "religion:misc": 3,
    }, 2);
    expect(skill("Arcana").proficiency).toBe("none");
    expect(skill("Arcana").calculatedBonus).toBe(3);
    expect(skill("Religion").proficiency).toBe("proficient");
    expect(pdf.details_arcana_proficiency).toBeUndefined();
    expect(pdf.details_religion_expertise).toBeUndefined();
  });

  it("Jack of All Trades: half proficiency is a misc bonus and ticks nothing", () => {
    const bard = reg("Bard", "Class");
    const { skill } = marks([bard, reg("Level 2: Jack of All Trades", "Class Feature", bard)], { "athletics:misc": 1, "perception:misc": 1 }, 2);
    expect(skill("Athletics").proficiency).toBe("none");
    expect(skill("Athletics").calculatedBonus).toBe(1);
  });

  it("multiclass rogue 1 / ranger 4: proficiency bonus of the total level, expertise from the rogue", () => {
    const rogue = reg("Rogue", "Class");
    const ranger = reg("Ranger", "Class");
    const expertise = reg("Level 1: Expertise", "Class Feature", rogue);
    const registrations = [rogue, ranger, reg("Perception", "Proficiency", rogue), expertise, reg("Skill Expertise (Perception)", "Proficiency", expertise), reg("Survival", "Proficiency", ranger)];
    const { skill } = marks(registrations, { "perception:proficiency": 6, "survival:proficiency": 3 }, 3);
    expect(skill("Perception").proficiency).toBe("expertise");
    expect(skill("Survival").proficiency).toBe("proficient");
    expect(skill("Insight").proficiency).toBe("none");
  });

  it("homebrew that grants a skill as a statistic only", () => {
    const { skill, pdf } = marks([reg("Arcane Apprentice", "Feat")], { "arcana:proficiency": 2 }, 2);
    expect(skill("Arcana").proficiency).toBe("proficient");
    expect(pdf.details_arcana_proficiency).toBe("Yes");
  });

  it("before the registrations have loaded: the statistics decide, then the size of the bonus", () => {
    const { skill } = marks(undefined, { "perception:proficiency": 2, "arcana:misc": 2 }, 2);
    expect(skill("Perception").proficiency).toBe("proficient");
    // the old guess, kept for this moment only
    expect(skill("Arcana").proficiency).toBe("proficient");
    expect(skill("Stealth").proficiency).toBe("none");
  });
});
