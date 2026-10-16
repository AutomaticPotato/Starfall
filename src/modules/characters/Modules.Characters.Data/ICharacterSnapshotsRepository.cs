using Starlights.Modules.Characters.Domain.Characters;
using Starlights.Platform.Data;

namespace Starlights.Modules.Characters.Data;

/// <summary>
/// Snapshots of characters for the builder's Save and Discard: everything the builder changes (name, sources, story,
/// equipment, extras, prepared spells, ability scores, classes, every choice and what it registered), not what
/// happens in a fight.
/// </summary>
public interface ICharacterSnapshotsRepository : IRepository
{
    Task<CharacterSnapshot?> GetAsync(Guid characterId);

    /// <summary>The character as it is now, as JSON (the same for the same character: rows in id order).</summary>
    Task<string> CaptureAsync(Guid characterId);

    /// <summary>Puts the character back as the captured JSON describes it (in one transaction).</summary>
    Task RestoreAsync(Guid characterId, string data);

    /// <summary>Whether the character still has changes being worked through (events not yet processed).</summary>
    Task<bool> IsProcessingAsync(Guid characterId);

    /// <summary>
    /// As <see cref="CaptureAsync"/>, plus the character's play state (combat: hit points, conditions, resources, used
    /// slots), for exporting a whole character to another Starlights server.
    /// </summary>
    Task<string> CapturePortableAsync(Guid characterId);

    /// <summary>Puts a portable capture (<see cref="CapturePortableAsync"/>) into an existing character, play state too.</summary>
    Task RestorePortableAsync(Guid characterId, string data);

    /// <summary>The columns of the tables a capture spans (table → column names), to compare captures across versions.</summary>
    Task<Dictionary<string, List<string>>> GetCaptureColumnsAsync();

    void Add(CharacterSnapshot snapshot);

    void Remove(CharacterSnapshot snapshot);
}
