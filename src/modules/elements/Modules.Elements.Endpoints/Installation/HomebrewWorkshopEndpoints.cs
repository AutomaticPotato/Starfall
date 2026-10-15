using System.Text.RegularExpressions;
using System.Xml.Linq;
using FastEndpoints;
using Microsoft.Extensions.Configuration;
using Starlights.Modules.Elements.Data;
using Starlights.Modules.Elements.Integration;
using Starlights.Modules.Elements.Domain.Homebrew;
using Starlights.Platform.Data;

namespace Starlights.Modules.Elements.Endpoints.Installation;

/// <summary>
/// The Homebrew page's spells, subclasses and classes, kept as Aurora elements in their own files in the homebrew
/// folder (one per kind) and imported like uploaded homebrew. Reading is open; writing needs the admin key or token
/// (every non-GET under /api/elements, see Program.cs).
/// </summary>
internal static partial class HomebrewWorkshop
{
    public const string SpellsFile = "starlights-spells.xml";
    public const string SubclassesFile = "starlights-subclasses.xml";
    public const string ClassesFile = "starlights-classes.xml";

    [GeneratedRegex(@"^[\p{L}0-9 '’()\-]{1,50}$")]
    public static partial Regex ListName();

    public static string PathOf(IConfiguration config, string file) => Path.Combine(HomebrewFiles.Folder(config), file);

    public static XDocument Load(IConfiguration config, string file) =>
        File.Exists(PathOf(config, file)) ? XDocument.Load(PathOf(config, file)) : new XDocument(new XElement("elements"));

    public static IEnumerable<XElement> Mains(XDocument document, string type) =>
        document.Root!.Elements("element").Where(e => (string?)e.Attribute("type") == type);

    /// <summary>Puts a record (its main element and features) in place of the old one, saves and imports the file's kind.</summary>
    public static async Task SaveAsync(IConfiguration config, IAuroraImporter importer, string file, XDocument document, string id, IReadOnlyList<XElement>? record, CancellationToken ct)
    {
        var old = HomebrewWorkshopXml.RecordElements(document.Root!, id).ToList();
        var anchor = old.FirstOrDefault();
        if (record is not null)
        {
            if (anchor is null)
            {
                document.Root!.Add(record);
            }
            else
            {
                anchor.AddBeforeSelf(record);
            }
        }
        foreach (var e in old)
        {
            e.Remove();
        }
        Directory.CreateDirectory(HomebrewFiles.Folder(config));
        document.Save(PathOf(config, file));
        // the file's elements go (a removed feature with them), then what is left comes back
        await importer.RemoveAsync("homebrew/" + file, ct);
        await importer.ImportAsync(AuroraImporterIndex.Homebrew, replace: false, update: true, ct);
    }

    public static bool Short(string? text, int max) => (text?.Length ?? 0) <= max;

    public static bool ValidFeatures(IEnumerable<HomebrewFeatureModel> features) =>
        features.Count() <= 40 && features.All(f => f.Level is >= 1 and <= 20 && !string.IsNullOrWhiteSpace(f.Name) && f.Name.Trim().Length <= 100 && Short(f.Description, 10_000));
}

public sealed record HomebrewSpellsResponse(List<HomebrewSpellModel> Spells);

public sealed record HomebrewSubclassesResponse(List<HomebrewSubclassModel> Subclasses);

public sealed record HomebrewClassesResponse(List<HomebrewClassModel> Classes);

public sealed record SubclassTargetsResponse(List<SubclassTarget> Targets);

// ---- spells ----

public sealed class GetHomebrewSpellsEndpoint : EndpointWithoutRequest<HomebrewSpellsResponse>
{
    public override void Configure()
    {
        Get("/homebrew/spells");
        AllowAnonymous();
        Group<ElementsGroup>();
    }

    public override async Task HandleAsync(CancellationToken ct) =>
        await Send.OkAsync(new HomebrewSpellsResponse(HomebrewWorkshop.Mains(HomebrewWorkshop.Load(Config, HomebrewWorkshop.SpellsFile), "Spell")
            .Select(HomebrewWorkshopXml.SpellFromXml).OrderBy(s => s.Level).ThenBy(s => s.Name).ToList()), ct);
}

