using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace Starlights.Modules.Elements.Services.FiveETools;

/// <summary>An Aurora element as the 5etools translation sees it: from Aurora Legacy, its pull requests or homebrew.</summary>
internal sealed record AuroraCatalogElement(string Id, string Name, string Type, string? Source, IReadOnlyList<string> Supports, XElement Xml);

/// <summary>
/// Lookups into the Aurora catalog for the 5etools translation: whether Aurora already has something (then 5etools'
/// copy is left alone), and the ids of what a generated element grants (proficiencies, languages, feats, spells), so it
/// uses Aurora's own elements instead of making copies of them.
/// </summary>
internal sealed partial class FiveEToolsAuroraIndex
{
    // the Aurora types that answer for each kind of 5etools entry when asking whether Aurora has it
    private static readonly Dictionary<string, string[]> Families = new()
    {
        ["class"] = ["Class"],
        ["subclass"] = ["Archetype"],
        ["feat"] = ["Feat"],
        ["background"] = ["Background", "Background Variant"],
        ["race"] = ["Race", "Sub Race", "Race Variant"],
        ["spell"] = ["Spell"],
        ["optionalfeature"] = ["Class Feature", "Archetype Feature", "Feat", "Feat Feature"],
    };

    private readonly Dictionary<string, AuroraCatalogElement> _byId;
    private readonly Dictionary<string, HashSet<string>> _namesByFamily = [];
    private readonly Dictionary<string, List<(string Source, string Words)>> _wordsByFamily = [];
    private readonly ILookup<string, AuroraCatalogElement> _byTypeAndName;

    public FiveEToolsAuroraIndex(IEnumerable<AuroraCatalogElement> elements)
    {
        var all = elements.ToList();
        _byId = all.GroupBy(e => e.Id, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);
        _byTypeAndName = all.ToLookup(e => Key(e.Type, Words(e.Name)), StringComparer.Ordinal);
        foreach (var (family, types) in Families)
        {
            _namesByFamily[family] = all.Where(e => types.Contains(e.Type)).SelectMany(e => Variants(e.Name)).ToHashSet(StringComparer.Ordinal);
            _wordsByFamily[family] = all.Where(e => types.Contains(e.Type)).SelectMany(e => Variants(e.Name).Select(v => (e.Source ?? "", v))).ToList();
        }
        Sources = all.Select(e => e.Source).OfType<string>().Distinct().ToList();
    }

    /// <summary>Every book name Aurora uses, so a 5etools book Aurora also has keeps Aurora's spelling.</summary>
    public IReadOnlyList<string> Sources { get; }

    public IEnumerable<AuroraCatalogElement> Elements => _byId.Values;

    public bool Exists(string id) => _byId.ContainsKey(id);

    public AuroraCatalogElement? Get(string id) => _byId.GetValueOrDefault(id);

    /// <summary>
    /// Whether Aurora has an entry of this kind by one of these names, from any book: a missed match leaves a
    /// duplicate for good, a false one only leaves something out until Aurora adds it.
    /// </summary>
    public bool Has(string family, params string[] names) =>
        _namesByFamily.TryGetValue(family, out var known) && names.Any(n => Variants(n).Any(known.Contains));

    /// <summary>
    /// Whether the book has an entry of this kind whose name holds this one's words, or the other way round: the same
    /// thing named a little differently ("Unbroken Air" is Aurora's "Fist of Unbroken Air").
    /// </summary>
    public bool HasSimilar(string family, string name, string book)
    {
        var words = $" {Words(name)} ";
        return words.Trim().Length > 0 && _wordsByFamily.TryGetValue(family, out var known) && known.Any(k =>
            string.Equals(k.Source, book, StringComparison.OrdinalIgnoreCase) && ($" {k.Words} ".Contains(words, StringComparison.Ordinal) || words.Contains($" {k.Words} ", StringComparison.Ordinal)));
    }

    /// <summary>The Aurora elements of a type by name; the ones of the given book (or edition) first.</summary>
    public IEnumerable<AuroraCatalogElement> Find(string type, string name, string? source = null, bool? edition2024 = null) =>
        _byTypeAndName[Key(type, Words(name))]
            .OrderByDescending(e => source is not null && string.Equals(e.Source, source, StringComparison.OrdinalIgnoreCase))
            .ThenByDescending(e => edition2024 is { } modern && IsModern(e) == modern)
            .ThenBy(e => e.Id, StringComparer.Ordinal);

    /// <summary>A 2024-rules element: Aurora names them "…(2024)" books or "PHB24"/"XPHB" ids, and the later books.</summary>
    public static bool IsModern(AuroraCatalogElement element) =>
        element.Id.Contains("PHB24", StringComparison.Ordinal) || element.Id.Contains("DMG24", StringComparison.Ordinal)
        || element.Source?.Contains("(2024)", StringComparison.Ordinal) == true;

