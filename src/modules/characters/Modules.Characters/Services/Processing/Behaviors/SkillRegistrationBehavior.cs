using Microsoft.Extensions.Logging;
using Starlights.Modules.Characters.Data;
using Starlights.Modules.Characters.Domain;
using Starlights.Modules.Characters.Domain.Abilities;
using Starlights.Modules.Characters.Domain.Characters;
using Starlights.Modules.Characters.Domain.Elements;
using Starlights.Modules.Characters.Domain.Registrations;
using Starlights.Modules.Characters.Domain.Skills;
using Starlights.Modules.Elements.Integration;
using Starlights.Modules.Elements.Integration.Models;
using Starlights.Platform.Data;

namespace Starlights.Modules.Characters.Services.Processing.Behaviors;

/// <summary>
/// This behavior is responsible for creating a skill when a new skill registration is created.
/// </summary>
public sealed class SkillRegistrationBehavior : IRegistrationBehavior
{
    private readonly ILogger<SkillRegistrationBehavior> _logger;
    private readonly IPersistence _persistence;
    private readonly IElementsModuleQueries _elements;

    public SkillRegistrationBehavior(ILogger<SkillRegistrationBehavior> logger, IPersistence persistence, IElementsModuleQueries elements)
    {
        _logger = logger;
        _persistence = persistence;
        _elements = elements;
    }

    public Task Registered(Registration newRegistration) => CreateSkill(newRegistration);

    /// <summary>
    /// A skill registered before its ability score was (registrations are not always handled in the order they were
    /// made) got no skill; it gets it once the character's registrations have all been processed.
    /// </summary>
    public Task Repair(Character character, Registration existingRegistration) => CreateSkill(existingRegistration, character);

    private async Task CreateSkill(Registration registration, Character? loaded = null)
    {
        if (registration.AssociatedElementType != "Skill")
        {
            return;
        }
        using var _ = CharactersInstrumentation.StartActivity($"{nameof(SkillRegistrationBehavior)} | {registration.AssociatedElementName}");


        // when a new skill element is registered, we need to create the skill for the character
        var character = loaded ?? await _persistence.GetRepository<ICharactersRepository>().GetCharacterAsync(registration.CharacterId)
            ?? throw new InvalidOperationException($"Character with ID {registration.CharacterId} not found.");
        if (character.GetRequiredComponent<SkillsComponent>().Skills.Any(s => s.AssociatedRegistrationId == registration.Id))
        {
            return;
        }

        // fetch the associated skill element
        var associatedElement = await _elements.GetSkillModel(registration.AssociatedElementId) ?? throw new InvalidOperationException($"Skill with ID {registration.AssociatedElementId} not found.");

        // try to find the primary ability score for this skill
        var primaryScore = await GetPrimaryAbilityScore(character, associatedElement);
        if (primaryScore is null)
        {
            _logger.LogInformation("Skill '{SkillName}' waits for its ability score to be registered [character='{CharacterId}']", associatedElement.Name, character.Id.Value);
            return;
        }

        // create the skill for the character
        character.UpdateComponent<SkillsComponent>((component, _) =>
            component.CreateSkill(registration.Id, associatedElement.Name, primaryScore.Id, primaryScore.Abbreviation, associatedElement.SortingOrder));
    }

    private async Task<AbilityScore?> GetPrimaryAbilityScore(Character character, SkillDataModel skill)
    {
        var abilities = character.GetRequiredComponent<AbilitiesComponent>();

        // otherwise, we need to fetch the registrations from the repository
        var existingRegistrations = await _persistence.GetRepository<IRegistrationRepository>()
            .GetRegistrationsByAssociationsAsync(character.Id, new ElementId(skill.PrimaryAbilityElementId));

        foreach (var abilityRegistration in existingRegistrations.Where(registration => registration.AssociatedElementId == skill.PrimaryAbilityElementId))
        {
            return abilities.AbilityScores.SingleOrDefault(a => a.AssociatedRegistrationId == abilityRegistration.Id);
        }

        return null;
    }

    public Task Unregister(Registration existingRegistration)
    {
        if (existingRegistration.AssociatedElementType != "Skill")
        {
            return Task.CompletedTask;
        }

        throw new NotImplementedException();
    }
}
