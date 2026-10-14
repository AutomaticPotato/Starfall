using System.Text.Json.Nodes;
using System.Xml.Linq;

namespace Starlights.Modules.Elements.Services.FiveETools;

/// <summary>The rules 5etools records as data, as Aurora rules: prerequisites, proficiencies, languages, ability scores and spells.</summary>
internal sealed partial class FiveEToolsContent
{
    /// <summary>
    /// A 5etools prerequisite (alternatives, each a set of conditions) as words and as an Aurora requirements expression.
    /// Conditions the builder cannot check (a campaign, "the ability to cast a spell that deals damage") stay words only:
    /// they count as met, so the player and the DM decide.
    /// </summary>
    private (string? Text, string? Requirements) Prerequisite(JsonNode? prerequisites, bool modern, string? unlocker = null)
    {
        if (prerequisites is not JsonArray alternatives || alternatives.Count == 0)
        {
            return (null, null);
        }

        var texts = new List<string>();
        var expressions = new List<string>();
        var allCheckable = true;
        foreach (var alternative in alternatives.OfType<JsonObject>())
        {
            var words = new List<string>();
            var terms = new List<string>();
            foreach (var (key, value) in alternative)
            {
                switch (key)
                {
                    case "level" when value is JsonValue v && v.TryGetValue<int>(out var level):
                        words.Add($"Level {level}+");
                        terms.Add($"[character:{level}]");
                        break;
                    case "level" when value is JsonObject l && FiveEToolsJson.Int(l, "level") is { } classLevel:
                        var className = FiveEToolsJson.Str(l["class"], "name");
                        words.Add(className is null ? $"Level {classLevel}+" : $"Level {classLevel}+ {className}");
                        terms.Add(className is null ? $"[character:{classLevel}]" : $"[level:{className.ToLowerInvariant().Replace(' ', '-')}:{classLevel}]");
                        break;
                    case "ability" when value is JsonArray abilities:
                        // each object is an alternative; the scores within one are all needed
                        var groups = abilities.OfType<JsonObject>().Select(a => a.ToList()).Where(g => g.Count > 0).ToList();
                        if (groups.Count > 0)
                        {
                            words.Add(string.Join(" or ", groups.Select(g => string.Join(" and ", g.Select(o => $"{FiveEToolsText.AbilityName(o.Key)} {o.Value}+")))));
                            var parts = groups.Select(g => g.Count == 1 ? $"[{g[0].Key}:{g[0].Value}]" : $"({string.Join(",", g.Select(o => $"[{o.Key}:{o.Value}]"))})").ToList();
                            terms.Add(parts.Count == 1 ? parts[0] : $"({string.Join("||", parts)})");
                        }
                        break;
                    case "spellcasting":
                        // the 2014 books' "the ability to cast at least one spell": any spell, a species' cantrip too
                        words.Add("The Ability to Cast at Least One Spell");
                        terms.Add("[type:spell]");
                        break;
                    case "spellcasting2020" or "spellcastingFeature" or "spellcastingPrepared":
                        words.Add("Spellcasting or Pact Magic Feature");
                        var casting = new[] { "ID_INTERNAL_GRANTS_SPELLCASTING_FEATURE", "ID_INTERNAL_GRANTS_PACT_MAGIC_FEATURE" }.Where(_aurora.Exists).ToList();
                        if (casting.Count > 0)
                        {
                            terms.Add($"({string.Join("||", casting)})");
                        }
                        break;
                    case "feature" when value is JsonArray features:
                        foreach (var feature in features.Select(f => f?.ToString()).OfType<string>())
                        {
                            words.Add($"{feature} Feature");
                            if (feature.Equals("Fighting Style", StringComparison.OrdinalIgnoreCase) && _aurora.Exists("ID_INTERNAL_GRANTS_FIGHTING_STYLE_FEATURE"))
                            {
                                terms.Add("ID_INTERNAL_GRANTS_FIGHTING_STYLE_FEATURE");
                            }
                        }
                        break;
                    case "race" when value is JsonArray races:
                        var raceNames = races.OfType<JsonObject>().Select(r => FiveEToolsJson.Str(r, "displayEntry") ?? Title(FiveEToolsJson.Str(r, "name") ?? "")).ToList();
                        words.Add(string.Join(" or ", raceNames));
                        var raceIds = races.OfType<JsonObject>().Select(r => Find("Race", FiveEToolsJson.Str(r, "name") ?? "", modern: modern)).OfType<string>().Distinct().ToList();
                        if (raceIds.Count > 0)
                        {
                            terms.Add($"({string.Join("||", raceIds)})");
                        }
                        break;
                    case "feat" when value is JsonArray feats:
                        foreach (var feat in feats.Select(f => f?.ToString()).OfType<string>())
                        {
                            var name = FeatName(feat.Split('|')[0]);
                            words.Add($"{name} Feat");
                            if (Find("Feat", name, feat.Split('|').ElementAtOrDefault(1)?.ToUpperInvariant(), modern) is { } featId)
                            {
                                terms.Add(featId);
                            }
                        }
                        break;
                    case "proficiency" when value is JsonArray proficiencies:
                        foreach (var proficiency in proficiencies.OfType<JsonObject>().SelectMany(p => p))
                        {
                            var kind = proficiency.Value?.ToString() ?? "";
                            words.Add($"{Title(kind)} {(proficiency.Key == "armor" ? "Armor" : "Weapon")} Training");
                            var ids = proficiency.Key == "armor" ? (_aurora.Armor(kind) is { } armor ? [armor] : []) : _aurora.AnyWeaponOf(kind);
                            if (ids.Count > 0)
                            {
                                terms.Add(ids.Count == 1 ? ids[0] : $"({string.Join("||", ids)})");
                            }
                        }
                        break;
                    case "campaign" when value is JsonArray campaigns:
                        words.Add($"{string.Join(" or ", campaigns.Select(c => c?.ToString()))} Campaign");
                        break;
                    case "background" when value is JsonArray backgrounds:
                        var backgroundNames = backgrounds.OfType<JsonObject>().Select(b => FiveEToolsJson.Str(b, "name") ?? "").ToList();
                        words.Add($"{string.Join(" or ", backgroundNames.Select(Title))} Background");
                        var backgroundIds = backgroundNames.SelectMany(n => _aurora.Find("Background", n).Select(b => b.Id)).Distinct().ToList();
                        if (backgroundIds.Count > 0)
                        {
                            terms.Add($"({string.Join("||", backgroundIds)})");
                        }
                        break;
                    case "otherSummary" when value is JsonObject summary:
                        words.Add(FiveEToolsRenderer.PlainText(FiveEToolsJson.Str(summary, "entrySummary") ?? FiveEToolsJson.Str(summary, "entry") ?? ""));
                        break;
                    case "other" when value is JsonValue other:
                        words.Add(FiveEToolsRenderer.PlainText(other.ToString()));
                        break;
                    case "spell" when value is JsonArray spells:
                        words.AddRange(spells.Select(s => s is JsonObject o
                            ? FiveEToolsJson.Str(o, "entrySummary") ?? FiveEToolsJson.Str(o, "entry") ?? ""
                            : FiveEToolsRenderer.PlainText(s?.ToString().Split('|')[0].Split('#')[0] ?? "")));
                        break;
                    case "pact" when value is JsonValue pact:
                        words.Add($"Pact of the {pact}");
                        if (Find("Class Feature", $"Pact of the {pact}", modern: modern) is { } pactId)
                        {
                            terms.Add(pactId);
                        }
                        break;
                    case "patron" when value is JsonValue patron:
                        words.Add($"{patron} Patron");
                        break;
                }
            }
            texts.Add(string.Join(", ", words.Where(w => w.Length > 0)));
            if (terms.Count == 0)
            {
                allCheckable = false;
            }
            expressions.Add(terms.Count == 1 ? terms[0] : $"({string.Join(",", terms)})");
        }

        var text = string.Join("; or ", texts.Where(t => t.Length > 0));
        // an alternative with nothing to check would make the whole prerequisite always met
        string? requirements = allCheckable && expressions.Count > 0 ? string.Join("||", expressions) : null;
        if (requirements is not null && unlocker is not null && _aurora.Exists(unlocker))
        {
            requirements = $"({requirements})||{unlocker}";
        }
        return (text.Length > 0 ? text : null, requirements);
    }

