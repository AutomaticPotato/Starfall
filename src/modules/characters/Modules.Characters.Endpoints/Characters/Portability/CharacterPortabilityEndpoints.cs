using System.Text.Json;
using FastEndpoints;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Starlights.Modules.Characters.Data;
using Starlights.Modules.Characters.Domain;
using Starlights.Modules.Characters.Domain.Appearances;
using Starlights.Modules.Characters.Domain.Characters;
using Starlights.Modules.Characters.Domain.Services;
using Starlights.Modules.Characters.Endpoints.Characters.Portraits;
using Starlights.Modules.Characters.Services.Players;
using Starlights.Modules.Characters.Services.Portability;
using Starlights.Modules.Characters.Services.Processing;
using Starlights.Modules.Elements.Integration;
using Starlights.Modules.Elements.Integration.Models;
using Starlights.Platform.Data;

namespace Starlights.Modules.Characters.Endpoints.Characters.Portability;

/// <summary>What importing a character file would do, shown before anything is changed.</summary>
public sealed record CharacterImportPreview
{
    /// <summary>Whether it can be imported as it is (a readable file, every rules element present here).</summary>
    public bool CanImport { get; init; }
    /// <summary>Why the file can't be read at all.</summary>
    public string? Error { get; init; }
    public int FormatVersion { get; init; }
    public DateTimeOffset ExportedAt { get; init; }
    public string? ExportedFrom { get; init; }
    public CharacterExportSummary Summary { get; init; } = new();
    /// <summary>The picture to show (a data URL or a built-in picture's address).</summary>
    public string? Portrait { get; init; }
    /// <summary>The name it gets here (another of the player's characters may have the same name).</summary>
    public string Name { get; init; } = string.Empty;
    public bool Renamed { get; init; }
    /// <summary>Rules content the character uses that this server doesn't have: install those books or homebrew first.</summary>
    public List<CharacterExportDependency> Missing { get; init; } = [];
    /// <summary>The homebrew the character uses (whether this server has it or not).</summary>
    public List<CharacterImportHomebrew> Homebrew { get; init; } = [];
    public List<string> Warnings { get; init; } = [];
}

public sealed record CharacterImportHomebrew(string Name, string Type, string Source, bool Installed);

public sealed record CharacterImportPreviewRequest
{
    public CharacterExportFile? File { get; init; }
    /// <summary>The player the character would belong to here (empty: no player).</summary>
    public string? PlayerName { get; init; }
}

public sealed record CharacterImportRequest
{
    public CharacterExportFile? File { get; init; }
    public string? PlayerName { get; init; }
    /// <summary>Must be true: the player saw the preview and wants the character created.</summary>
    public bool Confirm { get; init; }
}

public sealed record CharacterImportResponse(Guid CharacterId, string Name, List<string> Warnings);

/// <summary>The work behind export, preview and import (shared by the three endpoints).</summary>
internal static class CharacterPortability
{
    // how long an import waits for the new character's start-up work before putting the imported rows in
    private static readonly TimeSpan ProcessingWait = TimeSpan.FromSeconds(60);

