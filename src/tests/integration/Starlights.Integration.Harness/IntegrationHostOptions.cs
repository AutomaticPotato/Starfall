using System.Reflection;

namespace Starlights.Integration;

public class IntegrationHostOptions
{
    /// <summary>
    /// Gets or sets the timeout duration for integration tests. This timeout is used to ensure that tests do not run indefinitely and provides a default value of 10 seconds.
    /// </summary>
    public TimeSpan TestTimeout { get; set; } = TimeSpan.FromSeconds(30);

    /// <summary>
    /// Gets or sets a value indicating whether to use the console activity processor.
    /// </summary>
    public bool UseConsoleActivityProcessor { get; set; }

    /// <summary>
    /// Gets or sets a unique identifier for the integration environment to be used for uniqueness of individual tests.
    /// </summary>
    public string UniqueIntegrationIdentifier { get; set; } = Guid.NewGuid().ToString("N")[..12];

    /// <summary>
    /// The content administrator's key (<c>Admin:Key</c>), sent in the <c>X-Admin-Key</c> header by
    /// <see cref="IntegrationHost.CreateAdminClient"/>. Synthetic and random per host; never a real key.
    /// </summary>
    public string AdminKey { get; set; } = SyntheticSecret();

    /// <summary>
    /// The master admin password (<c>Admin:MasterPassword</c>) that <c>/api/admin/unlock</c> exchanges for the admin
    /// token. Synthetic and random per host.
    /// </summary>
    public string MasterPassword { get; set; } = SyntheticSecret();

    /// <summary>
    /// The key unlock tokens are signed with (<c>Players:TokenKey</c>). Synthetic and random per host.
    /// </summary>
    public string PlayerTokenKey { get; set; } = SyntheticSecret();

    private static string SyntheticSecret() => $"test-{Guid.NewGuid():N}";

    /// <summary>
    /// Gets or sets the assemblies to scan for <see cref="IDriver"/> implementations.
    /// </summary>
    public Assembly[] DriverAssemblies { get; set; } = [];

    /// <summary>
    /// Gets or sets the assemblies to scan for domain event handlers. By default, it includes the assembly containing the <see cref="IntegrationHost"/> class.
    /// </summary>
    public Assembly[] EventHandlerAssemblies { get; set; } = [typeof(IntegrationHost).Assembly];
}