/// <summary>Adds a homebrew spell, or changes the one with the same id, and imports it.</summary>
public sealed class SaveHomebrewSpellEndpoint : Endpoint<HomebrewSpellModel, HomebrewSpellModel>
{
    private readonly IAuroraImporter _importer;

    public SaveHomebrewSpellEndpoint(IAuroraImporter importer) => _importer = importer;

    public override void Configure()
    {
        Put("/homebrew/spells");
        AllowAnonymous();
        Group<ElementsGroup>();
    }

    public override async Task HandleAsync(HomebrewSpellModel req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Trim().Length > 100 || req.Level is < 0 or > 9 || !HomebrewWorkshopXml.Schools.Contains(req.School)
            || !HomebrewWorkshop.Short(req.Source, 100) || !HomebrewWorkshop.Short(req.CastingTime, 100) || !HomebrewWorkshop.Short(req.Range, 100)
            || !HomebrewWorkshop.Short(req.Duration, 100) || !HomebrewWorkshop.Short(req.MaterialText, 300) || !HomebrewWorkshop.Short(req.Description, 20_000)
            || !HomebrewWorkshop.Short(req.HigherLevels, 5_000) || req.Lists.Count > 20 || req.Lists.Any(l => !HomebrewWorkshop.ListName().IsMatch(l.Trim())))
        {
            AddError("A homebrew spell needs a name (100 characters at most), a level from 0 to 9, a school, and class lists made of letters.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }
        await HomebrewContent.Gate.WaitAsync(ct);
        try
        {
            var document = HomebrewWorkshop.Load(Config, HomebrewWorkshop.SpellsFile);
            var id = string.IsNullOrWhiteSpace(req.Id) ? HomebrewWorkshopXml.IdFor("SPELL", req.Name) : req.Id!;
            var xml = HomebrewWorkshopXml.SpellToXml(req, id);
            await HomebrewWorkshop.SaveAsync(Config, _importer, HomebrewWorkshop.SpellsFile, document, id, [xml], ct);
            await Send.OkAsync(HomebrewWorkshopXml.SpellFromXml(xml), ct);
        }
        finally
        {
            HomebrewContent.Gate.Release();
        }
    }
}

// ---- subclasses ----

public sealed class GetHomebrewSubclassesEndpoint : EndpointWithoutRequest<HomebrewSubclassesResponse>
{
    public override void Configure()
    {
        Get("/homebrew/subclasses");
        AllowAnonymous();
        Group<ElementsGroup>();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var document = HomebrewWorkshop.Load(Config, HomebrewWorkshop.SubclassesFile);
        await Send.OkAsync(new HomebrewSubclassesResponse(HomebrewWorkshop.Mains(document, "Archetype")
            .Select(e => HomebrewWorkshopXml.SubclassFromXml(document.Root!, e)).OrderBy(s => s.ClassName).ThenBy(s => s.Name).ToList()), ct);
    }
}

/// <summary>The classes a subclass can be made for: every class in the content with a subclass choice, and the homebrew classes.</summary>
public sealed class GetSubclassTargetsEndpoint : EndpointWithoutRequest<SubclassTargetsResponse>
{
    private readonly IPersistence _persistence;

    public GetSubclassTargetsEndpoint(IPersistence persistence) => _persistence = persistence;

    public override void Configure()
    {
        Get("/homebrew/subclass-targets");
        AllowAnonymous();
        Group<ElementsGroup>();
    }

    public override async Task HandleAsync(CancellationToken ct) => await Send.OkAsync(new SubclassTargetsResponse(await Targets(_persistence, Config)), ct);

