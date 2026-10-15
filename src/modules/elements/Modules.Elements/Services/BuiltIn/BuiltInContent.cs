using System.Xml.Linq;

namespace Starlights.Modules.Elements.Services.BuiltIn;

/// <summary>
/// Starlights' own content, written as Aurora elements so the same importer handles it (deterministic ids,
/// update-safe): the generic extras the Aurora app offers but Aurora Legacy's data does not have (an additional feat,
/// language, proficiency or spell), filed like Aurora's own "Additional Feature" items so the extras flow lists them
/// with those.
/// </summary>
public static class BuiltInContent
{
    /// <summary>Folder name the built-in elements are filed under (their "file"); its import index is "starlights".</summary>
    public const string Prefix = "starlights/";

    public const string Source = "Starlights";

    private static readonly (string Id, string Name, string Type, string? Supports, string Description)[] Extras =
    [
        ("FEAT", "Additional Feat", "Feat", null, "Choose a feat you meet the prerequisites for."),
        ("LANGUAGE", "Additional Language", "Language", null, "You learn a language of your choice."),
        ("PROFICIENCY", "Additional Proficiency", "Proficiency", "Skill||Tool||Weapon||Armor", "You gain proficiency with a skill, tool, weapon or armor of your choice."),
        ("SPELL", "Additional Spell", "Spell", null, "You learn a spell of your choice (your DM decides how you can cast it)."),
        ("WIZARD_SPELL", "Additional Wizard Spell", "Spell", "Wizard", "You learn a wizard spell of your choice, for example one copied into your spellbook."),
    ];

    private static readonly string[] DamageTypes =
        ["Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder"];

    /// <summary>
    /// The damage resistances, immunities and vulnerabilities the Aurora app has built in and Aurora Legacy's content
    /// grants by id (ID_INTERNAL_CONDITION_DAMAGE_RESISTANCE_FIRE) or offers as a choice (Dragonscarred's resistance),
    /// as elements, so those grants and choices resolve. Aurora's one misspelt id ("VULNERAILITY") is among them.
    /// </summary>
    public static XDocument ConditionsDocument()
    {
        var kinds = new[] { ("RESISTANCE", "Resistance", "resistance to"), ("IMMUNITY", "Immunity", "immunity to"), ("VULNERABILITY", "Vulnerability", "vulnerability to") };
        var elements = kinds.SelectMany(k => DamageTypes.Select(d => (Id: $"ID_INTERNAL_CONDITION_DAMAGE_{k.Item1}_{d.ToUpperInvariant()}", Kind: k.Item2, Text: k.Item3, Damage: d)))
            .Append((Id: "ID_INTERNAL_CONDITION_DAMAGE_VULNERAILITY_BLUDGEONING", Kind: "Vulnerability", Text: "vulnerability to", Damage: "Bludgeoning"));
        return new(new XElement("elements",
            elements.Select(c => new XElement("element",
                new XAttribute("name", $"Damage {c.Kind} ({c.Damage})"),
                new XAttribute("type", "Condition"),
                new XAttribute("source", "Internal"),
                new XAttribute("id", c.Id),
                new XElement("supports", $"Damage {c.Kind}"),
                new XElement("description", new XElement("p", $"You have {c.Text} {c.Damage.ToLowerInvariant()} damage.")),
                new XElement("sheet", new XAttribute("display", "false"))))));
    }

    /// <summary>
    /// Corrections to upstream content, as Aurora appends: harmless once upstream fixes them. Greater Mark of
    /// Hospitality (Eberron: Forge of the Artificer) asks for "Inpsired Hospitality Ability" while its options say "Inspired".
    /// </summary>
    public static XDocument FixesDocument() =>
        new(new XElement("elements",
            new[] { "INTELLIGENCE", "WISDOM", "CHARISMA" }.Select(ability => new XElement("append",
                new XAttribute("id", $"ID_WOTC_EFOTA_FEAT_GREATER_MARK_OF_HOSPITALITY_INSPIRED_HOSPITALITY_{ability}"),
                new XElement("supports", "Inpsired Hospitality Ability")))));

    public static XDocument ExtrasDocument() =>
        new(new XElement("elements",
            Extras.Select(e => new XElement("element",
                new XAttribute("name", e.Name),
                new XAttribute("type", "Item"),
                new XAttribute("source", Source),
                new XAttribute("id", $"ID_STARLIGHTS_EXTRA_{e.Id}"),
                new XElement("description", new XElement("p", e.Description)),
                new XElement("setters",
                    new XElement("set", new XAttribute("name", "category"), "Additional Feature"),
                    new XElement("set", new XAttribute("name", "inventory-hidden"), "true")),
                new XElement("rules",
                    new XElement("select",
                        new XAttribute("type", e.Type),
                        new XAttribute("name", e.Name),
                        e.Supports is null ? null : new XAttribute("supports", e.Supports)))))));
}
