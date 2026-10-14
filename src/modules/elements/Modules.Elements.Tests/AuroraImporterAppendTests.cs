using AwesomeAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Starlights.Modules.Elements.Data;
using Starlights.Modules.Elements.Domain;
using Starlights.Modules.Elements.Domain.Components;
using Starlights.Modules.Elements.Services;
using Starlights.Modules.Elements.Services.FiveETools;
using Starlights.Platform.Data;

namespace Starlights.Modules.Elements.Tests;

[TestClass]
public class AuroraImporterAppendTests
{
    // the appends sort before the elements they add to, and a third file repeats them (a pull request copying a merged file)
    private const string Appends = """
        <elements>
          <append id="ID_TEST_SKILL"><supports>Artificer,ID_TEST_CLASS</supports></append>
          <append id="ID_TEST_FEATURE">
            <rules>
              <select type="Class Feature" name="Extra Plan" supports="Plan" level="9" />
              <grant type="Grants" id="ID_TEST_OTHER" />
            </rules>
          </append>
          <append id="ID_TEST_MISSING"><supports>Artificer</supports></append>
        </elements>
        """;

    private const string Elements = """
        <elements>
          <element name="Arcana" type="Proficiency" source="Test" id="ID_TEST_SKILL"><supports>Skill,Intelligence</supports></element>
          <element name="Replicate" type="Class Feature" source="Test" id="ID_TEST_FEATURE">
            <rules><select type="Class Feature" name="Plans" supports="Plan" number="4" /></rules>
          </element>
          <element name="Bag of Holding" type="Class Feature" source="Test" id="ID_TEST_PLAN">
            <supports>Plan</supports>
            <requirements>[level:artificer:6]</requirements>
            <prerequisites>Artificer Level 6+</prerequisites>
          </element>
          <element name="Other" type="Grants" source="Test" id="ID_TEST_OTHER" />
        </elements>
        """;

    private string _root = null!;

    [TestInitialize]
    public void Setup()
    {
        _root = Directory.CreateTempSubdirectory("aurora-append-tests").FullName;
        Directory.CreateDirectory(Path.Combine(_root, "content"));
        var homebrew = Directory.CreateDirectory(Path.Combine(_root, "homebrew")).FullName;
        File.WriteAllText(Path.Combine(homebrew, "a-appends.xml"), Appends);
        File.WriteAllText(Path.Combine(homebrew, "b-elements.xml"), Elements);
        File.WriteAllText(Path.Combine(homebrew, "c-repeated.xml"), Appends);
    }

    [TestCleanup]
    public void Cleanup() => Directory.Delete(_root, recursive: true);

    private async Task<Dictionary<string, Element>> ImportAsync()
    {
        var added = new List<Element>();
        var repository = new Mock<IElementsRepository>();
        repository.Setup(x => x.GetElementSummariesAsync()).ReturnsAsync([]);
        repository.Setup(x => x.Add(It.IsAny<Element>())).Callback<Element>(added.Add);
        var persistence = new Mock<IPersistence>();
        persistence.Setup(x => x.GetRepository<IElementsRepository>()).Returns(repository.Object);

        var importer = new AuroraImporter(
            NullLogger<AuroraImporter>.Instance,
            persistence.Object,
            new AuroraImporterOptions(Path.Combine(_root, "content"), HomebrewPath: Path.Combine(_root, "homebrew")),
            new FiveEToolsData(new FiveEToolsOptions(Path.Combine(_root, "no-5etools")), NullLogger<FiveEToolsData>.Instance));
        await importer.ImportAsync(AuroraImporterOptions.HomebrewIndex);

        return added.ToDictionary(e => e.GetRequiredComponent<AuroraSourceComponent>().AuroraId);
    }

    [TestMethod]
    public async Task AppendedSupports_AreMergedOnce()
    {
        var elements = await ImportAsync();

        var skill = elements["ID_TEST_SKILL"];
        skill.GetRequiredComponent<SupportsComponent>().Supports.Should().Equal("Skill", "Intelligence", "Artificer", "ID_TEST_CLASS");
        skill.GetRequiredComponent<AuroraSourceComponent>().RawXml.Should().Contain("<supports>Skill,Intelligence,Artificer,ID_TEST_CLASS</supports>");
    }

    [TestMethod]
    public async Task AppendedSelects_AreAddedOnce_AndAppendedGrantsAreLeftOut()
    {
        var elements = await ImportAsync();

        var feature = elements["ID_TEST_FEATURE"];
        feature.GetComponents<SelectionRuleComponent>().Select(s => (s.Name, s.LevelRequirement)).Should().Equal(("Plans", 0), ("Extra Plan", 9));
        feature.GetComponents<IncludeRuleComponent>().Should().BeEmpty();
    }

    [TestMethod]
    public async Task Prerequisites_AreKeptForEveryElement()
    {
        var elements = await ImportAsync();

        var plan = elements["ID_TEST_PLAN"].GetRequiredComponent<PrerequisitesComponent>();
        plan.Prerequisites.Should().Be("Artificer Level 6+");
        plan.Requirements.Should().Be("[level:artificer:6]");
        elements["ID_TEST_OTHER"].GetComponent<PrerequisitesComponent>().Should().BeNull();
    }

    [TestMethod]
    public async Task MergedXml_IsTheSameOnEveryRun()
    {
        var first = await ImportAsync();
        var second = await ImportAsync();

        second.Values.Select(e => e.GetRequiredComponent<AuroraSourceComponent>().RawXml)
            .Should().Equal(first.Values.Select(e => e.GetRequiredComponent<AuroraSourceComponent>().RawXml));
    }
}
