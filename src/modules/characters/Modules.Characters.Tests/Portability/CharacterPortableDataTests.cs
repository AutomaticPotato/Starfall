using System.Text.Json;
using System.Text.Json.Nodes;
using AwesomeAssertions;
using Starlights.Modules.Characters.Services.Portability;

namespace Starlights.Modules.Characters.Tests.Portability;

/// <summary>
/// Moving a character between servers: which ids get new values (everything but rules content), that every copy of
/// an id changes the same way, file validation, the preview summary, duplicate names and cross-version columns.
/// </summary>
[TestClass]
public class CharacterPortableDataTests
{
    private static readonly Guid SourceCharacter = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid FighterElement = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid WizardElement = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000002");
    private static readonly Guid ElfElement = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000003");
    private static readonly Guid SageElement = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000004");
    private static readonly Guid FighterRegistration = Guid.Parse("bbbbbbbb-0000-0000-0000-000000000001");
    private static readonly Guid WizardRegistration = Guid.Parse("bbbbbbbb-0000-0000-0000-000000000002");
    private static readonly Guid InventoryItem = Guid.Parse("cccccccc-0000-0000-0000-000000000001");

    // a capture as SQL Server writes it (upper-case ids; the JSON columns are strings with ids inside)
    private static string Capture() => $$"""
        {
          "character": {
            "name": "Ilyra",
            "restricted_sources": "[]",
            "inventory": "{\"Items\":[{\"Id\":\"{{InventoryItem}}\",\"ElementId\":\"{{FighterElement}}\"}],\"Revision\":3}",
            "magic": "{\"Prepared\":[\"{{WizardRegistration}}\"]}",
            "combat": "{\"Hp\":12}"
          },
          "component_progression": [ { "id": "DDDDDDDD-0000-0000-0000-000000000001", "parent_character": "{{U(SourceCharacter)}}", "character_level": 5 } ],
          "component_appearance": [ { "id": "DDDDDDDD-0000-0000-0000-000000000002", "parent_character": "{{U(SourceCharacter)}}", "portrait_url": "/api/portraits/old.webp" } ],
          "registration": [
            { "id": "{{U(FighterRegistration)}}", "character_id": "{{U(SourceCharacter)}}", "associated_element_id": "{{U(FighterElement)}}", "associated_element_name": "Fighter", "associated_element_type": "Class" },
            { "id": "{{U(WizardRegistration)}}", "character_id": "{{U(SourceCharacter)}}", "associated_element_id": "{{U(WizardElement)}}", "associated_element_name": "Wizard", "associated_element_type": "Class" },
            { "id": "BBBBBBBB-0000-0000-0000-000000000003", "character_id": "{{U(SourceCharacter)}}", "associated_element_id": "{{U(ElfElement)}}", "associated_element_name": "Elf", "associated_element_type": "Race" },
            { "id": "BBBBBBBB-0000-0000-0000-000000000004", "character_id": "{{U(SourceCharacter)}}", "associated_element_id": "{{U(SageElement)}}", "associated_element_name": "Sage", "associated_element_type": "Background" }
          ],
          "character_class": [
            { "id": "EEEEEEEE-0000-0000-0000-000000000001", "registration_id": "{{U(WizardRegistration)}}", "name": "Wizard", "is_primary": false, "level": 2 },
            { "id": "EEEEEEEE-0000-0000-0000-000000000002", "registration_id": "{{U(FighterRegistration)}}", "name": "Fighter", "is_primary": true, "level": 3 }
          ]
        }
        """;

    private static string U(Guid id) => id.ToString("D").ToUpperInvariant();

    private static Dictionary<Guid, CharacterExportDependency> Dependencies(string fighterSource = "Player's Handbook", string wizardSource = "Player's Handbook") => new()
    {
        [FighterElement] = new(FighterElement, "Fighter", "Class", fighterSource, false),
        [WizardElement] = new(WizardElement, "Wizard", "Class", wizardSource, false),
        [ElfElement] = new(ElfElement, "Elf", "Race", "Player's Handbook", false),
        [SageElement] = new(SageElement, "Sage", "Background", "Player's Handbook", false),
    };

    [TestMethod]
    public void FindGuids_FindsIdsInRowsAndInsideJsonColumns_InEitherCase()
    {
        var ids = CharacterPortableData.FindGuids(Capture());

        ids.Should().Contain([SourceCharacter, FighterElement, FighterRegistration, InventoryItem]);
        ids.Should().NotContain(Guid.Empty);
    }

