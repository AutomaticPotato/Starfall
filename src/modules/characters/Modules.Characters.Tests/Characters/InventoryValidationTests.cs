using AwesomeAssertions;
using Starlights.Modules.Characters.Domain.Characters;

namespace Starlights.Modules.Characters.Tests.Characters;

[TestClass]
public class InventoryValidationTests
{
    private static InventoryItem Item(string id, string? container = null) => new() { Id = id, ElementId = Guid.NewGuid(), ContainerId = container };

    [TestMethod]
    public void AValidInventory_HasNoProblem()
    {
        var inventory = new CharacterInventory
        {
            Items = [Item("backpack"), Item("rope", "backpack"), Item("bag", "backpack"), Item("gem", "bag"), new() { Id = "own", Name = "Grandmother's locket" }],
            Coins = new() { ["gp"] = 15, ["sp"] = 3 },
        };

        inventory.Validate().Should().BeNull();
    }

    [TestMethod]
    public void AHomebrewItem_NeedsAName()
    {
        new CharacterInventory { Items = [new() { Id = "x" }] }.Validate().Should().Be("A homebrew item needs a name.");
    }

    [TestMethod]
    public void AContainerThatIsNotThere_IsRefused()
    {
        new CharacterInventory { Items = [Item("rope", "gone")] }.Validate().Should().Contain("not in the inventory");
    }

    [TestMethod]
    public void AnItemInAMissingContainersContainer_IsRefusedWithoutFailing()
    {
        new CharacterInventory { Items = [Item("gem", "bag"), Item("bag", "gone")] }.Validate().Should().Contain("not in the inventory");
    }

    [TestMethod]
    [DataRow("a", "a")]
    [DataRow("a", "b")]
    public void ContainersInsideThemselves_AreRefused(string first, string second)
    {
        var inventory = new CharacterInventory { Items = [Item("a", second == "a" ? "a" : "b"), Item("b", first == "a" && second == "b" ? "a" : null)] };

        inventory.Validate().Should().Be("Containers cannot be inside themselves.");
    }

    [TestMethod]
    public void UnknownCoins_AndDuplicateIds_AreRefused()
    {
        new CharacterInventory { Coins = new() { ["zp"] = 1 } }.Validate().Should().StartWith("Coins are");
        new CharacterInventory { Items = [Item("a"), Item("a")] }.Validate().Should().Be("Two items have the same id.");
    }

    [TestMethod]
    public void OutOfRangeValues_AreRefused()
    {
        new CharacterInventory { Items = [Item("a") with { Quantity = -1 }] }.Validate().Should().Contain("out of range");
        new CharacterInventory { Items = [Item("a") with { Custom = new() { Weight = -3 } }] }.Validate().Should().Contain("out of range");
    }

    [TestMethod]
    public void AnAttackPlace_IsWithinTheList()
    {
        new CharacterInventory { Items = [Item("sword") with { Attack = 1 }] }.Validate().Should().BeNull();
        new CharacterInventory { Items = [Item("sword") with { Attack = 0 }] }.Validate().Should().NotBeNull();
        new CharacterInventory { Items = [Item("sword") with { Attack = 101 }] }.Validate().Should().NotBeNull();
    }

    // an artificer's armor attack added by hand in Aurora (Manage → Attacks): no item stands behind it
    private static CustomAttack ArmorAttack(string id = "a1") => new()
    {
        Id = id, Name = "Thunder Gauntlets", Range = "5 ft", ToHit = "+6 vs AC", Damage = "1d8+3 thunder", Ability = "Intelligence", Place = 2,
    };

    [TestMethod]
    public void ACustomAttack_WithoutAnItem_IsValid()
    {
        new CharacterInventory { Items = [Item("sword") with { Attack = 1 }], CustomAttacks = [ArmorAttack()] }.Validate().Should().BeNull();
        new CharacterInventory { CustomAttacks = [] }.Validate().Should().BeNull();
    }

    [TestMethod]
    public void CustomAttacks_NeedANameAnIdOfTheirOwnAndSensibleSizes()
    {
        new CharacterInventory { CustomAttacks = [ArmorAttack() with { Name = " " }] }.Validate().Should().Contain("without a name");
        new CharacterInventory { CustomAttacks = [ArmorAttack(), ArmorAttack()] }.Validate().Should().Contain("its own id");
        new CharacterInventory { CustomAttacks = [ArmorAttack("")] }.Validate().Should().Contain("Thunder Gauntlets");
        new CharacterInventory { CustomAttacks = [ArmorAttack() with { Damage = new string('d', 201) }] }.Validate().Should().NotBeNull();
        new CharacterInventory { CustomAttacks = [ArmorAttack() with { Place = 0 }] }.Validate().Should().NotBeNull();
        new CharacterInventory { CustomAttacks = [.. Enumerable.Range(0, 101).Select(i => ArmorAttack($"a{i}"))] }.Validate().Should().StartWith("At most 100 attacks");
    }

    [TestMethod]
    public void ASaveThatLeavesCustomAttacksOut_KeepsTheStoredOnes_AndAnEmptyListRemovesThem()
    {
        var stored = new CharacterInventory { CustomAttacks = [ArmorAttack()] };
        var web = new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web);

        // the body of a client that does not know custom attacks (the Equipment tab of an older app)
        var older = System.Text.Json.JsonSerializer.Deserialize<CharacterInventory>("""{"revision":3,"items":[],"coins":{"gp":4}}""", web)!;
        older.CustomAttacks.Should().BeNull("a missing field must be told apart from an empty list");
        older.KeepingCustomAttacksOf(stored).CustomAttacks.Should().Equal(stored.CustomAttacks);
        older.KeepingCustomAttacksOf(stored).Coins["gp"].Should().Be(4);

        var cleared = System.Text.Json.JsonSerializer.Deserialize<CharacterInventory>("""{"revision":3,"items":[],"coins":{},"customAttacks":[]}""", web)!;
        cleared.KeepingCustomAttacksOf(stored).CustomAttacks.Should().BeEmpty();

        var edited = new CharacterInventory { CustomAttacks = [ArmorAttack() with { Damage = "2d8+3 thunder" }] };
        edited.KeepingCustomAttacksOf(stored).CustomAttacks!.Single().Damage.Should().Be("2d8+3 thunder");
    }
    [TestMethod]
    public void AttackEditAndDeletionMetadata_RoundTrips_AndOlderClientsKeepDeletions()
    {
        var inventory = new CharacterInventory
        {
            CustomAttacks = [ArmorAttack() with { Edited = true }],
            RemovedAttackIds = ["deleted-aurora-attack"]
        };
        var web = new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web);
        var json = System.Text.Json.JsonSerializer.Serialize(inventory, web);
        var restored = System.Text.Json.JsonSerializer.Deserialize<CharacterInventory>(json, web)!;
        restored.CustomAttacks!.Single().Edited.Should().BeTrue();
        (new CharacterInventory { CustomAttacks = [ArmorAttack()] }).KeepingCustomAttacksOf(restored).CustomAttacks!.Single().Edited.Should().BeTrue();
        restored.RemovedAttackIds.Should().Equal("deleted-aurora-attack");
        new CharacterInventory().KeepingCustomAttacksOf(restored).RemovedAttackIds.Should().Equal(restored.RemovedAttackIds);
        (new CharacterInventory { RemovedAttackIds = [] }).KeepingCustomAttacksOf(restored).RemovedAttackIds.Should().BeEmpty();
        (inventory with { RemovedAttackIds = [new string('x', 65)] }).Validate().Should().NotBeNull();
    }
}
