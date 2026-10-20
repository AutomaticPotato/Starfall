using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Starlights.Modules.Elements.Integration.Models;

namespace Starlights.Modules.Characters.Services.Portability;

/// <summary>
/// A Starlights character file: one character with everything it needs to be rebuilt on another Starlights server
/// (docs/character-portability.md). <see cref="Data"/> is the character's rows as the builder's snapshots capture them,
/// plus its play state; rules content (classes, spells, items) is referenced by id and listed in
/// <see cref="Dependencies"/>, never copied. No player, password, token, campaign or fight is in it.
/// </summary>
public sealed record CharacterExportFile
{
    public const string FormatName = "starlights-character";
    public const int CurrentVersion = 1;

    public string Format { get; init; } = FormatName;
    public int Version { get; init; } = CurrentVersion;
    public DateTimeOffset ExportedAt { get; init; }
    /// <summary>The exporting server's Starlights version (commit), for information only.</summary>
    public string? ExportedFrom { get; init; }
    /// <summary>The character's id on the exporting server; the importing server gives it a new one.</summary>
    public Guid SourceCharacterId { get; init; }
    public CharacterExportSummary Summary { get; init; } = new();
    /// <summary>
    /// Every rules element the character refers to, by id. Book and homebrew ids come from the content's own ids, so the
    /// same book gives the same ids everywhere; built-in elements (abilities, skills, …) carry their rules to be matched.
    /// </summary>
    public List<CharacterExportDependency> Dependencies { get; init; } = [];
    /// <summary>The rules of those elements the character's choices refer to (also derived from the content's ids).</summary>
    public List<Guid> RuleIds { get; init; } = [];
    public CharacterExportPortrait? Portrait { get; init; }
    /// <summary>Pictures in the character's story (file name → data URL); its story refers to them by file name.</summary>
    public List<CharacterExportImage> StoryImages { get; init; } = [];
    /// <summary>The exporting server's columns of each captured table, to spot fields an older or newer server lacks.</summary>
    public Dictionary<string, List<string>> Columns { get; init; } = [];
    public JsonElement Data { get; init; }
}

public sealed record CharacterExportSummary
{
    public string Name { get; init; } = string.Empty;
    public int Level { get; init; }
    public List<CharacterExportClass> Classes { get; init; } = [];
    /// <summary>"2014", "2024", "mixed" (classes from both) or "unknown" (no class yet).</summary>
    public string Edition { get; init; } = "unknown";
    public string? Species { get; init; }
    public string? Background { get; init; }
    /// <summary>The books the character's content comes from.</summary>
    public List<string> Sources { get; init; } = [];
}

public sealed record CharacterExportClass(string Name, int Level);

public sealed record CharacterExportDependency(Guid Id, string Name, string Type, string Source, bool Homebrew)
{
    /// <summary>
    /// For an element the server makes itself (abilities, skills, saving throws, the builder's own rules: their ids
    /// differ from server to server), all its rules in their fixed order with what each says, so another server can
    /// find its own copy (<see cref="CharacterPortableData.MatchBuiltIns"/>). Null for book and homebrew content, and
    /// in files from servers before this was added.
    /// </summary>
    public List<CharacterExportRule>? Rules { get; init; }
}

/// <summary>One rule of a built-in element: its id on the exporting server and what it says (its kind and settings).</summary>
public sealed record CharacterExportRule(Guid Id, string Key);

public sealed record CharacterExportImage(string Name, string Data);

public sealed record CharacterExportPortrait
{
    /// <summary>A built-in picture's address (the same on every server), kept as it is.</summary>
    public string? Url { get; init; }
    /// <summary>An uploaded picture, as a data URL (data:image/webp;base64,…).</summary>
    public string? Data { get; init; }
}

/// <summary>The pure parts of moving a character between servers: summary, ids, compatibility. No I/O.</summary>
public static partial class CharacterPortableData
{
    [GeneratedRegex(@"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")]
    private static partial Regex GuidPattern();

    /// <summary>Every id (GUID) written anywhere in the JSON: row ids, references, ids inside the JSON columns.</summary>
    public static HashSet<Guid> FindGuids(string json)
    {
        var result = new HashSet<Guid>();
        foreach (Match m in GuidPattern().Matches(json))
        {
            if (Guid.TryParse(m.Value, out var id) && id != Guid.Empty)
            {
                result.Add(id);
            }
        }
        return result;
    }

    /// <summary>
    /// New values for the ids a character file brings: every id that is not rules content (rows, references between
    /// rows, inventory items, …) gets a fresh one, the character itself the new character's id. Rules content
    /// (<paramref name="keep"/>) keeps its ids, so the character reconnects to the same books on the new server.
    /// </summary>
    public static Dictionary<Guid, Guid> NewIds(string data, IEnumerable<Guid> keep, Guid sourceCharacterId, Guid newCharacterId)
    {
        var kept = keep.ToHashSet();
        var map = new Dictionary<Guid, Guid>();
        foreach (var id in FindGuids(data))
        {
            if (!kept.Contains(id))
            {
                map[id] = id == sourceCharacterId ? newCharacterId : Guid.NewGuid();
            }
        }
        map[sourceCharacterId] = newCharacterId;
        return map;
    }

