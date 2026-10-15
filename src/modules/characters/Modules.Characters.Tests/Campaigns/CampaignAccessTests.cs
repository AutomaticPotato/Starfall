using AwesomeAssertions;
using Starlights.Modules.Characters.Data;
using Starlights.Modules.Characters.Domain.Campaigns;
using Starlights.Modules.Characters.Domain.Players;
using Starlights.Modules.Characters.Services.Players;
using Starlights.Platform.Data;

namespace Starlights.Modules.Characters.Tests.Campaigns;

/// <summary>
/// Who gets into what: the reserved names behind the admin and campaign tokens, campaign and DM tokens, and that a
/// token stops working once the password it was given for changes.
/// </summary>
[TestClass]
public class CampaignAccessTests
{
    private const string Master = "the-master-password";

    private static PlayerAccess Access(InMemoryPlayers? players = null, string? master = Master) =>
        new(new FakePersistence(players ?? new InMemoryPlayers()), new PlayerAccessOptions("test-key", master));

    [TestMethod]
    [DataRow("*admin*", true)]
    [DataRow("  *admin*", true)]
    [DataRow("#campaign:0123", true)]
    [DataRow("Cara Vale", false)]
    [DataRow("Ada Lark", false)]
    public void NamesBehindTokens_AreNotPlayersToHave(string name, bool reserved)
    {
        PlayerAccess.IsReservedName(name).Should().Be(reserved);
    }

    [TestMethod]
    public async Task NoPlayerCanBeMadeOrUnlockedUnderAReservedName()
    {
        var access = Access();
        await FluentActions.Invoking(() => access.SetPasswordAsync("*admin*", "attack123")).Should().ThrowAsync<ArgumentException>();
        (await access.UnlockAsync("*admin*", "attack123")).Should().BeNull();
        (await access.UnlockAsync($"#campaign:{Guid.NewGuid():N}", "attack123")).Should().BeNull();
    }

    [TestMethod]
    public async Task ACampaignToken_OpensOnlyItsCampaign_AndTheDmOpensEvery()
    {
        var access = Access();
        var strahd = Guid.NewGuid();
        var other = Guid.NewGuid();
        var hash = PlayerAccess.HashPassword("barovia-mists");
        var token = access.IssueCampaignToken(strahd, hash);

        access.HasCampaignToken(token, strahd, hash).Should().BeTrue();
        access.HasCampaignToken(token, other, hash).Should().BeFalse();
        access.HasAdminToken(token).Should().BeFalse();
        (await access.CanActAsAsync(token, "Cara Vale")).Should().BeTrue(); // Cara has no password
        access.HasCampaignToken(access.UnlockAdmin(Master), other, PlayerAccess.HashPassword("x")).Should().BeTrue();
        access.UnlockAdmin("wrong").Should().BeNull();
    }

    [TestMethod]
    public void APartyHoldsTwentyCharacters_EachOnce()
    {
        var campaign = Campaign.Create("Curse of Strahd");
        var mira = Guid.NewGuid();
        campaign.Join(mira).Should().BeTrue();
        campaign.Join(mira).Should().BeTrue();
        campaign.Party.Should().HaveCount(1);
        for (var i = 0; i < 19; i++) campaign.Join(Guid.NewGuid());
        campaign.Join(Guid.NewGuid()).Should().BeFalse();
        campaign.Leave(mira);
        campaign.Party.Should().HaveCount(19);
    }

    [TestMethod]
    public void ADmToken_RunsOnlyItsCampaign_AndIsNotAPlayerOrViewerToken()
    {
        var access = Access();
        var mine = Guid.NewGuid();
        var other = Guid.NewGuid();
        var dmHash = PlayerAccess.HashPassword("dm-password");
        var dm = access.IssueCampaignDmToken(mine, dmHash);

        access.HasCampaignDmToken(dm, mine, dmHash).Should().BeTrue();
        access.HasCampaignDmToken(dm, other, dmHash).Should().BeFalse();
        access.HasAdminToken(dm).Should().BeFalse();
        // a campaign's password (viewer) token does not make anyone its DM, but the admin is DM everywhere
        access.HasCampaignDmToken(access.IssueCampaignToken(mine, dmHash), mine, dmHash).Should().BeFalse();
        access.HasCampaignDmToken(access.UnlockAdmin(Master), other, dmHash).Should().BeTrue();
        PlayerAccess.IsReservedName(PlayerAccess.CampaignDmTokenName(mine)).Should().BeTrue();
    }

