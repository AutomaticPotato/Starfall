using System.Text.RegularExpressions;
using Starlights.Modules.Characters.Domain.Abilities;
using Starlights.Modules.Characters.Domain.Characters;
using Starlights.Modules.Characters.Domain.Classes;
using Starlights.Modules.Characters.Domain.Progression;
using Starlights.Modules.Characters.Domain.Registrations;
using Starlights.Modules.Characters.Services.Statistics;

namespace Starlights.Modules.Characters.Services.Processing;

/// <summary>
/// A character's values for the bracket terms of a requirements expression (see <see cref="RequirementsExpression"/>):
/// <c>level</c> and <c>character</c> the character level, <c>level:warlock</c> a class level (0 for a class it does
/// not have), <c>str</c> or <c>strength</c> an ability score, <c>type:spell</c> how many elements of that type it has,
/// anything else a statistic.
/// </summary>
public static class CharacterRequirementValues
{
    /// <param name="registrations">The character's registrations, asked for only when a type term needs them.</param>
    /// <param name="statistics">The character's statistics, asked for only when a term needs one.</param>
    public static Func<string, int?> For(Character character, Func<IEnumerable<Registration>> registrations, Func<StatisticValuesGroupCollection> statistics)
    {
        return name =>
        {
            if (name is "level" or "character")
            {
                return character.GetRequiredComponent<ProgressionComponent>().CharacterLevel;
            }
            if (name.StartsWith("level:", StringComparison.Ordinal))
            {
                // a class the character does not have is level 0
                var className = name[6..].Replace('-', ' ');
                return character.GetRequiredComponent<ClassComponent>().Classes
                    .FirstOrDefault(c => string.Equals(c.Name, className, StringComparison.OrdinalIgnoreCase))?.Level ?? 0;
            }
            if (name.StartsWith("type:", StringComparison.Ordinal))
            {
                var type = name[5..];
                return registrations().Count(r => string.Equals(r.AssociatedElementType, type, StringComparison.OrdinalIgnoreCase));
            }
            if (AbilityNames.TryGetValue(name, out var ability))
            {
                return character.GetRequiredComponent<AbilitiesComponent>().AbilityScores
                    .FirstOrDefault(a => string.Equals(a.Name, ability, StringComparison.OrdinalIgnoreCase))?.CalculatedScore;
            }

            var statisticName = AuroraSave.Replace(name, "$1-saving-throw").Replace(' ', '-');
            return statistics().TryGetGroup(statisticName, out var group) ? group.Sum() : null;
        };
    }

    private static readonly Dictionary<string, string> AbilityNames = new()
    {
        ["str"] = "Strength", ["strength"] = "Strength",
        ["dex"] = "Dexterity", ["dexterity"] = "Dexterity",
        ["con"] = "Constitution", ["constitution"] = "Constitution",
        ["int"] = "Intelligence", ["intelligence"] = "Intelligence",
        ["wis"] = "Wisdom", ["wisdom"] = "Wisdom",
        ["cha"] = "Charisma", ["charisma"] = "Charisma",
    };

    private static readonly Regex AuroraSave = new(@"^(strength|dexterity|constitution|intelligence|wisdom|charisma):save\b");
}