    /// <summary>
    /// An element's rules in their fixed order (include, statistic, selection) with what each one says. Two servers'
    /// copies of the same built-in element give the same list; only the ids differ.
    /// </summary>
    public static List<CharacterExportRule> RuleKeys(ElementDataModel element) =>
    [
        .. element.IncludeRules.Select(r => new CharacterExportRule(r.RuleId, $"include|{r.LevelRequirement}|{r.Requirements}")),
        .. element.StatisticRules.Select(r => new CharacterExportRule(r.RuleId, $"statistic|{r.Name}|{r.Value}|{r.StackingBonus}|{r.LevelRequirement}|{r.Requirements}")),
        .. element.SelectionRules.Select(r => new CharacterExportRule(r.RuleId, $"selection|{r.ElementType}|{r.Name}|{r.LevelRequirement}|{r.Supports}|{r.Quantity}|{r.Requirements}|{r.Optional}")),
    ];

    /// <summary>
    /// The file's ids of built-in elements this server lacks, mapped to this server's own copies: an element of the
    /// same type and name that this server also made itself (exactly one), whose rules say the same in the same order
    /// (the file's id of each rule to this server's). Anything that differs is left out, so it stays missing and the
    /// import is refused as before. Book and homebrew content is never matched by name.
    /// </summary>
    public static Dictionary<Guid, Guid> MatchBuiltIns(IEnumerable<CharacterExportDependency> missing, IEnumerable<ElementDataModel> here)
    {
        var builtIns = here.Where(e => e.BuiltIn).ToList();
        var map = new Dictionary<Guid, Guid>();
        foreach (var dependency in missing)
        {
            if (dependency.Rules is not { } fileRules)
            {
                continue;
            }
            var candidates = builtIns.Where(e => e.Type == dependency.Type && e.Name == dependency.Name).ToList();
            if (candidates.Count != 1)
            {
                continue;
            }
            var rules = RuleKeys(candidates[0]);
            if (rules.Count != fileRules.Count || rules.Zip(fileRules).Any(pair => pair.First.Key != pair.Second.Key))
            {
                continue;
            }
            map[dependency.Id] = candidates[0].Id;
            foreach (var (ours, theirs) in rules.Zip(fileRules))
            {
                map[theirs.Id] = ours.Id;
            }
        }
        return map;
    }

    /// <summary>Replaces every mapped id wherever it appears, keeping its letter case (SQL Server writes them upper case).</summary>
    public static string Remap(string json, IReadOnlyDictionary<Guid, Guid> map) =>
        GuidPattern().Replace(json, m =>
            Guid.TryParse(m.Value, out var id) && map.TryGetValue(id, out var to)
                ? (m.Value.Any(char.IsUpper) ? to.ToString("D").ToUpperInvariant() : to.ToString("D"))
                : m.Value);

    /// <summary>
    /// Points the story's picture addresses (/api/story-images/{character id without dashes}/file) at the new
    /// character; <see cref="Remap"/> does not see those ids because they are written without dashes.
    /// </summary>
    public static string RewriteStoryImages(string data, Guid sourceCharacterId, Guid newCharacterId) =>
        data.Replace($"/api/story-images/{sourceCharacterId:N}/", $"/api/story-images/{newCharacterId:N}/", StringComparison.OrdinalIgnoreCase);

    /// <summary>Why the file can't be read, or null when it is a character file this version understands.</summary>
    public static string? Validate(CharacterExportFile? file)
    {
        if (file is null || file.Format != CharacterExportFile.FormatName)
        {
            return "This is not a Starlights character file (export one with Export character).";
        }
        if (file.Version > CharacterExportFile.CurrentVersion)
        {
            return $"This file was made by a newer Starlights (character format {file.Version}; this server reads up to {CharacterExportFile.CurrentVersion}). Update this server first.";
        }
        if (file.Version < 1 || file.Data.ValueKind != JsonValueKind.Object
            || !file.Data.TryGetProperty("character", out var character) || character.ValueKind != JsonValueKind.Object
            || !character.TryGetProperty("name", out var name) || name.ValueKind != JsonValueKind.String)
        {
            return "The character file is damaged: its character data is missing.";
        }
        if (file.SourceCharacterId == Guid.Empty)
        {
            return "The character file is damaged: it does not say which character it is.";
        }
        return null;
    }