    [TestMethod]
    public async Task APlayersToken_StopsWorking_WhenTheirPasswordChanges()
    {
        var players = new InMemoryPlayers();
        var access = Access(players);
        var (_, first) = await access.SetPasswordAsync("Ada Lark", "first-password");
        (await access.CanActAsAsync(first, "Ada Lark")).Should().BeTrue();
        (await access.UnlockAsync("Ada Lark", "first-password")).Should().NotBeNull();

        var (_, second) = await access.SetPasswordAsync("Ada Lark", "second-password");
        (await access.CanActAsAsync(first, "Ada Lark")).Should().BeFalse("a password change ends the old tokens");
        (await access.CanActAsAsync(second, "Ada Lark")).Should().BeTrue();
        (await access.CanActAsAsync(null, "Ada Lark")).Should().BeFalse();
        access.HasPlayerToken(second, "Ada Lark", players.Find("Ada Lark")!.PasswordHash!).Should().BeTrue();

        // the admin token is not tied to any player's password
        (await access.CanActAsAsync(access.UnlockAdmin(Master), "Ada Lark")).Should().BeTrue();
    }

    [TestMethod]
    public void AnOpenCampaignsToken_StopsWorking_OnceItGetsAPassword()
    {
        var access = Access();
        var campaign = Guid.NewGuid();
        var whileOpen = access.IssueCampaignToken(campaign, null);
        access.HasCampaignToken(whileOpen, campaign, null).Should().BeTrue();

        var hash = PlayerAccess.HashPassword("now-protected");
        access.HasCampaignToken(whileOpen, campaign, hash).Should().BeFalse();
        access.HasCampaignToken(access.IssueCampaignToken(campaign, hash), campaign, hash).Should().BeTrue();
        // and a new password ends the tokens of the one before
        access.HasCampaignToken(access.IssueCampaignToken(campaign, hash), campaign, PlayerAccess.HashPassword("another")).Should().BeFalse();
    }

    [TestMethod]
    public void ADmToken_StopsWorking_WhenTheDmPasswordChanges()
    {
        var access = Access();
        var campaign = Guid.NewGuid();
        var oldHash = PlayerAccess.HashPassword("old-dm-password");
        var token = access.IssueCampaignDmToken(campaign, oldHash);
        access.HasCampaignDmToken(token, campaign, PlayerAccess.HashPassword("new-dm-password")).Should().BeFalse();
    }

    [TestMethod]
    public void TheAdminToken_StopsWorking_WhenTheMasterPasswordChanges()
    {
        var before = Access(master: Master).UnlockAdmin(Master);
        Access(master: Master).HasAdminToken(before).Should().BeTrue();
        Access(master: "a-new-master-password").HasAdminToken(before).Should().BeFalse();
    }

    [TestMethod]
    public void UnlockTries_AreLimitedPerAccount_ForAMinute()
    {
        var time = new ManualTime();
        var limiter = new UnlockLimiter(time);
        for (var i = 0; i < UnlockLimiter.Attempts; i++)
        {
            limiter.TryAttempt(UnlockLimiter.Player("Ada Lark"), out _).Should().BeTrue();
        }
        limiter.TryAttempt(UnlockLimiter.Player(" ada lark "), out var wait).Should().BeFalse("the name is the same account");
        wait.Should().BePositive();
        limiter.TryAttempt(UnlockLimiter.Player("Cara Vale"), out _).Should().BeTrue("another account has its own tries");

        time.Advance(UnlockLimiter.Window);
        limiter.TryAttempt(UnlockLimiter.Player("Ada Lark"), out _).Should().BeTrue();
    }

    private sealed class ManualTime : TimeProvider
    {
        private DateTimeOffset _now = new(2026, 10, 15, 12, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow() => _now;
        public void Advance(TimeSpan by) => _now += by;
    }

    private sealed class FakePersistence(InMemoryPlayers players) : IPersistence
    {
        public T GetRepository<T>() where T : IRepository => players is T repository ? repository : throw new NotSupportedException(typeof(T).Name);
        public Task<int> SaveChangesAsync() => Task.FromResult(0);
        public void Dispose() { }
    }

    private sealed class InMemoryPlayers : IPlayersRepository
    {
        private readonly List<Player> _players = [];
        public Player? Find(string name) => _players.SingleOrDefault(p => string.Equals(p.Name, name.Trim(), StringComparison.OrdinalIgnoreCase));
        public void Add(Player player) => _players.Add(player);
        public Task<Player?> GetPlayerAsync(string name) => Task.FromResult(Find(name));
        public Task<List<string>> GetLockedPlayerNamesAsync() => Task.FromResult(_players.Where(p => p.PasswordHash is not null).Select(p => p.Name).ToList());
        public Task<List<KeyValuePair<string, string>>> GetLockedPlayerHashesAsync() =>
            Task.FromResult(_players.Where(p => p.PasswordHash is not null).Select(p => new KeyValuePair<string, string>(p.Name, p.PasswordHash!)).ToList());
        public Task<string?> GetCharacterPlayerNameAsync(Guid characterId) => Task.FromResult<string?>(null);
        public void SetPersistenceContext(IPersistenceContext persistenceContext) { }
    }
}
