using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Starlights.Modules.Characters.Data.EntityFramework.Querying;
using Starlights.Modules.Characters.Domain.Characters;
using Starlights.Platform.Components.Data.EntityFramework;

namespace Starlights.Modules.Characters.Data.EntityFramework;

internal class CharactersRepository : RepositoryBase<Character>, ICharactersRepository
{
    public void Add(Character character) => Entities.Add(character);

    public async Task<ICharacterLock> LockAsync(params Guid[] characterIds)
    {
        var owned = Context.Database.CurrentTransaction is null;
        var transaction = owned ? await Context.Database.BeginTransactionAsync() : Context.Database.CurrentTransaction!;
        var ids = characterIds.Distinct().Order().ToList();
        if (ids.Count > 0)
        {
            // update locks, in one statement in key order (two trades between the same characters can't deadlock)
            await using var command = Context.Database.GetDbConnection().CreateCommand();
            command.Transaction = transaction.GetDbTransaction();
            command.CommandText = $"SELECT id FROM characters.character WITH (UPDLOCK, ROWLOCK) WHERE id IN ({string.Join(", ", ids.Select((_, i) => $"@p{i}"))}) ORDER BY id";
            for (var i = 0; i < ids.Count; i++)
            {
                var parameter = command.CreateParameter();
                parameter.ParameterName = $"@p{i}";
                parameter.DbType = DbType.Guid;
                parameter.Value = ids[i];
                command.Parameters.Add(parameter);
            }
            await using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
            }
        }
        return new CharacterLock(transaction, owned);
    }

    private sealed class CharacterLock(IDbContextTransaction transaction, bool owned) : ICharacterLock
    {
        private bool _done;

        public async Task CommitAsync()
        {
            if (owned && !_done)
            {
                await transaction.CommitAsync();
            }
            _done = true;
        }

        public async ValueTask DisposeAsync()
        {
            if (owned)
            {
                if (!_done)
                {
                    await transaction.RollbackAsync();
                }
                await transaction.DisposeAsync();
            }
        }
    }

    public Task<bool> DeleteCharacterAsync(CharacterId identifier)
    {
        var toRemove = Entities.SingleOrDefault(c => c.Id == identifier);
        if (toRemove is null)
        {
            return Task.FromResult(false);
        }

        Entities.Remove(toRemove);
        return Task.FromResult(true);
    }

    public async Task<Dictionary<Guid, CharacterCombatState>> GetCombatStatesAsync(IReadOnlyCollection<Guid> characterIds)
    {
        if (characterIds.Count == 0)
        {
            return [];
        }
        var keys = characterIds.Select(id => new CharacterId(id)).ToList();
        var rows = await Entities.AsNoTracking()
            .Where(c => keys.Contains(c.Id))
            .Select(c => new { c.Id, c.Name, Combat = EF.Property<CharacterCombat>(c, "_combat") })
            .ToListAsync();
        return rows.ToDictionary(r => r.Id.Value, r => new CharacterCombatState(r.Id.Value, r.Name, r.Combat ?? new CharacterCombat()));
    }

    public async Task<Character?> GetCharacterAsync(Guid identifier)
    {
        return await Entities
            .IncludeAggregateGraph()
            .AsSplitQuery()
            .SingleOrDefaultAsync(a => a.Id == identifier);
    }

    public async Task<IEnumerable<Character>> GetCharactersAsync()
    {
        return await Entities
            .IncludeAggregateGraph()
            .AsSplitQuery()
            .ToListAsync();
    }
}