    private static string Title(string text) =>
        string.Join(' ', text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(w => char.ToUpperInvariant(w[0]) + w[1..]));

    /// <summary>"magic initiate; cleric" (5etools) is Aurora's "Magic Initiate (Cleric)".</summary>
    private static string FeatName(string reference)
    {
        var parts = reference.Split(';', 2, StringSplitOptions.TrimEntries);
        return parts.Length == 2 ? $"{Title(parts[0])} ({Title(parts[1])})" : Title(parts[0]);
    }

    /// <summary>Skill, tool, language, armor, weapon and saving throw proficiencies and expertise, as grants and choices.</summary>
    private void Proficiencies(XElement rules, JsonObject entry, string owner, bool modern, string? requirements = null)
    {
        Choices(rules, entry["skillProficiencies"], "Skill Proficiency", owner, requirements,
            name => _aurora.Skill(name), any => any is "any" or "anySkill" ? "Skill" : null);
        Choices(rules, entry["toolProficiencies"], "Tool Proficiency", owner, requirements,
            name => _aurora.Tool(name) ?? _aurora.Tool(Title(name)), ToolGroup);
        Choices(rules, entry["languageProficiencies"], "Language", owner, requirements,
            name => name is "other" ? null : _aurora.Language(Title(name), modern), LanguageGroup, type: "Language");
        Choices(rules, entry["skillToolLanguageProficiencies"], "Skill or Tool Proficiency", owner, requirements,
            name => _aurora.Skill(name) ?? _aurora.Tool(name), any => any switch
            {
                "anySkill" => "Skill",
                "anyTool" => "Tool",
                _ => ToolGroup(any),
            });
        Choices(rules, entry["armorProficiencies"], "Armor Training", owner, requirements, name => _aurora.Armor(name), _ => null);
        Choices(rules, entry["weaponProficiencies"], "Weapon Proficiency", owner, requirements,
            name => _aurora.Weapon(name.Split('|')[0]), _ => null);
        Choices(rules, entry["savingThrowProficiencies"], "Saving Throw Proficiency", owner, requirements, name => _aurora.SavingThrow(name), _ => null);

        // expertise in a skill the character is proficient in
        if (entry["expertise"] is JsonArray expertise && expertise.FirstOrDefault() is JsonObject first)
        {
            var count = first.Select(p => p.Value is JsonValue v && v.TryGetValue<int>(out var n) ? n : 1).Sum();
            var skills = _aurora.Elements.Where(e => e.Id.StartsWith("ID_INTERNAL_PROFICIENCY_SKILL_EXPERTISE_", StringComparison.Ordinal)).Select(e => e.Id).Order(StringComparer.Ordinal).ToList();
            if (skills.Count > 0)
            {
                rules.Add(Select("Proficiency", $"Skill Expertise ({owner})", string.Join("|", skills), Math.Max(1, count), requirements: requirements));
            }
        }
    }

