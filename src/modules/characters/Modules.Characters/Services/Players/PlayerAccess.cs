using System.Security.Cryptography;
using System.Text;
using Starlights.Modules.Characters.Data;
using Starlights.Modules.Characters.Domain.Players;
using Starlights.Platform.Data;

namespace Starlights.Modules.Characters.Services.Players;

/// <summary>
/// Key for signing unlock tokens. Unset means a random key per process (unlocks last until a restart).
/// </summary>
public sealed record PlayerAccessOptions(string TokenKey, string? MasterPassword = null);

/// <summary>
/// Optional per-player passwords. Unlocking returns a token the browser sends back in the X-Player-Token header
/// (comma-separated when it unlocked several players); the characters of a locked player need a valid one.
/// A token is signed over the password it was given for (its stored hash, or "none" while there is none), so changing,
/// adding or removing that password ends every token given before: a player's, a campaign's (an open campaign's too,
/// once it gets a password), a DM's, and the admin's when the master password changes.
/// </summary>
public sealed class PlayerAccess
{
    public const string TokenHeader = "X-Player-Token";

    // the admin token is a token for this name: it opens every player (and campaign) and allows content changes
    private const string AdminName = "*admin*";

    private static readonly TimeSpan TokenLifetime = TimeSpan.FromDays(180);
    private const int Iterations = 210_000;

    // what a token is signed over while its principal has no password
    private const string NoPassword = "none";

    private readonly IPersistence _persistence;
    private readonly byte[] _key;

    private readonly string? _masterPassword;
    private readonly string _adminStamp;