    /// <summary>A summary for the preview, from the captured rows and the dependencies' books.</summary>
    public static CharacterExportSummary Summarize(JsonElement data, IReadOnlyDictionary<Guid, CharacterExportDependency> dependencies)
    {
        var registrations = Rows(data, "registration").ToList();
        string? Registered(string type) => registrations
            .Where(r => Text(r, "associated_element_type") == type)
            .Select(r => Text(r, "associated_element_name"))
            .FirstOrDefault(n => !string.IsNullOrWhiteSpace(n));

        var classes = Rows(data, "character_class")
            .OrderByDescending(r => r.TryGetProperty("is_primary", out var p) && p.ValueKind == JsonValueKind.True)
            .Select(r => (Name: Text(r, "name") ?? "?", Level: Int(r, "level"), Registration: Text(r, "registration_id")))
            .ToList();

        var editions = new HashSet<string>();
        foreach (var c in classes)
        {
            var element = registrations.FirstOrDefault(r => SameId(Text(r, "id"), c.Registration)) is { ValueKind: JsonValueKind.Object } reg
                && Guid.TryParse(Text(reg, "associated_element_id"), out var elementId) && dependencies.TryGetValue(elementId, out var d) ? d : null;
            if (element is not null)
            {
                editions.Add(element.Source.Contains("2024", StringComparison.Ordinal) ? "2024" : "2014");
            }
        }

        return new CharacterExportSummary
        {
            Name = data.TryGetProperty("character", out var ch) ? Text(ch, "name") ?? string.Empty : string.Empty,
            Level = Rows(data, "component_progression").Select(r => Int(r, "character_level")).DefaultIfEmpty(0).Max(),
            Classes = classes.ConvertAll(c => new CharacterExportClass(c.Name, c.Level)),
            Edition = editions.Count switch { 0 => "unknown", 1 => editions.Single(), _ => "mixed" },
            Species = Registered("Race"),
            Background = Registered("Background"),
            Sources = dependencies.Values.Select(d => d.Source).Where(s => !string.IsNullOrWhiteSpace(s)).Distinct(StringComparer.OrdinalIgnoreCase)
                .Order(StringComparer.OrdinalIgnoreCase).ToList(),
        };
    }

    /// <summary>Columns the file has that this server's tables lack ("table.column"): their values can't be kept.</summary>
    public static List<string> UnknownColumns(Dictionary<string, List<string>> file, Dictionary<string, List<string>> here) =>
        [.. file.SelectMany(t => t.Value
                .Where(c => !here.TryGetValue(t.Key, out var cols) || !cols.Contains(c, StringComparer.OrdinalIgnoreCase))
                .Select(c => $"{t.Key}.{c}"))
            .Order(StringComparer.Ordinal)];

    /// <summary>Columns this server has that the file lacks ("table.column"): they start empty.</summary>
    public static List<string> AbsentColumns(Dictionary<string, List<string>> file, Dictionary<string, List<string>> here) =>
        UnknownColumns(here, file);

    /// <summary>The data with the character's name and portrait set for the new server.</summary>
    public static string WithIdentity(string data, string name, string? portraitUrl)
    {
        var node = JsonNode.Parse(data)!.AsObject();
        node["character"]!["name"] = name;
        if (node["component_appearance"] is JsonArray appearance)
        {
            foreach (var row in appearance.OfType<JsonObject>())
            {
                foreach (var key in row.Select(p => p.Key).Where(k => k.Contains("portrait", StringComparison.OrdinalIgnoreCase)).ToList())
                {
                    row[key] = portraitUrl;
                }
            }
        }
        return node.ToJsonString();
    }

    /// <summary>A name that no character of the player has yet ("Name", else "Name (imported)", "Name (imported 2)", …).</summary>
    public static string FreeName(string name, IEnumerable<string> taken)
    {
        var used = taken.ToHashSet(StringComparer.OrdinalIgnoreCase);
        var trimmed = name.Trim();
        if (trimmed.Length == 0)
        {
            trimmed = "Imported character";
        }
        if (!used.Contains(trimmed))
        {
            return Fit(trimmed, string.Empty);
        }
        for (var n = 1; ; n++)
        {
            var suffix = n == 1 ? " (imported)" : $" (imported {n})";
            var candidate = Fit(trimmed, suffix);
            if (!used.Contains(candidate))
            {
                return candidate;
            }
        }
    }

    // character names are at most 100 characters
    private static string Fit(string name, string suffix) => (name.Length + suffix.Length > 100 ? name[..(100 - suffix.Length)] : name) + suffix;

    private static IEnumerable<JsonElement> Rows(JsonElement data, string table) =>
        data.ValueKind == JsonValueKind.Object && data.TryGetProperty(table, out var rows) && rows.ValueKind == JsonValueKind.Array
            ? rows.EnumerateArray().Where(r => r.ValueKind == JsonValueKind.Object)
            : [];

    private static string? Text(JsonElement row, string column) =>
        row.ValueKind == JsonValueKind.Object && row.TryGetProperty(column, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static int Int(JsonElement row, string column) =>
        row.TryGetProperty(column, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i) ? i : 0;

    private static bool SameId(string? a, string? b) => Guid.TryParse(a, out var x) && Guid.TryParse(b, out var y) && x == y;
}
