using System.Xml.Linq;
using AwesomeAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Starlights.Modules.Elements.Services;
using Starlights.Modules.Elements.Services.FiveETools;

namespace Starlights.Modules.Elements.Tests;

/// <summary>
/// The 5etools translation over the real data, when it is available (FIVETOOLS_DATA set to a 5etools "data" folder and
/// AURORA_ELEMENTS to a clone of the Aurora Legacy elements; AURORA_PRS and STARLIGHTS_HOMEBREW add those folders).
/// Classes, feats and species Aurora has are translated too, by leaving them out of the catalog, and compared with
/// Aurora's own.
/// </summary>
[TestClass]
public class FiveEToolsContentTests
{
    private static (string Data, List<AuroraCatalogElement> Aurora) RealData()
    {
        var data = Environment.GetEnvironmentVariable("FIVETOOLS_DATA");
        var aurora = Environment.GetEnvironmentVariable("AURORA_ELEMENTS");
        if (string.IsNullOrEmpty(data) || !Directory.Exists(data) || string.IsNullOrEmpty(aurora) || !Directory.Exists(aurora))
        {
            Assert.Inconclusive("FIVETOOLS_DATA and AURORA_ELEMENTS are not set to the 5etools data and the Aurora Legacy elements");
        }

        var elements = new List<AuroraCatalogElement>();
        foreach (var (root, prefix) in new[] { (aurora!, ""), (Environment.GetEnvironmentVariable("AURORA_PRS") ?? "", "pull-requests/"), (Environment.GetEnvironmentVariable("STARLIGHTS_HOMEBREW") ?? "", "homebrew/") })
        {
            if (root.Length == 0 || !Directory.Exists(root))
            {
                continue;
            }
            foreach (var file in Directory.EnumerateFiles(root, "*.xml", SearchOption.AllDirectories).Order(StringComparer.Ordinal))
            {
                var relative = prefix + Path.GetRelativePath(root, file).Replace('\\', '/');
                if (relative.Contains(".git/", StringComparison.Ordinal) || relative.StartsWith("unearthed-arcana/", StringComparison.Ordinal))
                {
                    continue;
                }
                XDocument document;
                try
                {
                    document = XDocument.Load(file);
                }
                catch (System.Xml.XmlException)
                {
                    continue;
                }
                foreach (var element in document.Descendants("element"))
                {
                    if ((string?)element.Attribute("id") is { } id && (string?)element.Attribute("name") is { } name && (string?)element.Attribute("type") is { } type)
                    {
                        var supports = ((string?)element.Element("supports"))?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList() ?? [];
                        elements.Add(new AuroraCatalogElement(id, name, type, (string?)element.Attribute("source"), supports, element));
                    }
                }
            }
        }
        return (data!, elements);
    }

    private static XDocument Generate(string data, IEnumerable<AuroraCatalogElement> aurora, out IReadOnlyDictionary<string, int> counts)
    {
        var books = new FiveEToolsData(new FiveEToolsOptions(data), NullLogger<FiveEToolsData>.Instance);
        var content = new FiveEToolsContent(new FiveEToolsJson(data), new FiveEToolsAuroraIndex(aurora), BooksOf(data), NullLogger.Instance);
        var document = content.Generate();
        counts = content.Counts;
        return document;
    }

    private static Dictionary<string, (string Name, DateTime? Published)> BooksOf(string data)
    {
        var books = new Dictionary<string, (string, DateTime?)>(StringComparer.OrdinalIgnoreCase);
        foreach (var (file, key) in new[] { ("books.json", "book"), ("adventures.json", "adventure") })
        {
            var root = System.Text.Json.Nodes.JsonNode.Parse(File.ReadAllText(Path.Combine(data, file)));
            foreach (var book in root?[key]?.AsArray() ?? [])
            {
                books.TryAdd(book?["id"]?.ToString() ?? "", (book?["name"]?.ToString() ?? "", DateTime.TryParse(book?["published"]?.ToString(), out var p) ? p : null));
            }
        }
        return books;
    }

