namespace Starlights.Modules.Characters.Domain.Characters;

/// <summary>
/// One entry in a character's inventory, like Aurora's &lt;item&gt;: an item element, or a homebrew item described
/// by the player; how many; where it is (equipped, carried, in a container, stored away); attunement and charges.
/// </summary>
public sealed record InventoryItem
{
    /// <summary>Stable id of this entry (two longswords are two entries when one is equipped).</summary>
    public string Id { get; init; } = string.Empty;

    /// <summary>The item element; null for a homebrew item described by <see cref="Custom"/>.</summary>
    public Guid? ElementId { get; init; }

    /// <summary>
    /// For a magic item made from another item ("Weapon, +1", "Flame Tongue"), the weapon or armor it is; its
    /// figures (damage, AC, weight) come from this base, its magic from the element.
    /// </summary>
    public Guid? BaseElementId { get; init; }

    /// <summary>The player's own name for it, if any (otherwise the element's, formatted with its base).</summary>
    public string? Name { get; init; }

    public int Quantity { get; init; } = 1;

    /// <summary>Where it is equipped ("Armor", "Main Hand", "Off Hand", "Two-Handed", "Worn"), or null.</summary>
    public string? Equipped { get; init; }

    /// <summary>The entry of the container it is in (a backpack, a Bag of Holding, a mount); null when on the person.</summary>
    public string? ContainerId { get; init; }

    /// <summary>Left somewhere (at home, in a vault): not carried, its weight does not count.</summary>
    public bool Stored { get; init; }

    public bool Attuned { get; init; }

    /// <summary>Charges spent, for items with charges.</summary>
    public int ChargesUsed { get; init; }

    /// <summary>Whether the sheet prints a card for it (Aurora's "card" option).</summary>
    public bool Card { get; init; } = true;

    /// <summary>Its place in the sheet's attack list (Aurora's displayed attacks), or null when not listed.</summary>
    public int? Attack { get; init; }

    /// <summary>A picture of this one (the item card the DM handed over with it).</summary>
    public string? ImageUrl { get; init; }

    public string? Notes { get; init; }

    /// <summary>A homebrew item's details (or overrides for an element's).</summary>
    public CustomItem? Custom { get; init; }

    /// <summary>
    /// Set by the server: the rules registration of this item while it is active (equipped, or attuned when it
    /// needs attunement) and its element has rules; the client's value is ignored.
    /// </summary>
    public Guid? RegistrationId { get; init; }
}

/// <summary>What a player tells about a homebrew item.</summary>
public sealed record CustomItem
{
    public string? Category { get; init; }
    public decimal? Weight { get; init; }
    public string? Description { get; init; }
    public bool Magic { get; init; }
    public string? Rarity { get; init; }
    public bool Attunement { get; init; }

    /// <summary>It holds other items (a chest at home, a wagon).</summary>
    public bool Container { get; init; }
    public decimal? Capacity { get; init; }

    /// <summary>A picture of it (a campaign magic item's).</summary>
    public string? ImageUrl { get; init; }

    /// <summary>Where it comes from, for its card ("Curse of Strahd", for an item the DM gave).</summary>
    public string? Source { get; init; }
}

/// <summary>
/// An attack written by hand rather than worked out from a weapon: Aurora's Manage → Attacks entries that no item
/// stands behind (an artificer's armor attack, a natural weapon). Its figures are kept as written.
/// </summary>
public sealed record CustomAttack
{
    /// <summary>Manual edits take precedence over Aurora reimports.</summary>
    public bool Edited { get; init; }

    /// <summary>Stable id (Aurora's identifier of the attack).</summary>
    public string Id { get; init; } = string.Empty;

    public string Name { get; init; } = string.Empty;

    /// <summary>"5 ft", "20/60".</summary>
    public string? Range { get; init; }

    /// <summary>The attack roll as written: "+7 vs AC", or a save ("DC 15 Dex").</summary>
    public string? ToHit { get; init; }

    /// <summary>"1d8+4 force".</summary>
    public string? Damage { get; init; }