    public PlayerAccess(IPersistence persistence, PlayerAccessOptions options)
    {
        _persistence = persistence;
        _key = string.IsNullOrEmpty(options.TokenKey) ? ProcessKey : Encoding.UTF8.GetBytes(options.TokenKey);
        _masterPassword = string.IsNullOrEmpty(options.MasterPassword) ? null : options.MasterPassword;
        _adminStamp = _masterPassword is null ? NoPassword : Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(_masterPassword)));
    }

    /// <summary>
    /// Checks the master admin password; returns the admin token, or null when wrong or not configured.
    /// </summary>
    public string? UnlockAdmin(string password)
    {
        if (_masterPassword is null ||
            !CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(password), Encoding.UTF8.GetBytes(_masterPassword)))
        {
            return null;
        }

        return IssueToken(AdminName, _adminStamp);
    }

    /// <summary>
    /// Names that are not players' to have: the admin token is a token for "*admin*" and a campaign's for
    /// "#campaign:…", so a player by such a name could unlock their way into them.
    /// </summary>
    public static bool IsReservedName(string? name) => name?.TrimStart() is { Length: > 0 } n && (n[0] == '*' || n[0] == '#');

    /// <summary>The token name that opens a password-protected campaign.</summary>
    public static string CampaignTokenName(Guid campaignId) => $"#campaign:{campaignId:N}";

    /// <summary>A token for a campaign whose password was given (for its password as it is now: none while it is open).</summary>
    public string IssueCampaignToken(Guid campaignId, string? passwordHash) => IssueToken(CampaignTokenName(campaignId), passwordHash);

    /// <summary>Whether the header opens the campaign: a token for its current password, or the admin's (the DM).</summary>
    public bool HasCampaignToken(string? tokensHeader, Guid campaignId, string? passwordHash) =>
        HasToken(tokensHeader, CampaignTokenName(campaignId), passwordHash, allowAdmin: true);

    /// <summary>The token of a campaign's DM (given for its DM password); like the other reserved names, no player can take it.</summary>
    public static string CampaignDmTokenName(Guid campaignId) => $"#dm:{campaignId:N}";

    public string IssueCampaignDmToken(Guid campaignId, string? dmPasswordHash) => IssueToken(CampaignDmTokenName(campaignId), dmPasswordHash);

    /// <summary>Whether the reader is this campaign's DM: they hold a DM token for its current DM password, or the admin token.</summary>
    public bool HasCampaignDmToken(string? tokensHeader, Guid campaignId, string? dmPasswordHash) =>
        HasToken(tokensHeader, CampaignDmTokenName(campaignId), dmPasswordHash, allowAdmin: true);

    /// <summary>As <see cref="HasCampaignDmToken(string?, Guid, string?)"/>, reading the campaign's DM password (false when there is no such campaign).</summary>
    public async Task<bool> HasCampaignDmTokenAsync(string? tokensHeader, Guid campaignId)
    {
        if (HasAdminToken(tokensHeader))
        {
            return true;
        }
        var campaign = await _persistence.GetRepository<ICampaignsRepository>().GetCampaignAsync(campaignId);
        return campaign is not null && HasCampaignDmToken(tokensHeader, campaignId, campaign.DmPasswordHash);
    }

    public static string HashPassword(string password) => Hash(password);

    public static bool VerifyPassword(string password, string stored) => Verify(password, stored);

    /// <summary>Whether the header carries a valid admin token (for the master password as it is now).</summary>
    public bool HasAdminToken(string? tokensHeader) => HasToken(tokensHeader, AdminName, _adminStamp, allowAdmin: false);

    private static readonly byte[] ProcessKey = RandomNumberGenerator.GetBytes(32);

    private IPlayersRepository Players => _persistence.GetRepository<IPlayersRepository>();

    public async Task<bool> IsLockedAsync(string playerName) =>
        !string.IsNullOrWhiteSpace(playerName) && (await Players.GetPlayerAsync(playerName))?.PasswordHash is not null;

    public async Task<HashSet<string>> GetLockedPlayersAsync() =>
        new(await Players.GetLockedPlayerNamesAsync(), StringComparer.OrdinalIgnoreCase);

    /// <summary>The locked players with their password hashes, for checking many players' tokens at once.</summary>
    public async Task<Dictionary<string, string>> GetLockedPlayerHashesAsync() =>
        new(await Players.GetLockedPlayerHashesAsync(), StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Whether the reader may act as the player: the player has no password, or the header holds a token for its
    /// current password (or the admin token).
    /// </summary>
    public async Task<bool> CanActAsAsync(string? tokensHeader, string? playerName)
    {
        if (string.IsNullOrWhiteSpace(playerName))
        {
            return true;
        }
        var hash = (await Players.GetPlayerAsync(playerName))?.PasswordHash;
        return hash is null || HasToken(tokensHeader, playerName, hash, allowAdmin: true);
    }

    /// <summary>Whether the header holds a token for the player's current password (or the admin token); for a locked player's hash from <see cref="GetLockedPlayerHashesAsync"/>.</summary>
    public bool HasPlayerToken(string? tokensHeader, string playerName, string passwordHash) =>
        HasToken(tokensHeader, playerName, passwordHash, allowAdmin: true);

    public Task<string?> GetCharacterPlayerAsync(Guid characterId) => Players.GetCharacterPlayerNameAsync(characterId);

    /// <summary>
    /// Checks the password and returns an unlock token, or null when it is wrong or the player is not locked.
    /// </summary>
    public async Task<string?> UnlockAsync(string playerName, string password)
    {
        if (IsReservedName(playerName))
        {
            return null;
        }

        var player = await Players.GetPlayerAsync(playerName);
        if (player?.PasswordHash is null || !Verify(password, player.PasswordHash))
        {
            return null;
        }

        return IssueToken(player.Name, player.PasswordHash);
    }

    /// <summary>
    /// Sets the player's password (creating the player when needed), or removes it when empty; tokens given for the
    /// old password stop working. Returns the name as stored and a token for the new password (empty when removed).
    /// </summary>
    public async Task<(string Name, string Token)> SetPasswordAsync(string playerName, string? password)
    {
        if (IsReservedName(playerName))
        {
            throw new ArgumentException("That name is reserved.", nameof(playerName));
        }

        var player = await Players.GetPlayerAsync(playerName);
        if (player is null)
        {
            player = Player.Create(playerName);
            Players.Add(player);
        }

        player.SetPasswordHash(string.IsNullOrEmpty(password) ? null : Hash(password));
        await _persistence.SaveChangesAsync();
        return (player.Name, player.PasswordHash is null ? string.Empty : IssueToken(player.Name, player.PasswordHash));
    }

    /// <summary>A token for the name, signed over the password it is for (its hash; null: none).</summary>
    private string IssueToken(string playerName, string? passwordHash)
    {
        var expires = DateTimeOffset.UtcNow.Add(TokenLifetime).ToUnixTimeSeconds();
        var name = Convert.ToBase64String(Encoding.UTF8.GetBytes(playerName)).Replace('+', '-').Replace('/', '_').TrimEnd('=');
        return $"{name}.{expires}.{Sign(playerName, expires, passwordHash)}";
    }

    /// <summary>
    /// Whether the header carries a valid, unexpired token for the name and its current password (hash; null: none),
    /// or (when allowed) the admin token.
    /// </summary>
    private bool HasToken(string? tokensHeader, string playerName, string? passwordHash, bool allowAdmin)
    {
        if (string.IsNullOrWhiteSpace(tokensHeader))
        {
            return false;
        }

        foreach (var token in tokensHeader.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var parts = token.Split('.');
            if (parts.Length != 3 || !long.TryParse(parts[1], out var expires) || expires < DateTimeOffset.UtcNow.ToUnixTimeSeconds())
            {
                continue;
            }

            string name;
            try
            {
                var b64 = parts[0].Replace('-', '+').Replace('_', '/');
                name = Encoding.UTF8.GetString(Convert.FromBase64String(b64.PadRight(b64.Length + (4 - b64.Length % 4) % 4, '=')));
            }
            catch (FormatException)
            {
                continue;
            }

            // the admin token answers for every name, signed over the master password
            string? stamp;
            if (string.Equals(name, playerName.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                stamp = name == AdminName ? _adminStamp : passwordHash;
            }
            else if (allowAdmin && name == AdminName)
            {
                stamp = _adminStamp;
            }
            else
            {
                continue;
            }
            if (CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(parts[2]), Encoding.ASCII.GetBytes(Sign(name, expires, stamp))))
            {
                return true;
            }
        }

        return false;
    }

    private string Sign(string playerName, long expires, string? passwordHash)
    {
        var mac = HMACSHA256.HashData(_key, Encoding.UTF8.GetBytes($"{playerName.Trim().ToLowerInvariant()}|{expires}|{passwordHash ?? NoPassword}"));
        return Convert.ToBase64String(mac).Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    private static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, 32);
        return $"pbkdf2-sha256${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    private static bool Verify(string password, string stored)
    {
        var parts = stored.Split('$');
        if (parts.Length != 4 || parts[0] != "pbkdf2-sha256" || !int.TryParse(parts[1], out var iterations))
        {
            return false;
        }

        var expected = Convert.FromBase64String(parts[3]);
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, Convert.FromBase64String(parts[2]), iterations, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}
