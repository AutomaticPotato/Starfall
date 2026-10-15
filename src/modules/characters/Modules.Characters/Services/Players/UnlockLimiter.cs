namespace Starlights.Modules.Characters.Services.Players;

/// <summary>
/// How many times a password may be tried: a few attempts a minute per account (a player, a campaign, a campaign's DM,
/// the admin), whoever tries and however the address is written. An attempt counts when it arrives, before the
/// password is checked, so parallel guesses can't slip past; over the limit even the right password waits a minute.
/// The window is short so that nobody can keep a player out for long.
/// </summary>
public sealed class UnlockLimiter
{
    public const int Attempts = 5;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(1);

    private readonly Dictionary<string, Queue<DateTimeOffset>> _attempts = new(StringComparer.OrdinalIgnoreCase);
    private readonly TimeProvider _time;

    public UnlockLimiter(TimeProvider? time = null) => _time = time ?? TimeProvider.System;

    /// <summary>Counts an attempt on the account; false (and how long to wait) when it has had its tries this minute.</summary>
    public bool TryAttempt(string account, out TimeSpan retryAfter)
    {
        var now = _time.GetUtcNow();
        lock (_attempts)
        {
            // forget accounts that have been quiet, so the map stays small
            if (_attempts.Count > 1000)
            {
                foreach (var key in _attempts.Where(a => a.Value.Count == 0 || now - a.Value.Peek() >= Window).Select(a => a.Key).ToList())
                {
                    _attempts.Remove(key);
                }
            }
            if (!_attempts.TryGetValue(account, out var times))
            {
                _attempts[account] = times = new Queue<DateTimeOffset>();
            }
            while (times.Count > 0 && now - times.Peek() >= Window)
            {
                times.Dequeue();
            }
            if (times.Count >= Attempts)
            {
                retryAfter = Window - (now - times.Peek());
                return false;
            }
            times.Enqueue(now);
            retryAfter = TimeSpan.Zero;
            return true;
        }
    }

    public static string Player(string name) => $"player:{name.Trim()}";

    public static string Campaign(Guid campaignId) => $"campaign:{campaignId:N}";

    public static string CampaignDm(Guid campaignId) => $"dm:{campaignId:N}";

    public const string Admin = "admin";
}