    /// <summary>The ability it uses, when given ("Intelligence").</summary>
    public string? Ability { get; init; }

    public string? Description { get; init; }

    /// <summary>Its place in the sheet's attack list, numbered together with <see cref="InventoryItem.Attack"/>.</summary>
    public int? Place { get; init; }
}

/// <summary>
/// Everything a character has: items, coins, and the free-text treasure and quest item lists of the sheet's
/// equipment page.
/// </summary>
public sealed record CharacterInventory
{
    public int Version { get; init; } = 1;

    /// <summary>
    /// Goes up with every save. A save must name the revision it started from, so a page with an older copy (a
    /// player's Equipment tab open while the DM gives them an item) cannot write over the newer one.
    /// </summary>
    public int Revision { get; init; }

    public List<InventoryItem> Items { get; init; } = [];

    /// <summary>Coins by kind: cp, sp, ep, gp, pp.</summary>
    public Dictionary<string, int> Coins { get; init; } = [];

    public string? Treasure { get; init; }

    public string? QuestItems { get; init; }

    /// <summary>
    /// Attacks no item stands behind (see <see cref="CustomAttack"/>). Null when never set: a save that leaves it
    /// out keeps the ones stored, so a client that does not know about them cannot lose them.
    /// </summary>
    public List<CustomAttack>? CustomAttacks { get; init; }

    /// <summary>Deleted custom attack identifiers suppressed during reimports.</summary>
    public List<string>? RemovedAttackIds { get; init; }

    /// <summary>This save, with the stored custom attacks when it leaves them out (an empty list removes them).</summary>
    public CharacterInventory KeepingCustomAttacksOf(CharacterInventory stored) =>
        this with
        {
            CustomAttacks = CustomAttacks?.Select(a => a with
            {
                Edited = a.Edited || (stored.CustomAttacks?.Any(previous => previous.Id == a.Id && previous.Edited) ?? false)
            }).ToList() ?? stored.CustomAttacks,
            RemovedAttackIds = RemovedAttackIds ?? stored.RemovedAttackIds
        };

    public static readonly IReadOnlySet<string> CoinKinds = new HashSet<string> { "cp", "sp", "ep", "gp", "pp" };

