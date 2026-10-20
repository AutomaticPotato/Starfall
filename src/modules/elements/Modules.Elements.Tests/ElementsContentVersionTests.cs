using System.Transactions;
using AwesomeAssertions;
using Starlights.Modules.Elements.Services.Items;

namespace Starlights.Modules.Elements.Tests;

// the version is process-wide and imports in other tests bump it, so these run on their own
[TestClass]
[DoNotParallelize]
public class ElementsContentVersionTests
{
    [TestMethod]
    public void WithoutTransaction_BumpsRightAway()
    {
        var before = ElementsContentVersion.Current;
        ElementsContentVersion.BumpWhenCommitted();
        ElementsContentVersion.Current.Should().Be(before + 1);
    }

    [TestMethod]
    public void InATransaction_BumpsOnlyOnceItCommits()
    {
        var before = ElementsContentVersion.Current;
        using (var scope = new TransactionScope())
        {
            ElementsContentVersion.BumpWhenCommitted();
            ElementsContentVersion.Current.Should().Be(before, "a cache rebuilt now would read the old content");
            scope.Complete();
            ElementsContentVersion.Current.Should().Be(before, "Complete() does not commit yet; disposing does");
        }
        ElementsContentVersion.Current.Should().Be(before + 1);
    }

    [TestMethod]
    public void InATransactionThatRollsBack_DoesNotBump()
    {
        var before = ElementsContentVersion.Current;
        using (new TransactionScope())
        {
            ElementsContentVersion.BumpWhenCommitted();
        }
        ElementsContentVersion.Current.Should().Be(before);
    }
}
