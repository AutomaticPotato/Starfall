namespace Starlights.Integration;

public interface IIntegrationHost
{
    /// <summary>
    /// Gets a dictionary of properties associated with this host.
    /// </summary>
    Dictionary<string, object> Properties { get; }

    /// <summary>
    /// Gets the services available in this host.
    /// </summary>
    IServiceProvider Services { get; }

    /// <summary>
    /// Creates a new HTTP client for making requests to the application, without credentials (a player with no
    /// password, or anyone).
    /// </summary>
    HttpClient CreateClient();

    /// <summary>
    /// Creates a new HTTP client for content administration, sending the host's synthetic admin key.
    /// </summary>
    HttpClient CreateAdminClient();
}
