using System.Xml.Linq;

namespace Starlights.Modules.Elements.Integration;

/// <summary>Validation shared by the homebrew uploader and its regression tests.</summary>
public static class HomebrewUploadXml
{
    public static string? Validate(XDocument document)
    {
        if (document.Root?.Name != "elements")
            return "Use an Aurora XML file with one <elements> root containing <element> definitions or <append id=\"…\"> patches.";

        var elements = document.Descendants("element").ToList();
        var appends = document.Descendants("append").ToList();
        if (elements.Count == 0 && appends.Count == 0)
            return "This file contains no element definitions or append patches. Add an <element> or <append> inside <elements>.";
        if (elements.Any(e => new[] { "id", "name", "type" }.Any(a => string.IsNullOrWhiteSpace((string?)e.Attribute(a)))))
            return "Each <element> needs a non-empty id, name and type.";
        if (appends.Any(a => string.IsNullOrWhiteSpace((string?)a.Attribute("id"))))
            return "Each <append> needs the non-empty id of the element it changes, for example <append id=\"ID_EXISTING_ELEMENT\">.";
        return null;
    }

    public static List<string> AppendTargets(XDocument document) => document.Descendants("append")
        .Select(a => (string?)a.Attribute("id")).OfType<string>().Where(id => !string.IsNullOrWhiteSpace(id))
        .Distinct(StringComparer.Ordinal).ToList();
}