    private string? ToolGroup(string any) => any switch
    {
        "any" or "anyTool" => "Tool",
        "anyArtisansTool" => "Artisan tools",
        "anyMusicalInstrument" => "Musical Instrument",
        "anyGamingSet" => "Gaming Set",
        _ => null,
    };

    private static string? LanguageGroup(string any) => any switch
    {
        "anyStandard" => "Standard",
        "anyExotic" => "Exotic",
        "anyRare" => "Exotic",
        "any" => "Standard||Exotic",
        _ => null,
    };

    /// <summary>
    /// One 5etools proficiency list (the first of its alternatives): named ones granted, "choose from" as a choice of
    /// those, "any N" as a choice from a group.
    /// </summary>
    private static void Choices(XElement rules, JsonNode? node, string label, string owner, string? requirements,
        Func<string, string?> idOf, Func<string, string?> groupOf, string type = "Proficiency")
    {
        if (node is not JsonArray alternatives || alternatives.FirstOrDefault() is not JsonObject set)
        {
            return;
        }
        foreach (var (key, value) in set)
        {
            if (key == "choose" && value is JsonObject choose)
            {
                var count = FiveEToolsJson.Int(choose, "count") ?? 1;
                var from = choose["from"] is JsonArray f ? f.Select(x => x?.ToString() ?? "").ToList() : [];
                var ids = from.Select(idOf).OfType<string>().ToList();
                var groups = from.Select(groupOf).OfType<string>().ToList();
                var supports = string.Join("||", groups.Concat(ids.Count > 0 ? [string.Join("|", ids)] : []));
                if (supports.Length > 0)
                {
                    rules.Add(Select(type, $"{label} ({owner})", supports, count, requirements: requirements));
                }
                continue;
            }
            if (value is JsonValue v && v.TryGetValue<int>(out var number) && groupOf(key) is { } group)
            {
                rules.Add(Select(type, $"{label} ({owner})", group, number, requirements: requirements));
                continue;
            }
            if (value is JsonValue b && b.TryGetValue<bool>(out var granted) && granted && idOf(key) is { } id)
            {
                rules.Add(Grant(type, id, requirements: requirements));
            }
        }
    }