    /// <summary>What is wrong with this inventory, or null: sizes, and containers that exist and do not nest in a loop.</summary>
    public string? Validate()
    {
        if (Items.Count > 1000)
        {
            return "At most 1,000 items.";
        }
        if (Items.Select(i => i.Id).Distinct().Count() != Items.Count)
        {
            return "Two items have the same id.";
        }
        foreach (var i in Items)
        {
            if (i.Id.Length is 0 or > 64)
            {
                return "An item has no id.";
            }
            if (i.ElementId is null && string.IsNullOrWhiteSpace(i.Name))
            {
                return "A homebrew item needs a name.";
            }
            if ((i.Name?.Length ?? 0) > 200 || (i.Notes?.Length ?? 0) > 5_000 || (i.Equipped?.Length ?? 0) > 40
                || i.Quantity is < 0 or > 100_000 || i.ChargesUsed is < 0 or > 1_000 || i.Attack is < 1 or > 100 || (i.ImageUrl?.Length ?? 0) > 500
                || (i.Custom is { } c && ((c.Category?.Length ?? 0) > 100 || (c.Description?.Length ?? 0) > 20_000 || (c.Rarity?.Length ?? 0) > 40
                    || (c.ImageUrl?.Length ?? 0) > 500 || (c.Source?.Length ?? 0) > 200
                    || c.Weight is < 0 or > 100_000 || c.Capacity is < 0 or > 1_000_000)))
            {
                return $"\"{i.Name ?? "An item"}\" has a value that is too long or out of range.";
            }
        }
        if (Coins.Any(c => !CoinKinds.Contains(c.Key) || c.Value is < 0 or > 1_000_000_000))
        {
            return "Coins are cp, sp, ep, gp and pp, each from 0 to 1,000,000,000.";
        }
        if ((Treasure?.Length ?? 0) > 20_000 || (QuestItems?.Length ?? 0) > 20_000)
        {
            return "The treasure and quest item texts are too long.";
        }
        if (RemovedAttackIds is { } removed && (removed.Count > 1000 || removed.Any(id => string.IsNullOrWhiteSpace(id) || id.Length > 64)))
        {
            return "At most 1000 removed attack identifiers, each between 1 and 64 characters.";
        }
        if (CustomAttacks is { } attacks)
        {
            if (attacks.Count > 100 || attacks.Select(a => a.Id).Distinct().Count() != attacks.Count)
            {
                return "At most 100 attacks, each with its own id.";
            }
            foreach (var a in attacks)
            {
                if (a.Id.Length is 0 or > 64 || string.IsNullOrWhiteSpace(a.Name) || a.Name.Length > 200
                    || (a.Range?.Length ?? 0) > 100 || (a.ToHit?.Length ?? 0) > 100 || (a.Damage?.Length ?? 0) > 200
                    || (a.Ability?.Length ?? 0) > 40 || (a.Description?.Length ?? 0) > 5_000 || a.Place is < 1 or > 100)
                {
                    return $"The attack \"{(string.IsNullOrWhiteSpace(a.Name) ? "without a name" : a.Name)}\" has a value that is missing, too long or out of range.";
                }
            }
        }

        // every container reference points at another entry, and following them never comes back around
        var containerOf = Items.ToDictionary(i => i.Id, i => i.ContainerId);
        foreach (var item in Items.Where(i => i.ContainerId is not null))
        {
            if (!containerOf.ContainsKey(item.ContainerId!))
            {
                return "An item is in a container that is not in the inventory.";
            }
            var seen = new HashSet<string> { item.Id };
            for (var at = item.ContainerId; at is not null; at = containerOf.GetValueOrDefault(at))
            {
                if (!seen.Add(at))
                {
                    return "Containers cannot be inside themselves.";
                }
            }
        }
        return null;
    }
}

/// <summary>
/// A build option added to the character outside the normal build (Aurora's "additional" options: an extra feat,
/// language, proficiency or spell, an optional class feature, a speed or vision bonus): its element and the
/// rules registration it made.
/// </summary>
public sealed record CharacterExtra
{
    public string Id { get; init; } = string.Empty;

    public Guid ElementId { get; init; }

    /// <summary>Set by the server: the registration that applies the extra's rules.</summary>
    public Guid? RegistrationId { get; init; }
}

/// <summary>
/// The character's day-to-day magic: which spells are prepared (per spellcasting, e.g. "Cleric") and which slots
/// are spent. What can be prepared, and how many, comes from the rules; this only holds the player's choices.
/// </summary>
public sealed record CharacterMagic
{
    public int Version { get; init; } = 1;

    /// <summary>Prepared spell elements per spellcasting name; always-prepared spells are not listed.</summary>
    public Dictionary<string, List<Guid>> Prepared { get; init; } = [];

    /// <summary>Spent spell slots per spell level (shared by all spellcasting classes).</summary>
    public Dictionary<int, int> ExpendedSlots { get; init; } = [];

    /// <summary>Spent pact magic slots (warlock).</summary>
    public int ExpendedPactSlots { get; init; }

    /// <summary>
    /// What is wrong with the magic, or null when it is fine. Prepared spells that no longer fit the rules (a level
    /// lost, a book switched off) are kept, like a builder pick: the Magic tab shows them for the player to change.
    /// </summary>
    public string? Validate()
    {
        if (Prepared.Count > 20 || Prepared.Any(p => p.Key.Length is 0 or > 100 || p.Value.Count > 500))
        {
            return "At most 20 spellcastings with 500 prepared spells each.";
        }
        if (ExpendedSlots.Any(s => s.Key is < 1 or > 9 || s.Value is < 0 or > 99) || ExpendedPactSlots is < 0 or > 99)
        {
            return "Spent slots are for spell levels 1 to 9, from 0 to 99 each.";
        }
        return null;
    }
}
