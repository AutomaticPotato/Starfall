using System.Text.Json;
using AwesomeAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Starlights.Modules.Elements.Services.FiveETools;

namespace Starlights.Modules.Elements.Tests;

[TestClass]
public sealed class FiveEToolsBookFormatTests
{
    [TestMethod]
    [DataRow(false)]
    [DataRow(true)]
    public void Organizations_ReadLegacyAndWrappedBooks(bool wrapped)
    {
        var folder = Path.Combine(Path.GetTempPath(), "starlights-books-" + Guid.NewGuid());
        Directory.CreateDirectory(Path.Combine(folder, "book"));
        try
        {
            var chapters = JsonSerializer.Deserialize<JsonElement>("""
                [{"name":"Factions","entries":[{"name":"Synthetic Guild","entries":["A test organization."]}]}]
                """);
            object document = wrapped
                ? new { bookData = new[] { new { id = "OTHER", data = Array.Empty<JsonElement>() }, new { id = "frhof", data = chapters.EnumerateArray().ToArray() } } }
                : new { data = chapters };
            File.WriteAllText(Path.Combine(folder, "book", "book-frhof.json"), JsonSerializer.Serialize(document));
            var lore = new FiveEToolsData(new FiveEToolsOptions(folder), NullLogger<FiveEToolsData>.Instance);

            var organizations = lore.GetOrganizations();

            organizations.Should().ContainSingle().Which.Name.Should().Be("Synthetic Guild");
        }
        finally
        {
            Directory.Delete(folder, recursive: true);
        }
    }
}