    [TestMethod]
    public void RealData_GeneratesValidStableContent()
    {
        var (data, aurora) = RealData();

        var first = Generate(data, aurora, out var counts);
        var second = Generate(data, aurora, out _);

        Console.WriteLine("would generate today: " + string.Join(", ", counts.Select(c => $"{c.Value} {c.Key}")));
        foreach (var group in first.Root!.Elements().GroupBy(e => (string)e.Attribute("type")!))
        {
            Console.WriteLine($"  {group.Key}: {string.Join("; ", group.Take(6).Select(e => (string)e.Attribute("name")!))}");
        }

        second.ToString().Should().Be(first.ToString(), "an update must not re-create what did not change");

        var generated = first.Root!.Elements().ToList();
        var ids = generated.Select(e => (string)e.Attribute("id")!).ToList();
        ids.Should().OnlyHaveUniqueItems();
        var auroraIds = aurora.Select(a => a.Id).ToHashSet(StringComparer.Ordinal);
        ids.Where(auroraIds.Contains).Should().BeEmpty();

        // every grant names an element that exists, and every choice has something to choose
        var all = aurora.Concat(generated.Select(e => new AuroraCatalogElement((string)e.Attribute("id")!, (string)e.Attribute("name")!, (string)e.Attribute("type")!,
            (string?)e.Attribute("source"), ((string?)e.Element("supports"))?.Split(',', StringSplitOptions.TrimEntries).ToList() ?? [], e))).ToList();
        var known = all.Select(e => e.Id).ToHashSet(StringComparer.Ordinal);
        var byType = all.GroupBy(e => e.Type).ToDictionary(g => g.Key, g => g.ToList());
        var problems = new List<string>();
        foreach (var element in generated)
        {
            foreach (var rule in element.Descendants("rules").Elements())
            {
                if (rule.Name == "grant" && !known.Contains((string)rule.Attribute("id")!))
                {
                    problems.Add($"{element.Attribute("name")}: grants unknown {rule.Attribute("id")}");
                }
                if (rule.Name == "select" && (string?)rule.Attribute("supports") is { } supports && !supports.Contains("$(", StringComparison.Ordinal)
                    && (string?)rule.Attribute("type") is not "Spell")
                {
                    var matches = SupportsExpression.Compile(supports);
                    if (!byType.GetValueOrDefault((string)rule.Attribute("type")!, []).Any(e => matches(e.Supports, e.Id)))
                    {
                        problems.Add($"{element.Attribute("name")}: no options for {rule.Attribute("name")} ({supports})");
                    }
                }
            }
        }
        problems.Should().BeEmpty();
    }

    /// <summary>Everything 5etools has, as if Aurora had none of it (only its proficiencies, languages and such): what a new book goes through.</summary>
    [TestMethod]
    public void EverythingTranslates_WhenAuroraHasNoneOfIt()
    {
        var (data, aurora) = RealData();
        string[] translated = ["Class", "Archetype", "Class Feature", "Archetype Feature", "Feat", "Feat Feature", "Background", "Background Variant", "Background Feature", "Race", "Sub Race", "Race Variant", "Racial Trait", "Spell"];
        var basics = aurora.Where(a => !translated.Contains(a.Type) || a.Id.StartsWith("ID_INTERNAL_", StringComparison.Ordinal)).ToList();

        var first = Generate(data, basics, out var counts);
        Console.WriteLine("everything: " + string.Join(", ", counts.Select(c => $"{c.Value} {c.Key}")));
        Generate(data, basics, out _).ToString().Should().Be(first.ToString());

        var problems = Problems(first, basics);
        Console.WriteLine($"{problems.Count} problems");
        foreach (var problem in problems.Take(60))
        {
            Console.WriteLine("  " + problem);
        }
        problems.Should().BeEmpty();
    }