    public static async Task<CharacterExportFile?> ExportAsync(IPersistence persistence, IElementsModuleQueries elements, IConfiguration config, Guid characterId)
    {
        var character = await persistence.GetRepository<ICharactersRepository>().GetCharacterAsync(characterId);
        if (character is null)
        {
            return null;
        }
        var snapshots = persistence.GetRepository<ICharacterSnapshotsRepository>();
        await WaitForProcessingAsync(snapshots, characterId, TimeSpan.FromSeconds(15));

        var current = await snapshots.CapturePortableAsync(characterId);
        // an unsaved build is not the character yet: export it as it was saved (the builder's snapshot), with its
        // play state as it is now
        var data = current;
        if (await snapshots.GetAsync(characterId) is { } open)
        {
            using var now = JsonDocument.Parse(current);
            var saved = System.Text.Json.Nodes.JsonNode.Parse(open.Data)!.AsObject();
            if (now.RootElement.TryGetProperty("character", out var c) && c.TryGetProperty("combat", out var combat))
            {
                saved["character"]!["combat"] = System.Text.Json.Nodes.JsonNode.Parse(combat.GetRawText());
            }
            data = saved.ToJsonString();
        }

        // the rules elements it refers to (rules content keeps its ids from server to server)
        var referenced = CharacterPortableData.FindGuids(data);
        var groups = await elements.GetSourceGroups();
        var found = await elements.GetElementsWithRules(referenced);
        var ruleIds = RuleIds(found).Where(referenced.Contains).Distinct().Order().ToList();
        var dependencies = found
            .Select(e => new CharacterExportDependency(e.Id, e.Name, e.Type, e.Source,
                groups.TryGetValue(e.Source ?? string.Empty, out var g) && g == "homebrew")
            {
                // built-in elements have ids of this server's own: their rules let another server find its copy
                Rules = e.BuiltIn ? CharacterPortableData.RuleKeys(e) : null,
            })
            .DistinctBy(d => d.Id)
            .OrderBy(d => d.Type, StringComparer.Ordinal).ThenBy(d => d.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        using var document = JsonDocument.Parse(data);
        var root = document.RootElement.Clone();
        return new CharacterExportFile
        {
            ExportedAt = DateTimeOffset.UtcNow,
            ExportedFrom = config["STARLIGHTS_COMMIT"],
            SourceCharacterId = characterId,
            Summary = CharacterPortableData.Summarize(root, dependencies.ToDictionary(d => d.Id)),
            Dependencies = dependencies,
            RuleIds = ruleIds,
            Portrait = await PortraitAsync(config, character.GetRequiredComponent<AppearanceComponent>().PortraitUrl),
            StoryImages = await StoryImagesAsync(config, characterId),
            Columns = await snapshots.GetCaptureColumnsAsync(),
            Data = root,
        };
    }

    public static async Task<CharacterImportPreview> PreviewAsync(IPersistence persistence, IElementsModuleQueries elements, CharacterExportFile? file, string? playerName)
    {
        if (CharacterPortableData.Validate(file) is { } error)
        {
            return new CharacterImportPreview { Error = error, FormatVersion = file?.Version ?? 0 };
        }

        var here = await elements.GetElementsWithRules(file!.Dependencies.Select(d => d.Id).ToList());
        var builtIns = await MatchBuiltInsAsync(elements, file, here);
        var found = here.Select(e => e.Id).Concat(builtIns.Keys).ToHashSet();
        var missingRules = file.RuleIds.Except(RuleIds(here)).Except(builtIns.Keys).Count();
        var groups = await elements.GetSourceGroups();
        bool HomebrewHere(string source) => groups.TryGetValue(source, out var g) && g == "homebrew";
        var missing = file.Dependencies.Where(d => !found.Contains(d.Id)).ToList();
        var homebrew = file.Dependencies.Where(d => d.Homebrew || HomebrewHere(d.Source))
            .Select(d => new CharacterImportHomebrew(d.Name, d.Type, d.Source, found.Contains(d.Id))).ToList();

        var warnings = new List<string>();
        if (missing.Any(d => d.Rules is null && d.Source == "Internal"))
        {
            warnings.Add("The file comes from a Starlights server that did not yet record its built-in rules (abilities, skills, saving throws), so this server can't match them. Export the character again from an updated server.");
        }
        if (missingRules > 0 && missing.Count == 0)
        {
            warnings.Add($"This server's books are a different version from the exporting server's: {missingRules} of the rules the character's choices use are not here. Bring both servers' content up to date (Content page) and try again.");
        }
        var columnsHere = await persistence.GetRepository<ICharacterSnapshotsRepository>().GetCaptureColumnsAsync();
        var unknown = CharacterPortableData.UnknownColumns(file.Columns, columnsHere);
        if (unknown.Count > 0)
        {
            warnings.Add($"The file comes from a different Starlights version: these details have no place on this server and will not be kept: {string.Join(", ", unknown)}.");
        }
        var absent = CharacterPortableData.AbsentColumns(file.Columns, columnsHere);
        if (absent.Count > 0)
        {
            warnings.Add($"The file comes from an older Starlights: these details start empty: {string.Join(", ", absent)}.");
        }
        if (file.Portrait?.Url?.StartsWith(PortraitFiles.UrlPrefix, StringComparison.Ordinal) == true && file.Portrait.Data is null)
        {
            warnings.Add("The portrait was an uploaded picture that is not in the file; the character gets no portrait.");
        }

        var name = file.Data.GetProperty("character").GetProperty("name").GetString() ?? string.Empty;
        var player = playerName?.Trim() ?? string.Empty;
        var taken = (await persistence.GetRepository<ICharactersRepository>().GetCharactersAsync())
            .Where(c => string.Equals(c.PlayerName ?? string.Empty, player, StringComparison.OrdinalIgnoreCase))
            .Select(c => c.Name);
        var finalName = CharacterPortableData.FreeName(name, taken);

        return new CharacterImportPreview
        {
            CanImport = missing.Count == 0 && missingRules == 0,
            FormatVersion = file.Version,
            ExportedAt = file.ExportedAt,
            ExportedFrom = file.ExportedFrom,
            Summary = CharacterPortableData.Summarize(file.Data, file.Dependencies.DistinctBy(d => d.Id).ToDictionary(d => d.Id)),
            Portrait = file.Portrait?.Data ?? (file.Portrait?.Url?.StartsWith(PortraitFiles.UrlPrefix, StringComparison.Ordinal) == true ? null : file.Portrait?.Url),
            Name = finalName,
            Renamed = !string.Equals(finalName, name.Trim(), StringComparison.Ordinal),
            Missing = missing,
            Homebrew = homebrew,
            Warnings = warnings,
        };
    }

    public static async Task<(CharacterImportResponse? Result, string? Problem)> ImportAsync(
        IPersistence persistence, IElementsModuleQueries elements, ICharacterCreationService creation, IServiceScopeFactory scopes,
        ILogger logger, IConfiguration config, CharacterExportFile file, string? playerName, CancellationToken ct)
    {
        var preview = await PreviewAsync(persistence, elements, file, playerName);
        if (preview.Error is not null)
        {
            return (null, preview.Error);
        }
        if (!preview.CanImport && preview.Missing.Count == 0)
        {
            return (null, preview.Warnings.FirstOrDefault() ?? "The character can't be imported on this server.");
        }
        if (!preview.CanImport)
        {
            return (null, $"This server lacks rules content the character uses ({string.Join(", ", preview.Missing.Take(10).Select(m => $"{m.Type} {m.Name} from {m.Source}"))}{(preview.Missing.Count > 10 ? ", …" : string.Empty)}). Install those books or homebrew first; nothing was imported.");
        }

        // a new character of the importing player (never the file's player), with no campaign
        var characters = persistence.GetRepository<ICharactersRepository>();
        var snapshots = persistence.GetRepository<ICharacterSnapshotsRepository>();
        var character = creation.Create(preview.Name);
        if (!string.IsNullOrWhiteSpace(playerName))
        {
            character.AssignPlayer(playerName.Trim());
        }
        characters.Add(character);
        await persistence.SaveChangesAsync();
        var newId = character.Id.Value;

        string? portraitUrl = null;
        var warnings = new List<string>(preview.Warnings);
        try
        {
            // its start-up work first, so nothing is added to the imported rows afterwards
            if (!await WaitForProcessingAsync(snapshots, newId, ProcessingWait))
            {
                throw new InvalidOperationException("The server is still busy setting up the new character; try again in a minute.");
            }

            if (file.Portrait?.Data is { } picture)
            {
                var (url, error) = await PortraitFiles.SaveAsync(config, picture, ct);
                portraitUrl = url;
                if (url is null)
                {
                    warnings.Add($"The portrait could not be used ({error}); the character has no portrait.");
                }
            }
            else if (file.Portrait?.Url is { } builtIn && !builtIn.StartsWith(PortraitFiles.UrlPrefix, StringComparison.Ordinal))
            {
                portraitUrl = builtIn;
            }

            // kept: rules content this server has (elements and their rules), nothing else
            var content = await elements.GetElementsWithRules(file.Dependencies.Select(d => d.Id).ToList());
            var builtIns = await MatchBuiltInsAsync(elements, file, content);
            var keep = content.Select(e => e.Id).Concat(RuleIds(content)).Concat(builtIns.Keys);
            var data = file.Data.GetRawText();
            var ids = CharacterPortableData.NewIds(data, keep, file.SourceCharacterId, newId);
            foreach (var (theirs, ours) in builtIns)
            {
                ids[theirs] = ours;
            }
            data = CharacterPortableData.Remap(data, ids);
            data = CharacterPortableData.RewriteStoryImages(data, file.SourceCharacterId, newId);
            data = CharacterPortableData.WithIdentity(data, preview.Name, portraitUrl);
            await snapshots.RestorePortableAsync(newId, data);
            SaveStoryImages(config, newId, file.StoryImages, warnings);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "importing character file {Source} as {Character} failed", file.SourceCharacterId, newId);
            await RemoveAsync(snapshots, config, newId, portraitUrl);
            return (null, ex is InvalidOperationException ? ex.Message : "The character could not be imported; nothing was kept. The server's log has the details.");
        }

        // worked out again with this server's rules content, as after a content update (keeps every pick); if that
        // fails the imported character doesn't fit this server's rules, so it isn't kept
        try
        {
            // in a scope of its own: this request's context still holds the rows the new character started with
            using var scope = scopes.CreateScope();
            var processor = scope.ServiceProvider.GetRequiredService<IRegistrationProcessor>();
            var result = await processor.ReproccessRegistrations(new CharacterId(newId));
            if (result.HasError)
            {
                warnings.Add($"The character was imported, but working it through this server's rules reported: {result.ErrorMessage}. Open it in the builder to check.");
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "reprocessing imported character {Character} failed", newId);
            await RemoveAsync(snapshots, config, newId, portraitUrl);
            return (null, "The character doesn't fit this server's rules content (a different version of its books?), so it was not imported; nothing was kept. The server's log has the details.");
        }
        return (new CharacterImportResponse(newId, preview.Name, warnings), null);
    }