    /// <summary>Ability score increases: fixed ones as stats, "choose" as a choice of +1s (Aurora's generic ones).</summary>
    private void AbilityScores(XElement rules, JsonNode? node, string owner)
    {
        if (node is not JsonArray alternatives || alternatives.FirstOrDefault() is not JsonObject set)
        {
            return;
        }
        foreach (var (key, value) in set)
        {
            if (key == "choose" && value is JsonObject choose && choose["from"] is JsonArray from)
            {
                var count = (FiveEToolsJson.Int(choose, "count") ?? 1) * (FiveEToolsJson.Int(choose, "amount") ?? 1);
                var ids = from.Select(a => $"ID_INTERNAL_ABILITY_SCORE_IMPROVEMENT_FEAT_{FiveEToolsText.AbilityName(a?.ToString() ?? "").ToUpperInvariant()}")
                    .Where(_aurora.Exists).ToList();
                if (ids.Count > 0)
                {
                    rules.Add(Select("Ability Score Improvement", $"Ability Score Increase ({owner})", string.Join("|", ids), count));
                }
            }
            else if (FiveEToolsText.Abilities.Contains(key) && value is JsonValue v && v.TryGetValue<int>(out var amount))
            {
                rules.Add(Stat(FiveEToolsText.AbilityName(key).ToLowerInvariant(), amount.ToString()));
            }
        }
    }

    /// <summary>
    /// Spells a feat, species or background gives (5etools' additionalSpells, the first of its alternatives): named
    /// spells granted at their level, and "a level 1 Cleric spell" kinds of choices as spell choices.
    /// </summary>
    private void AdditionalSpells(XElement rules, JsonNode? node, string owner, bool modern)
    {
        if (node is not JsonArray alternatives || alternatives.FirstOrDefault() is not JsonObject set)
        {
            return;
        }
        foreach (var part in new[] { "known", "innate", "prepared" })
        {
            foreach (var (level, spells) in Levels(set[part]))
            {
                foreach (var spell in spells)
                {
                    if (spell is JsonValue v && v.TryGetValue<string>(out var reference))
                    {
                        if (SpellId(reference, modern) is { } id)
                        {
                            rules.Add(Grant("Spell", id, level));
                        }
                    }
                    else if (spell is JsonObject choice && FiveEToolsJson.Str(choice, "choose") is { } filter && SpellSupports(filter) is { } supports)
                    {
                        rules.Add(Select("Spell", $"Spell ({owner})", supports, FiveEToolsJson.Int(choice, "count") ?? 1, level));
                    }
                }
            }
        }
    }

    // "level=0|class=Wizard" → Aurora's "0,Wizard"; filters it cannot express (a school) are left out
    private static string? SpellSupports(string filter)
    {
        var parts = filter.Split('|').Select(p => p.Split('=', 2)).Where(p => p.Length == 2).ToDictionary(p => p[0].ToLowerInvariant(), p => p[1]);
        var terms = new List<string>();
        if (parts.TryGetValue("level", out var levels))
        {
            var list = levels.Split(';');
            terms.Add(list.Length == 1 ? list[0] : $"({string.Join("||", list)})");
        }
        if (parts.TryGetValue("class", out var classes))
        {
            var list = classes.Split(';').Select(Title).ToList();
            terms.Add(list.Count == 1 ? list[0] : $"({string.Join("||", list)})");
        }
        return terms.Count > 0 ? string.Join(",", terms) : null;
    }

    /// <summary>A 5etools by-level map ({"1": [...], "3": [...]}, "_" for always, or nested daily/rest) as (level, spells).</summary>
    private static IEnumerable<(int Level, List<JsonNode?> Spells)> Levels(JsonNode? node)
    {
        if (node is not JsonObject byLevel)
        {
            yield break;
        }
        foreach (var (key, value) in byLevel)
        {
            var level = int.TryParse(key, out var l) ? l : key is "_" ? 1 : 0;
            if (level == 0 && key is not "_")
            {
                continue;
            }
            switch (value)
            {
                case JsonArray spells:
                    yield return (level, spells.ToList());
                    break;
                case JsonObject nested:
                    // {"daily": {"1": [...]}} or {"rest": {...}}
                    foreach (var inner in nested.Select(n => n.Value).OfType<JsonObject>())
                    {
                        foreach (var spells in inner.Select(i => i.Value).OfType<JsonArray>())
                        {
                            yield return (level, spells.ToList());
                        }
                    }
                    foreach (var spells in nested.Select(n => n.Value).OfType<JsonArray>())
                    {
                        yield return (level, spells.ToList());
                    }
                    break;
            }
        }
    }
}