    public static async Task<List<SubclassTarget>> Targets(IPersistence persistence, IConfiguration config)
    {
        var elements = await persistence.GetRepository<IElementsRepository>().GetAuroraElementsAsync(["Class", "Class Feature"]);
        var targets = HomebrewWorkshopXml.SubclassTargets(elements.Select(e => (e.AuroraType, e.AuroraId, e.Name, e.Source, e.RawXml)));
        var classes = HomebrewWorkshop.Load(config, HomebrewWorkshop.ClassesFile);
        foreach (var main in HomebrewWorkshop.Mains(classes, "Class"))
        {
            var model = HomebrewWorkshopXml.ClassFromXml(classes.Root!, main);
            if (model.SubclassSupports is { } supports && !targets.Any(t => t.Supports == supports))
            {
                targets.Add(new SubclassTarget(model.Name, model.Source, supports));
            }
        }
        return targets;
    }
}

/// <summary>Adds a homebrew subclass for a class's subclass choice, or changes the one with the same id, and imports it.</summary>
public sealed class SaveHomebrewSubclassEndpoint : Endpoint<HomebrewSubclassModel, HomebrewSubclassModel>
{
    private readonly IAuroraImporter _importer;
    private readonly IPersistence _persistence;

    public SaveHomebrewSubclassEndpoint(IAuroraImporter importer, IPersistence persistence)
    {
        _importer = importer;
        _persistence = persistence;
    }

    public override void Configure()
    {
        Put("/homebrew/subclasses");
        AllowAnonymous();
        Group<ElementsGroup>();
    }

    public override async Task HandleAsync(HomebrewSubclassModel req, CancellationToken ct)
    {
        var targets = await GetSubclassTargetsEndpoint.Targets(_persistence, Config);
        if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Trim().Length > 100 || !HomebrewWorkshop.Short(req.Source, 100) || !HomebrewWorkshop.Short(req.Description, 20_000)
            || !targets.Any(t => t.Supports == req.ClassSupports) || !HomebrewWorkshop.ValidFeatures(req.Features))
        {
            AddError("A homebrew subclass needs a name, a class it belongs to, and features with a level from 1 to 20 and a name.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }
        await HomebrewContent.Gate.WaitAsync(ct);
        try
        {
            var document = HomebrewWorkshop.Load(Config, HomebrewWorkshop.SubclassesFile);
            var id = string.IsNullOrWhiteSpace(req.Id) ? HomebrewWorkshopXml.IdFor("SUBCLASS", req.Name) : req.Id!;
            var record = HomebrewWorkshopXml.SubclassToXml(req, id);
            await HomebrewWorkshop.SaveAsync(Config, _importer, HomebrewWorkshop.SubclassesFile, document, id, record, ct);
            await Send.OkAsync(HomebrewWorkshopXml.SubclassFromXml(new XElement("elements", record.Select(e => new XElement(e))), record[0]), ct);
        }
        finally
        {
            HomebrewContent.Gate.Release();
        }
    }
}

// ---- classes ----

public sealed class GetHomebrewClassesEndpoint : EndpointWithoutRequest<HomebrewClassesResponse>
{
    public override void Configure()
    {
        Get("/homebrew/classes");
        AllowAnonymous();
        Group<ElementsGroup>();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var document = HomebrewWorkshop.Load(Config, HomebrewWorkshop.ClassesFile);
        await Send.OkAsync(new HomebrewClassesResponse(HomebrewWorkshop.Mains(document, "Class").Select(e => HomebrewWorkshopXml.ClassFromXml(document.Root!, e)).OrderBy(c => c.Name).ToList()), ct);
    }
}

/// <summary>Adds a homebrew class, or changes the one with the same id (its subclasses' and spells' keys stay), and imports it.</summary>
public sealed class SaveHomebrewClassEndpoint : Endpoint<HomebrewClassModel, HomebrewClassModel>
{
    private readonly IAuroraImporter _importer;

    public SaveHomebrewClassEndpoint(IAuroraImporter importer) => _importer = importer;

    public override void Configure()
    {
        Put("/homebrew/classes");
        AllowAnonymous();
        Group<ElementsGroup>();
    }