    // the file's built-in elements (and their rules) this server lacks by id, mapped to its own copies
    private static async Task<Dictionary<Guid, Guid>> MatchBuiltInsAsync(IElementsModuleQueries elements, CharacterExportFile file, IReadOnlyCollection<ElementDataModel> here)
    {
        var found = here.Select(e => e.Id).ToHashSet();
        var missing = file.Dependencies.Where(d => d.Rules is not null && !found.Contains(d.Id)).ToList();
        var candidates = new List<ElementDataModel>();
        foreach (var type in missing.Select(d => d.Type).Distinct())
        {
            candidates.AddRange(await elements.GetElementsByType(type));
        }
        return CharacterPortableData.MatchBuiltIns(missing, candidates);
    }

    // the rules of elements (their ids come from the content's ids like the elements')
    private static IEnumerable<Guid> RuleIds(IEnumerable<ElementDataModel> elements) =>
        elements.SelectMany(e => e.IncludeRules.Select(r => r.RuleId)
            .Concat(e.StatisticRules.Select(r => r.RuleId))
            .Concat(e.SelectionRules.Select(r => r.RuleId)));

    // a half-made import goes again: the character, its registrations, its uploaded pictures
    // (in SQL directly: this request's context still tracks rows the restore already replaced)
    private static async Task RemoveAsync(ICharacterSnapshotsRepository snapshots, IConfiguration config, Guid characterId, string? portraitUrl)
    {
        await snapshots.DeleteRowsAsync(characterId);
        PortraitFiles.DeleteUploaded(config, portraitUrl);
        var story = StoryImages.Folder(config, characterId);
        if (Directory.Exists(story))
        {
            Directory.Delete(story, recursive: true);
        }
    }

