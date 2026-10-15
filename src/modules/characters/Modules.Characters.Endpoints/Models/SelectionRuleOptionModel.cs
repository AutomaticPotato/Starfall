namespace Starlights.Modules.Characters.Endpoints.Models;

/// <summary>
/// The DTO model for a selection rule option.
/// </summary>
public record SelectionRuleOptionModel
{
    public required Guid ElementId { get; init; }
    public required string Name { get; init; }

    /// <summary>
    /// The source book, to tell apart options with the same name (e.g. the 2014 and 2024 Elf).
    /// </summary>
    public string? Source { get; init; }

    /// <summary>What the option asks of the character, in words ("Artificer Level 6+", "Strength 13 or higher").</summary>
    public string? Prerequisite { get; init; }

    /// <summary>Whether the character meets the option's requirements now (a plan for a higher level does not).</summary>
    public bool Eligible { get; init; } = true;

    /// <summary>For a spell: what a player looks at to choose it (its level, school and casting figures).</summary>
    public SpellOptionModel? Spell { get; init; }
}

/// <summary>A spell option's level (0 is a cantrip), school, casting figures and the spell lists it is on.</summary>
public record SpellOptionModel
{
    public int Level { get; init; }
    public string? School { get; init; }
    public string? CastingTime { get; init; }
    public string? Range { get; init; }
    public string? Duration { get; init; }
    public string? Components { get; init; }
    public bool Concentration { get; init; }
    public bool Ritual { get; init; }
    public IReadOnlyList<string> Lists { get; init; } = [];
}
