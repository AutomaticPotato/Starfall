using Starlights.Modules.Characters.Domain.Characters;
using Starlights.Modules.Characters.Domain.Registrations;

namespace Starlights.Modules.Characters.Services.Processing;

public interface IRegistrationBehavior
{
    /// <summary>
    /// This method is called when a new registration is created.
    /// </summary>
    /// <param name="newRegistration">The registration that was just created. Note: at this time the changes have not been saved to the characters database yet.</param>
    Task Registered(Registration newRegistration);

    /// <summary>
    /// This method is called when an existing registration is being removed.
    /// </summary>
    Task Unregister(Registration existingRegistration);

    /// <summary>
    /// Called for a character's existing registrations once all of them have been processed: what this behavior
    /// could not make when the registration was created, because it needs another registration that did not exist
    /// yet (a skill needs its ability score), it makes now. Must not make anything twice.
    /// </summary>
    Task Repair(Character character, Registration existingRegistration) => Task.CompletedTask;
}