    private static async Task<bool> WaitForProcessingAsync(ICharacterSnapshotsRepository snapshots, Guid characterId, TimeSpan limit)
    {
        var until = DateTime.UtcNow + limit;
        while (await snapshots.IsProcessingAsync(characterId))
        {
            if (DateTime.UtcNow > until)
            {
                return false;
            }
            await Task.Delay(250);
        }
        return true;
    }

    private static async Task<CharacterExportPortrait?> PortraitAsync(IConfiguration config, string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return null;
        }
        // an uploaded picture goes in the file (only names the server made: never a path from the database)
        if (url.StartsWith(PortraitFiles.UrlPrefix, StringComparison.Ordinal))
        {
            var name = url[PortraitFiles.UrlPrefix.Length..];
            var path = Path.Combine(PortraitFiles.Folder(config), name);
            return PortraitFiles.FileName().IsMatch(name) && File.Exists(path)
                ? new CharacterExportPortrait { Url = url, Data = DataUrl(await File.ReadAllBytesAsync(path), name) }
                : new CharacterExportPortrait { Url = url };
        }
        return new CharacterExportPortrait { Url = url };
    }

    private static async Task<List<CharacterExportImage>> StoryImagesAsync(IConfiguration config, Guid characterId)
    {
        var folder = StoryImages.Folder(config, characterId);
        var images = new List<CharacterExportImage>();
        if (!Directory.Exists(folder))
        {
            return images;
        }
        foreach (var name in Directory.EnumerateFiles(folder).Select(Path.GetFileName).OfType<string>().Where(n => PortraitFiles.FileName().IsMatch(n)).Order(StringComparer.Ordinal))
        {
            images.Add(new CharacterExportImage(name, DataUrl(await File.ReadAllBytesAsync(Path.Combine(folder, name)), name)));
        }
        return images;
    }

    private static void SaveStoryImages(IConfiguration config, Guid characterId, List<CharacterExportImage> images, List<string> warnings)
    {
        if (images.Count == 0)
        {
            return;
        }
        var folder = StoryImages.Folder(config, characterId);
        Directory.CreateDirectory(folder);
        foreach (var image in images)
        {
            var comma = image.Data.IndexOf(',');
            byte[]? bytes = null;
            try
            {
                bytes = Convert.FromBase64String(comma >= 0 ? image.Data[(comma + 1)..] : image.Data);
            }
            catch (FormatException)
            {
            }
            // the same checks as an upload: a name the server would make, a real picture, not too big
            if (!PortraitFiles.FileName().IsMatch(image.Name) || bytes is null || bytes.Length > PortraitFiles.MaxBytes || PortraitFiles.Extension(bytes) is null)
            {
                warnings.Add($"A picture from the character's story ({image.Name}) was not usable and was left out.");
                continue;
            }
            File.WriteAllBytes(Path.Combine(folder, image.Name), bytes);
        }
    }

    private static string DataUrl(byte[] bytes, string name)
    {
        var type = Path.GetExtension(name).TrimStart('.').ToLowerInvariant() switch
        {
            "jpg" or "jpeg" => "image/jpeg",
            "png" => "image/png",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "avif" => "image/avif",
            _ => "application/octet-stream",
        };
        return $"data:{type};base64,{Convert.ToBase64String(bytes)}";
    }
}

