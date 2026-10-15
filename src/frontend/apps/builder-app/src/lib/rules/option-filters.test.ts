import { describe, expect, it } from "vitest";
import type { SpellOptionDataModel } from "@starlights/api-client";
import { castingKind, facetValues, filterOptions, SPELL_FACETS, spellDetails, spellFacets, spellHint, spellKind, toggleFacet } from "./option-filters";

const fireball: SpellOptionDataModel = { level: 3, school: "Evocation", castingTime: "1 action", range: "150 feet", duration: "Instantaneous", components: "V, S, M", lists: ["Sorcerer", "Wizard"] };
const shield: SpellOptionDataModel = { level: 1, school: "Abjuration", castingTime: "1 reaction", range: "Self", duration: "1 round" };
const detect: SpellOptionDataModel = { level: 1, school: "Divination", castingTime: "1 action", concentration: true, ritual: true };
const light: SpellOptionDataModel = { level: 0, school: "Evocation", castingTime: "1 action" };

const option = (name: string, spell: SpellOptionDataModel, disabled = false) => ({ name, hint: spellHint(spell), disabled, facets: spellFacets(spell) });
const options = [option("Fireball", fireball), option("Shield", shield), option("Detect Magic", detect), option("Light", light, true)];

describe("spell facts", () => {
  it("names the level and school", () => {
    expect(spellKind(fireball)).toBe("3rd-level evocation");
    expect(spellKind(light)).toBe("Evocation cantrip");
    expect(spellHint(detect)).toBe("1st · Divination · Concentration · Ritual");
  });

  it("sorts casting times into action, bonus action, reaction or longer", () => {
    expect(castingKind("1 action")).toBe("Action");
    expect(castingKind("1 bonus action")).toBe("Bonus action");
    expect(castingKind("1 reaction, which you take when you are hit")).toBe("Reaction");
    expect(castingKind("10 minutes")).toBe("Longer");
    expect(castingKind(null)).toBeNull();
  });

  it("lists the figures it has", () => {
    expect(spellDetails(fireball).map((d) => d.label)).toEqual(["Casting time", "Range", "Duration", "Components", "Spell lists"]);
    expect(spellDetails(fireball).at(-1)?.value).toBe("Sorcerer, Wizard");
    expect(spellDetails(shield).map((d) => d.label)).toEqual(["Casting time", "Range", "Duration"]);
  });
});

describe("filtering a list", () => {
  it("keeps options with a ticked value of every group", () => {
    expect(filterOptions(options, "", { level: ["1st"] }).map((o) => o.name)).toEqual(["Shield", "Detect Magic"]);
    expect(filterOptions(options, "", { level: ["1st", "3rd"], school: ["Evocation"] }).map((o) => o.name)).toEqual(["Fireball"]);
    expect(filterOptions(options, "", { tags: ["Ritual"] }).map((o) => o.name)).toEqual(["Detect Magic"]);
    expect(filterOptions(options, "", { level: [] })).toHaveLength(4);
  });

  it("searches names and hints, and can leave out what can't be taken yet", () => {
    expect(filterOptions(options, "abjur", {}).map((o) => o.name)).toEqual(["Shield"]);
    expect(filterOptions(options, "", {}, true).map((o) => o.name)).not.toContain("Light");
  });

  it("offers chips only for groups that tell the options apart, in their own order", () => {
    const level = SPELL_FACETS.find((f) => f.key === "level")!;
    const tags = SPELL_FACETS.find((f) => f.key === "tags")!;
    expect(facetValues(options, level)).toEqual(["Cantrip", "1st", "3rd"]);
    expect(facetValues(options, tags)).toEqual(["Concentration", "Ritual"]);
    expect(facetValues([options[0], options[1]], tags)).toEqual([]);
    expect(facetValues([options[1], options[2]], level)).toEqual([]);
    expect(facetValues([{ name: "Skill" }], level)).toEqual([]);
  });

  it("toggles a chip on and off", () => {
    const on = toggleFacet({}, "level", "1st");
    expect(on).toEqual({ level: ["1st"] });
    expect(toggleFacet(on, "level", "1st")).toEqual({ level: [] });
  });
});
