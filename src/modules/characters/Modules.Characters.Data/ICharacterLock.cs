namespace Starlights.Modules.Characters.Data;

/// <summary>
/// Characters' rows held for one request (see <see cref="ICharactersRepository.LockAsync"/>): committing keeps what
/// the request saved and lets the next request in; disposing without committing rolls back.
/// </summary>
public interface ICharacterLock : IAsyncDisposable
{
    Task CommitAsync();
}