/// <summary>
/// Downloads a character as a Starlights character file, for another Starlights server. A password-locked
/// player's character needs their token (the locked-character check covers /api/characters/{id}/…).
/// </summary>
public sealed class ExportCharacterEndpoint : EndpointWithoutRequest<CharacterExportFile>
{
    private readonly IPersistence _persistence;
    private readonly IElementsModuleQueries _elements;

    public ExportCharacterEndpoint(IPersistence persistence, IElementsModuleQueries elements)
    {
        _persistence = persistence;
        _elements = elements;
    }

    public override void Configure()
    {
        Get("{characterId:guid}/export");
        Group<CharactersGroup>();
        AllowAnonymous();
    }

    public override async Task HandleAsync(CancellationToken ct)
    {
        var file = await CharacterPortability.ExportAsync(_persistence, _elements, Config, Route<Guid>("characterId"));
        if (file is null)
        {
            await Send.NotFoundAsync(ct);
            return;
        }
        var safe = new string(file.Summary.Name.Select(c => char.IsLetterOrDigit(c) || c is ' ' or '-' or '_' ? c : '_').ToArray()).Trim();
        HttpContext.Response.Headers.ContentDisposition = $"attachment; filename=\"{(safe.Length > 0 ? safe : "character")}.starlights.json\"";
        await Send.OkAsync(file, ct);
    }
}

