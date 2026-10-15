using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Starlights.Application;

namespace Starlights.Integration;

/// <summary>
/// Integration host for running integration tests against the Starlights application.
/// </summary>
public class IntegrationHost : IIntegrationHost, IDisposable
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly IServiceScope _scope;
    private bool _disposedValue;

    internal IntegrationHost(WebApplicationFactory<Program> factory, Dictionary<string, object> properties, IntegrationHostOptions options)
    {
        _factory = factory;
        Properties = properties;
        Options = options;
        _scope = _factory.Services.CreateScope();
        Services = _scope.ServiceProvider;
    }

    /// <summary>
    /// Gets a dictionary of properties associated with this host, allowing for storage and retrieval of arbitrary data during integration tests.
    /// </summary>
    public Dictionary<string, object> Properties { get; }

    /// <summary>
    /// Gets the services available in this host, allowing for dependency resolution of application services during integration tests.
    /// </summary>
    public IServiceProvider Services { get; }

    /// <summary>
    /// Creates a new HTTP client for making requests to the application, allowing for end-to-end testing of API endpoints and application behavior during integration tests.
    /// </summary>
    /// <returns>A new <see cref="HttpClient"/> instance for making requests to the application.</returns>
    public HttpClient CreateClient()
    {
        return _factory.CreateClient();
    }

    /// <summary>
    /// The host's options, including its synthetic credentials (<see cref="IntegrationHostOptions.AdminKey"/>,
    /// <see cref="IntegrationHostOptions.MasterPassword"/>).
    /// </summary>
    public IntegrationHostOptions Options { get; }

    /// <summary>
    /// Creates an HTTP client for content administration (creating, editing and deleting elements, initializing the
    /// ruleset, <c>/api/admin</c>): it sends the host's synthetic admin key in the <c>X-Admin-Key</c> header.
    /// Players' requests use <see cref="CreateClient"/>, which carries no credentials.
    /// </summary>
    public HttpClient CreateAdminClient()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(AdminKeyHeader, Options.AdminKey);
        return client;
    }

    /// <summary>The header that carries the content administrator's key.</summary>
    public const string AdminKeyHeader = "X-Admin-Key";

    protected virtual void Dispose(bool disposing)
    {
        if (!_disposedValue)
        {
            if (disposing)
            {
                _scope.Dispose();
                _factory.Dispose();
            }

            _disposedValue = true;
        }
    }

    public void Dispose()
    {
        Dispose(disposing: true);
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Creates a new instance of the <see cref="IntegrationHostBuilder"/> class, which can be used to configure and build an <see cref="IntegrationHost"/> for running integration tests against the Starlights application.
    /// </summary>
    /// <returns>A new <see cref="IntegrationHostBuilder"/> instance for configuring and building an <see cref="IntegrationHost"/>.</returns>
    public static IntegrationHostBuilder CreateBuilder()
    {
        return new();
    }
}
