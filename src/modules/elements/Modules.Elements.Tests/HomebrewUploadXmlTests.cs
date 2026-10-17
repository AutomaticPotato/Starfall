using System.Xml.Linq;
using AwesomeAssertions;
using Starlights.Modules.Elements.Integration;

namespace Starlights.Modules.Elements.Tests;

[TestClass]
public class HomebrewUploadXmlTests
{
    [TestMethod]
    [DataRow("<elements><append id='ID_EXISTING'><supports>Extra</supports></append></elements>")]
    [DataRow("<elements><element id='ID_NEW' name='New' type='Feat'/><append id='ID_EXISTING'/></elements>")]
    [DataRow("<elements><element id='ID_NEW' name='New' type='Feat'/></elements>")]
    public void Upload_AcceptsDefinitionsAndAppendOnlyFiles(string xml) =>
        HomebrewUploadXml.Validate(XDocument.Parse(xml)).Should().BeNull();

    [TestMethod]
    [DataRow("<elements><append/></elements>", "non-empty id")]
    [DataRow("<elements><append id=' '/></elements>", "non-empty id")]
    [DataRow("<elements><element id='ID_NEW' name='New' type='Feat'/><append/></elements>", "non-empty id")]
    [DataRow("<elements><element id='' name='New' type='Feat'/></elements>", "id, name and type")]
    [DataRow("<elements/>", "no element definitions")]
    [DataRow("<character/>", "one <elements> root")]
    [DataRow("<append id='ID_EXISTING'/>", "one <elements> root")]
    public void Upload_ExplainsInvalidStructure(string xml, string message) =>
        HomebrewUploadXml.Validate(XDocument.Parse(xml)).Should().Contain(message);

    [TestMethod]
    public void Listing_IdentifiesDistinctAppendTargets() =>
        HomebrewUploadXml.AppendTargets(XDocument.Parse("<elements><append id='ONE'/><append id='ONE'/><append id='TWO'/></elements>"))
            .Should().Equal("ONE", "TWO");
}