    public override async Task HandleAsync(HomebrewClassModel req, CancellationToken ct)
    {
        bool Within(IEnumerable<string> values, string[] allowed) => values.All(allowed.Contains);
        if (string.IsNullOrWhiteSpace(req.Name) || !HomebrewWorkshop.ListName().IsMatch(req.Name.Trim()) || !HomebrewWorkshop.Short(req.Source, 100)
            || !HomebrewWorkshop.Short(req.Description, 20_000) || req.HitDie is not (6 or 8 or 10 or 12)
            || !Within(req.SavingThrows, HomebrewWorkshopXml.Abilities) || req.SavingThrows.Count > 3
            || !Within(req.Armor, HomebrewWorkshopXml.ArmorKinds) || !Within(req.Weapons, HomebrewWorkshopXml.WeaponKinds)
            || !Within(req.MulticlassArmor, [.. req.Armor]) || !Within(req.MulticlassWeapons, [.. req.Weapons])
            || !Within(req.Skills, HomebrewWorkshopXml.Skills) || req.SkillChoices is < 0 or > 6
            || (req.MulticlassAbility is { Length: > 0 } ability && !HomebrewWorkshopXml.Abilities.Contains(ability))
            || req.SubclassLevel is < 1 or > 20 || req.AsiLevels.Any(l => l is < 1 or > 20) || !HomebrewWorkshopXml.CastingKinds.Contains(req.Casting)
            || (req.Casting != "None" && !HomebrewWorkshopXml.Abilities.Contains(req.CastingAbility ?? string.Empty))
            || req.SpellLists.Count > 10 || req.SpellLists.Any(l => !HomebrewWorkshop.ListName().IsMatch(l.Trim())) || req.Cantrips is < 0 or > 6
            || !HomebrewWorkshop.ValidFeatures(req.Features))
        {
            AddError("A homebrew class needs a name made of letters, a hit die (d6–d12), proficiencies from the lists, levels from 1 to 20, and a spellcasting ability when it casts.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }
        await HomebrewContent.Gate.WaitAsync(ct);
        try
        {
            var document = HomebrewWorkshop.Load(Config, HomebrewWorkshop.ClassesFile);
            var id = string.IsNullOrWhiteSpace(req.Id) ? HomebrewWorkshopXml.IdFor("CLASS", req.Name) : req.Id!;
            // a renamed class keeps the keys its subclasses and spells use
            if (HomebrewWorkshop.Mains(document, "Class").FirstOrDefault(e => (string?)e.Attribute("id") == id) is { } existing)
            {
                var before = HomebrewWorkshopXml.ClassFromXml(document.Root!, existing);
                req = req with { SubclassSupports = req.SubclassSupports ?? before.SubclassSupports, SpellListName = req.SpellListName ?? before.SpellListName };
            }
            var record = HomebrewWorkshopXml.ClassToXml(req, id);
            await HomebrewWorkshop.SaveAsync(Config, _importer, HomebrewWorkshop.ClassesFile, document, id, record, ct);
            await Send.OkAsync(HomebrewWorkshopXml.ClassFromXml(new XElement("elements", record.Select(e => new XElement(e))), record[0]), ct);
        }
        finally
        {
            HomebrewContent.Gate.Release();
        }
    }
}

// ---- removing ----

/// <summary>Removes a homebrew spell, subclass or class (with its features). Characters that used it lose it at their next update.</summary>
public sealed class DeleteHomebrewWorkshopEndpoint : EndpointWithoutRequest
{
    private readonly IAuroraImporter _importer;

    public DeleteHomebrewWorkshopEndpoint(IAuroraImporter importer) => _importer = importer;

    public override void Configure()
    {
        Delete("/homebrew/{kind}/{id}");
        AllowAnonymous();
        Group<ElementsGroup>();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var file = Route<string>("kind") switch
        {
            "spells" => HomebrewWorkshop.SpellsFile,
            "subclasses" => HomebrewWorkshop.SubclassesFile,
            "classes" => HomebrewWorkshop.ClassesFile,
            _ => null,
        };
        var id = Route<string>("id") ?? string.Empty;
        if (file is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }
        await HomebrewContent.Gate.WaitAsync(ct);
        try
        {
            var document = HomebrewWorkshop.Load(Config, file);
            if (!HomebrewWorkshopXml.RecordElements(document.Root!, id).Any())
            {
                await Send.NotFoundAsync(ct);
                return;
            }
            await HomebrewWorkshop.SaveAsync(Config, _importer, file, document, id, null, ct);
            await Send.NoContentAsync(ct);
        }
        finally
        {
            HomebrewContent.Gate.Release();
        }
    }
}
