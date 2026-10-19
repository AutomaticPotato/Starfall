using Starlights.Modules.Characters.Domain.Characters;
using Starlights.Modules.Characters.Domain.Registrations;

namespace Starlights.Modules.Characters.Services.Processing;

public interface IRegistrationManager
{
    /// <summary>
    /// Registers a element using the specified registration details.
    /// </summary>
    /// <remarks>
    /// Adds the registration to the store, does not commit changes.
    /// </remarks>
    Task Register(Registration newRegistration);

    /// <summary>
    /// Unregisters and removes an existing registration.
    /// </summary>
    /// <remarks>
    /// All selection and include rules associated with this registration will also be removed, does not commit changes.
    /// </remarks>
    Task Unregister(Registration existingRegistration);

    /// <summary>
    /// Lets every behavior make what it could not make for these existing registrations when they were created (see
    /// <see cref="IRegistrationBehavior.Repair"/>), does not commit changes.
    /// </summary>
    Task Repair(Character character, IEnumerable<Registration> existingRegistrations);
}