    private static List<string> Problems(XDocument document, List<AuroraCatalogElement> aurora)
    {
        var generated = document.Root!.Elements().ToList();
        var all = aurora.Concat(generated.Select(e => new AuroraCatalogElement((string)e.Attribute("id")!, (string)e.Attribute("name")!, (string)e.Attribute("type")!,
            (string?)e.Attribute("source"), ((string?)e.Element("supports"))?.Split(',', StringSplitOptions.TrimEntries).ToList() ?? [], e))).ToList();
        var known = all.Select(e => e.Id).ToHashSet(StringComparer.Ordinal);
        var byType = all.GroupBy(e => e.Type).ToDictionary(g => g.Key, g => g.ToList());
        var problems = new List<string>();
        foreach (var element in generated)
        {
            foreach (var rule in element.Descendants("rules").Elements())
            {
                if (rule.Name == "grant" && !known.Contains((string)rule.Attribute("id")!))
                {
                    problems.Add($"{element.Attribute("name")} [{element.Attribute("source")}]: grants unknown {rule.Attribute("id")}");
                }
                if (rule.Name == "select" && (string?)rule.Attribute("supports") is { } supports && !supports.Contains("$(", StringComparison.Ordinal)
                    && (string?)rule.Attribute("type") is not "Spell")
                {
                    var matches = SupportsExpression.Compile(supports);
                    if (!byType.GetValueOrDefault((string)rule.Attribute("type")!, []).Any(e => matches(e.Supports, e.Id)))
                    {
                        problems.Add($"{element.Attribute("name")} [{element.Attribute("source")}]: no options for {rule.Attribute("name")} ({supports})");
                    }
                }
            }
        }
        return problems;
    }

    [TestMethod]
    public void A2024Class_TranslatesLikeAurorasOwn()
    {
        var (data, aurora) = RealData();
        // the Wizard and everything of it, as if Aurora did not have it yet
        var without = aurora.Where(a => !(a.Name == "Wizard" && a.Type == "Class")).ToList();

        var document = Generate(data, without, out _);
        var wizard = document.Root!.Elements().Single(e => (string)e.Attribute("type")! == "Class" && (string)e.Attribute("name")! == "Wizard"
            && ((string)e.Attribute("source")!).Contains("2024", StringComparison.Ordinal));
        var rules = wizard.Element("rules")!;

        wizard.Element("setters")!.Elements().Single(s => (string)s.Attribute("name")! == "hd").Value.Should().Be("d6");
        rules.Elements("grant").Select(g => (string)g.Attribute("id")!).Should().Contain(["ID_PROFICIENCY_SAVINGTHROW_INTELLIGENCE", "ID_PROFICIENCY_SAVINGTHROW_WISDOM", "ID_PROFICIENCY_WEAPON_PROFICIENCY_SIMPLE_WEAPONS"]);
        var skills = rules.Elements("select").Single(s => ((string)s.Attribute("name")!).StartsWith("Skill Proficiency", StringComparison.Ordinal));
        ((string)skills.Attribute("number")!).Should().Be("2");
        ((string)skills.Attribute("supports")!).Split('|').Should().HaveCount(7).And.Contain("ID_PROFICIENCY_SKILL_ARCANA");
        wizard.Element("multiclass")!.Element("requirements")!.Value.Should().Contain("[int:13]");

        // its spellcasting: Aurora's Wizard has 2 level 1 slots at level 1, 4 spells prepared, 3 cantrips
        var features = document.Root!.Elements().Where(e => ((string)e.Attribute("id")!).Contains("_WIZARD_", StringComparison.Ordinal)).ToList();
        var spellcasting = features.Single(f => f.Element("spellcasting") is not null);
        var stats = spellcasting.Element("rules")!.Elements("stat").ToList();
        stats.Single(s => (string)s.Attribute("name")! == "wizard:spellcasting:slots:1" && s.Attribute("level") is null).Attribute("value")!.Value.Should().Be("2");
        stats.Where(s => (string)s.Attribute("name")! == "wizard:spellcasting:slots:9").Should().ContainSingle(s => (string)s.Attribute("level")! == "17");
        stats.Single(s => (string)s.Attribute("name")! == "wizard:spellcasting:prepare" && s.Attribute("level") is null).Attribute("value")!.Value.Should().Be("4");
        spellcasting.Element("rules")!.Elements("select").First(s => ((string)s.Attribute("name")!).StartsWith("Cantrip", StringComparison.Ordinal)).Attribute("number")!.Value.Should().Be("3");

        // the subclass choice at level 3 offers Aurora's Wizard subclasses, and ASIs are feats
        features.SelectMany(f => f.Descendants("select")).Should().Contain(s => (string)s.Attribute("type")! == "Archetype");
        features.SelectMany(f => f.Descendants("select")).Should().Contain(s => (string)s.Attribute("type")! == "Feat" && ((string)s.Attribute("name")!).Contains("Wizard 4", StringComparison.Ordinal));
    }