    [TestMethod]
    public void NewIds_GiveEverythingButRulesContentANewId_AndTheCharacterItsNewId()
    {
        var newCharacter = Guid.NewGuid();
        var rules = new[] { FighterElement, WizardElement, ElfElement, SageElement };

        var map = CharacterPortableData.NewIds(Capture(), rules, SourceCharacter, newCharacter);

        map.Keys.Should().NotContain(rules, "rules content keeps its ids, so the character reconnects to the same books");
        map[SourceCharacter].Should().Be(newCharacter);
        map.Should().ContainKeys(FighterRegistration, WizardRegistration, InventoryItem);
        map.Values.Should().OnlyHaveUniqueItems();
        map.Where(kv => kv.Key != SourceCharacter).Should().AllSatisfy(kv => kv.Value.Should().NotBe(kv.Key));
    }

    [TestMethod]
    public void NewIds_ReplaceAnIdTheFileOnlyClaimsIsRulesContent()
    {
        // a file listing someone else's character id as a "dependency" must not keep it: only ids the server found
        // as rules elements are passed as keep, so an id it didn't find gets a new value like any other
        var someoneElse = Guid.Parse("99999999-9999-9999-9999-999999999999");
        var data = Capture().Replace(U(FighterRegistration), U(someoneElse));

        var map = CharacterPortableData.NewIds(data, [FighterElement], SourceCharacter, Guid.NewGuid());

        map.Should().ContainKey(someoneElse);
        map[someoneElse].Should().NotBe(someoneElse);
    }

    [TestMethod]
    public void Remap_ChangesEveryCopyOfAnIdTheSameWay_KeepingCase_AndLeavesRulesIdsAlone()
    {
        var data = Capture();
        var map = CharacterPortableData.NewIds(data, [FighterElement, WizardElement, ElfElement, SageElement], SourceCharacter, Guid.NewGuid());

        var remapped = CharacterPortableData.Remap(data, map);

        remapped.Should().NotContain(U(SourceCharacter)).And.NotContain(U(FighterRegistration)).And.NotContain(InventoryItem.ToString());
        remapped.Should().Contain(U(FighterElement), "rules ids are kept (rows: upper case)").And.Contain(FighterElement.ToString(), "and inside the JSON columns (lower case)");
        var newRegistration = map[FighterRegistration];
        remapped.Should().Contain($"\"id\": \"{U(newRegistration)}\"").And.Contain($"\"registration_id\": \"{U(newRegistration)}\"");
        remapped.Should().Contain(map[InventoryItem].ToString("D"), "ids inside the inventory JSON change too, in their own (lower) case");
        remapped.Should().Contain(map[WizardRegistration].ToString("D"), "the prepared spells' reference to a registration follows it");
        JsonDocument.Parse(remapped).Should().NotBeNull("the result is still valid JSON");
    }

