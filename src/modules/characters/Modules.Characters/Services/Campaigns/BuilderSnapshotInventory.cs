using System.Text.Json;
using System.Text.Json.Nodes;
using Starlights.Modules.Characters.Domain.Characters;

namespace Starlights.Modules.Characters.Services.Campaigns;

/// <summary>
/// The inventory inside a builder snapshot (see ICharacterSnapshotsRepository: the character's columns as JSON, the
/// inventory column as a JSON string in it). A trade or a DM's gift is kept whatever the builder does, so it goes into
/// the snapshot as well: discarding the builder's changes then neither gives a traded item back nor takes a gift away.
/// </summary>
public static class BuilderSnapshotInventory
{
    // the same as the inventory column's own (default options)
    private static readonly JsonSerializerOptions Column = JsonSerializerOptions.Default;

    public static CharacterInventory Read(string snapshot)
    {
        var text = JsonNode.Parse(snapshot)?["character"]?["inventory"]?.GetValue<string>();
        return string.IsNullOrEmpty(text) ? new CharacterInventory() : JsonSerializer.Deserialize<CharacterInventory>(text, Column) ?? new CharacterInventory();
    }

    public static string Write(string snapshot, CharacterInventory inventory)
    {
        var root = JsonNode.Parse(snapshot) ?? throw new InvalidOperationException("The builder snapshot is empty.");
        var character = root["character"] as JsonObject ?? throw new InvalidOperationException("The builder snapshot has no character.");
        character["inventory"] = JsonSerializer.Serialize(inventory, Column);
        return root.ToJsonString();
    }
}