    public string? Skill(string name) => Id($"ID_PROFICIENCY_SKILL_{Compact(name)}");

    public string? SavingThrow(string ability) => Id($"ID_PROFICIENCY_SAVINGTHROW_{FiveEToolsText.AbilityName(ability).ToUpperInvariant()}");

    public string? Armor(string kind) => Compact(kind) switch
    {
        "LIGHT" => Id("ID_PROFICIENCY_ARMOR_PROFICIENCY_LIGHT_ARMOR"),
        "MEDIUM" => Id("ID_PROFICIENCY_ARMOR_PROFICIENCY_MEDIUM_ARMOR"),
        "HEAVY" => Id("ID_PROFICIENCY_ARMOR_PROFICIENCY_HEAVY_ARMOR"),
        "SHIELD" or "SHIELDS" => Id("ID_PROFICIENCY_ARMOR_PROFICIENCY_SHIELDS") ?? Id("ID_PROFICIENCY_ARMOR_PROFICIENCY_SHIELD"),
        _ => Proficiency("Armor Proficiency", kind),
    };

    public string? Weapon(string kind) => Compact(kind) switch
    {
        "SIMPLE" => Id("ID_PROFICIENCY_WEAPON_PROFICIENCY_SIMPLE_WEAPONS"),
        "MARTIAL" => Id("ID_PROFICIENCY_WEAPON_PROFICIENCY_MARTIAL_WEAPONS"),
        _ => Proficiency("Weapon Proficiency", kind.TrimEnd('s')) ?? Proficiency("Weapon Proficiency", kind),
    };

    /// <summary>
    /// Proficiency with a weapon of a category, as "a martial weapon" reads: the category's own proficiency or that of
    /// any one weapon of it (a rogue's rapier). Any other kind is the one weapon's proficiency.
    /// </summary>
    public IReadOnlyList<string> AnyWeaponOf(string kind)
    {
        var category = Compact(kind) switch { "SIMPLE" => "Simple", "MARTIAL" => "Martial", _ => null };
        var own = Weapon(kind);
        if (category is null)
        {
            return own is null ? [] : [own];
        }
        var single = _byId.Values
            .Where(e => e.Type == "Proficiency" && e.Id.StartsWith("ID_PROFICIENCY_WEAPON_PROFICIENCY_", StringComparison.Ordinal)
                && e.Supports.Contains("Weapon") && e.Supports.Contains(category))
            .Select(e => e.Id)
            .Order(StringComparer.Ordinal);
        return (own is null ? single : single.Prepend(own)).Distinct().ToList();
    }

    public string? Tool(string name) => Proficiency("Tool Proficiency", name);

    public string? Language(string name, bool edition2024) =>
        Find("Language", name, edition2024: edition2024).FirstOrDefault()?.Id;

    // "Tool Proficiency (Thieves’ Tools)", "Weapon Proficiency (Longsword)"
    private string? Proficiency(string prefix, string name) =>
        Find("Proficiency", $"{prefix} ({name})").FirstOrDefault()?.Id;

    private string? Id(string id) => _byId.ContainsKey(id) ? id : null;

    // "Sleight of Hand" → SLEIGHTOFHAND, the way Aurora writes its skill ids
    private static string Compact(string text) => NonAlphanumeric().Replace(text.Replace("'", "").ToUpperInvariant(), "");

    private static string Key(string type, string words) => $"{type}\u0001{words}";

    /// <summary>A name reduced to its words: lower case, no punctuation, no "the", "of", "a" or "an".</summary>
    public static string Words(string name)
    {
        var text = NonWord().Replace(name.Replace('’', '\'').Replace("'", "").ToLowerInvariant(), " ");
        return string.Join(' ', text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Where(w => w is not ("the" or "of" or "a" or "an")));
    }

    // "Dwarf (Hill)", "Hill Dwarf" and "Hill" all name the same thing
    private static IEnumerable<string> Variants(string name)
    {
        var variants = new HashSet<string>(StringComparer.Ordinal) { Words(name) };
        if (Parenthesized().Match(name) is { Success: true } match)
        {
            variants.Add(Words(match.Groups[1].Value));
            variants.Add(Words(match.Groups[2].Value));
            variants.Add(Words($"{match.Groups[2].Value} {match.Groups[1].Value}"));
        }
        variants.Remove(string.Empty);
        return variants;
    }

    [GeneratedRegex("[^A-Z0-9]")]
    private static partial Regex NonAlphanumeric();

    [GeneratedRegex("[^a-z0-9]+")]
    private static partial Regex NonWord();

    [GeneratedRegex(@"^(.*?)\s*\((.*)\)\s*$")]
    private static partial Regex Parenthesized();
}