    [TestMethod]
    public void AFeat_TranslatesItsPrerequisiteAndAbilityScores()
    {
        var (data, aurora) = RealData();
        var without = aurora.Where(a => !(a.Name == "Athlete" && a.Type == "Feat")).ToList();

        var document = Generate(data, without, out _);
        var athlete = document.Root!.Elements().Single(e => (string)e.Attribute("type")! == "Feat" && (string)e.Attribute("name")! == "Athlete"
            && ((string)e.Attribute("source")!).Contains("2024", StringComparison.Ordinal));

        athlete.Element("supports")!.Value.Should().Be("General");
        athlete.Element("prerequisite")!.Value.Should().Contain("Level 4+").And.Contain("Strength 13+");
        athlete.Element("requirements")!.Value.Should().Contain("[character:4]").And.Contain("[str:13]").And.Contain("[dex:13]").And.Contain("ID_WOTC_PHB24_GRANTS_FEAT_UNLOCKER");
        var asi = athlete.Element("rules")!.Elements("select").Single();
        ((string)asi.Attribute("supports")!).Should().Be("ID_INTERNAL_ABILITY_SCORE_IMPROVEMENT_FEAT_STRENGTH|ID_INTERNAL_ABILITY_SCORE_IMPROVEMENT_FEAT_DEXTERITY");
    }

    [TestMethod]
    public void AuroraFeats_DescribedInWordsOnly_GetRequirementsAsTheBooksMeanThem()
    {
        var (data, aurora) = RealData();
        var content = new FiveEToolsContent(new FiveEToolsJson(data), new FiveEToolsAuroraIndex(aurora), BooksOf(data), NullLogger.Instance);
        XElement Feat(string name, string source) => new(aurora.First(a => a.Type == "Feat" && a.Name == name && a.Source == source).Xml);
        var warCaster = Feat("War Caster", "Player’s Handbook");
        var initiate = Feat("Fighting Initiate", "Tasha’s Cauldron of Everything");

        content.FillFeatRequirements([warCaster, initiate]);

        // "the ability to cast at least one spell": any spell, a High Elf's cantrip too, not only a Spellcasting feature
        warCaster.Element("requirements")!.Value.Should().Contain("[type:spell]").And.NotContain("ID_INTERNAL_GRANTS_SPELLCASTING_FEATURE");
        // "proficiency with a martial weapon": the martial weapons, or any one of them (a rogue's rapier)
        initiate.Element("requirements")!.Value.Should().Contain("ID_PROFICIENCY_WEAPON_PROFICIENCY_MARTIAL_WEAPONS").And.Contain("ID_PROFICIENCY_WEAPON_PROFICIENCY_RAPIER");
    }

    [TestMethod]
    public void ASpecies_TranslatesSizeSpeedAndTraits()
    {
        var (data, aurora) = RealData();
        var without = aurora.Where(a => !(a.Name == "Goliath" && a.Type == "Race")).ToList();

        var document = Generate(data, without, out _);
        var goliath = document.Root!.Elements().Single(e => (string)e.Attribute("type")! == "Race" && (string)e.Attribute("name")! == "Goliath"
            && ((string)e.Attribute("source")!).Contains("2024", StringComparison.Ordinal));
        var rules = goliath.Element("rules")!;

        rules.Elements("stat").Should().Contain(s => (string)s.Attribute("name")! == "innate speed" && (string)s.Attribute("value")! == "35");
        rules.Elements("grant").Count(g => (string)g.Attribute("type")! == "Racial Trait").Should().Be(3);
    }
}