/// <summary>Reads a character file and says what importing it would do; changes nothing.</summary>
public sealed class PreviewCharacterImportEndpoint : Endpoint<CharacterImportPreviewRequest, CharacterImportPreview>
{
    private readonly IPersistence _persistence;
    private readonly IElementsModuleQueries _elements;

    public PreviewCharacterImportEndpoint(IPersistence persistence, IElementsModuleQueries elements)
    {
        _persistence = persistence;
        _elements = elements;
    }

    public override void Configure()
    {
        Post("import/preview");
        Group<CharactersGroup>();
        AllowAnonymous();
    }

    public override async Task HandleAsync(CharacterImportPreviewRequest req, CancellationToken ct) =>
        await Send.OkAsync(await CharacterPortability.PreviewAsync(_persistence, _elements, req.File, req.PlayerName), ct);
}

/// <summary>
/// Creates a new character from a character file (never overwriting one): new ids, the importing player as its
/// player (a locked player only with their token), no campaign. Refused while rules content it uses is missing.
/// </summary>
public sealed class ImportCharacterEndpoint : Endpoint<CharacterImportRequest, CharacterImportResponse>
{
    private readonly IPersistence _persistence;
    private readonly IElementsModuleQueries _elements;
    private readonly ICharacterCreationService _creation;
    private readonly IServiceScopeFactory _scopes;
    private readonly PlayerAccess _access;

    public ImportCharacterEndpoint(IPersistence persistence, IElementsModuleQueries elements, ICharacterCreationService creation, IServiceScopeFactory scopes, PlayerAccess access)
    {
        _persistence = persistence;
        _elements = elements;
        _creation = creation;
        _scopes = scopes;
        _access = access;
    }

    public override void Configure()
    {
        Post("import");
        Group<CharactersGroup>();
        AllowAnonymous();
    }

    public override async Task HandleAsync(CharacterImportRequest req, CancellationToken ct)
    {
        var player = req.PlayerName?.Trim();
        if (player is { Length: > 64 } || PlayerAccess.IsReservedName(player))
        {
            AddError(r => r.PlayerName, "That player name can't be used.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }
        // like creating a character: a password-locked player's characters only with their token
        if (!string.IsNullOrWhiteSpace(player) && !await _access.CanActAsAsync(HttpContext.Request.Headers[PlayerAccess.TokenHeader], player))
        {
            await Send.UnauthorizedAsync(ct);
            return;
        }
        if (!req.Confirm)
        {
            AddError("Confirm the import after looking at the preview.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }
        if (req.File is null)
        {
            AddError(r => r.File, "No character file was sent.");
            await Send.ErrorsAsync(cancellation: ct);
            return;
        }

        var (result, problem) = await CharacterPortability.ImportAsync(_persistence, _elements, _creation, _scopes, Logger, Config, req.File, player, ct);
        if (result is null)
        {
            AddError(problem ?? "The character could not be imported.");
            await Send.ErrorsAsync(StatusCodes.Status409Conflict, ct);
            return;
        }
        await Send.OkAsync(result, ct);
    }
}