    [TestMethod]
    [DataRow("{\"format\":\"something-else\",\"version\":1}", "not a Starlights character file")]
    [DataRow("{\"format\":\"starlights-character\",\"version\":99,\"sourceCharacterId\":\"11111111-1111-1111-1111-111111111111\",\"data\":{\"character\":{\"name\":\"A\"}}}", "newer Starlights")]
    [DataRow("{\"format\":\"starlights-character\",\"version\":1,\"sourceCharacterId\":\"11111111-1111-1111-1111-111111111111\",\"data\":{}}", "damaged")]
    [DataRow("{\"format\":\"starlights-character\",\"version\":1,\"data\":{\"character\":{\"name\":\"A\"}}}", "damaged")]
    public void Validate_RefusesFilesItCannotUse(string json, string reason)
    {
        var file = JsonSerializer.Deserialize<CharacterExportFile>(json, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        CharacterPortableData.Validate(file).Should().Contain(reason);
    }

    [TestMethod]
    public void Validate_AcceptsACurrentFile()
    {
        var file = new CharacterExportFile { SourceCharacterId = SourceCharacter, Data = JsonDocument.Parse(Capture()).RootElement };

        CharacterPortableData.Validate(file).Should().BeNull();
        CharacterPortableData.Validate(null).Should().NotBeNull();
    }

    [TestMethod]
    public void Summarize_ReadsNameLevelClassesSpeciesBackgroundAndSources()
    {
        var summary = CharacterPortableData.Summarize(JsonDocument.Parse(Capture()).RootElement, Dependencies());

        summary.Name.Should().Be("Ilyra");
        summary.Level.Should().Be(5);
        summary.Classes.Should().Equal(new CharacterExportClass("Fighter", 3), new CharacterExportClass("Wizard", 2));
        summary.Species.Should().Be("Elf");
        summary.Background.Should().Be("Sage");
        summary.Edition.Should().Be("2014");
        summary.Sources.Should().Equal("Player's Handbook");
    }

    [TestMethod]
    [DataRow("Player's Handbook 2024", "Player's Handbook 2024", "2024")]
    [DataRow("Player's Handbook", "Player's Handbook 2024", "mixed")]
    public void Summarize_TellsTheEditionFromTheClassesBooks(string fighter, string wizard, string edition)
    {
        CharacterPortableData.Summarize(JsonDocument.Parse(Capture()).RootElement, Dependencies(fighter, wizard)).Edition.Should().Be(edition);
    }

    [TestMethod]
    public void FreeName_KeepsAFreeName_AndNumbersDuplicates_IgnoringCase()
    {
        CharacterPortableData.FreeName("Ilyra", ["Brom"]).Should().Be("Ilyra");
        CharacterPortableData.FreeName("Ilyra", ["ilyra"]).Should().Be("Ilyra (imported)");
        CharacterPortableData.FreeName("Ilyra", ["Ilyra", "Ilyra (imported)"]).Should().Be("Ilyra (imported 2)");
        CharacterPortableData.FreeName("  ", []).Should().Be("Imported character");
        CharacterPortableData.FreeName(new string('x', 100), [new string('x', 100)]).Should().HaveLength(100).And.EndWith(" (imported)");
    }

    [TestMethod]
    public void WithIdentity_SetsTheNameAndPortrait_AndStoryImagesFollowTheCharacter()
    {
        var newCharacter = Guid.NewGuid();
        var data = CharacterPortableData.WithIdentity(Capture(), "Ilyra (imported)", "/api/portraits/new.webp");
        var node = JsonNode.Parse(data)!;

        node["character"]!["name"]!.GetValue<string>().Should().Be("Ilyra (imported)");
        node["component_appearance"]![0]!["portrait_url"]!.GetValue<string>().Should().Be("/api/portraits/new.webp");

        var story = $"{{\"story\":\"<img src=\\\"/api/story-images/{SourceCharacter:N}/a1b2.webp\\\">\"}}";
        CharacterPortableData.RewriteStoryImages(story, SourceCharacter, newCharacter).Should().Contain($"/api/story-images/{newCharacter:N}/a1b2.webp");
    }

    [TestMethod]
    public void Columns_ReportWhatAnotherVersionHasThatThisOneLacks_AndTheOtherWayRound()
    {
        var file = new Dictionary<string, List<string>> { ["character"] = ["name", "combat", "mood"], ["skills"] = ["id"] };
        var here = new Dictionary<string, List<string>> { ["character"] = ["name", "combat"], ["skills"] = ["id", "expertise"] };

        CharacterPortableData.UnknownColumns(file, here).Should().Equal("character.mood");
        CharacterPortableData.AbsentColumns(file, here).Should().Equal("skills.expertise");
    }

    [TestMethod]
    public void ACustomAttack_TravelsWithTheInventory_FiguresUnchanged()
    {
        var attackId = Guid.Parse("ffffffff-0000-0000-0000-000000000001");
        var inventory = new Domain.Characters.CharacterInventory
        {
            CustomAttacks = [new() { Id = attackId.ToString(), Name = "Thunder Gauntlets", ToHit = "+6 vs AC", Damage = "1d8+3 thunder", Range = "5 ft", Place = 1, Edited = true }],
            RemovedAttackIds = ["deleted-aurora-attack"],
        };
        var data = JsonSerializer.Serialize(new { character = new { name = "Ilyra", inventory = JsonSerializer.Serialize(inventory) } });
        var map = CharacterPortableData.NewIds(data, [], SourceCharacter, Guid.NewGuid());

        var remapped = JsonNode.Parse(CharacterPortableData.Remap(data, map))!["character"]!["inventory"]!.GetValue<string>();
        var restored = JsonSerializer.Deserialize<Domain.Characters.CharacterInventory>(remapped)!;
        var attack = restored.CustomAttacks!.Single();
        restored.RemovedAttackIds.Should().Equal("deleted-aurora-attack");

        attack.Should().BeEquivalentTo(inventory.CustomAttacks[0] with { Id = map[attackId].ToString("D") });
    }
}
