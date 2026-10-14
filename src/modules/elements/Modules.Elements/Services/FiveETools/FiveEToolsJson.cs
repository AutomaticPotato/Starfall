using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Starlights.Modules.Elements.Services.FiveETools;

/// <summary>
/// Reads the 5etools data files as editable JSON, with entries written as "a copy of another entry, with these
/// edits" (5etools' <c>_copy</c> with <c>_mod</c>, which newer books use for species and backgrounds) resolved into
/// whole entries.
/// </summary>
internal sealed class FiveEToolsJson
{
    private readonly string _dataPath;

    public FiveEToolsJson(string dataPath) => _dataPath = dataPath;

    /// <summary>The entries under <paramref name="key"/> of every file matching the pattern (e.g. "class/class-*.json").</summary>
    public List<JsonObject> Load(string pattern, string key)
    {
        var folder = Path.Combine(_dataPath, Path.GetDirectoryName(pattern) ?? "");
        if (!Directory.Exists(folder))
        {
            return [];
        }
        var entries = new List<JsonObject>();
        foreach (var file in Directory.EnumerateFiles(folder, Path.GetFileName(pattern)).Order(StringComparer.Ordinal))
        {
            if (Path.GetFileName(file).StartsWith("fluff-", StringComparison.Ordinal))
            {
                continue;
            }
            using var stream = File.OpenRead(file);
            if (JsonNode.Parse(stream) is JsonObject root && root[key] is JsonArray array)
            {
                entries.AddRange(array.OfType<JsonObject>());
            }
        }
        return ResolveCopies(entries);
    }

    public JsonObject? LoadObject(string file)
    {
        var path = Path.Combine(_dataPath, file);
        if (!File.Exists(path))
        {
            return null;
        }
        using var stream = File.OpenRead(path);
        return JsonNode.Parse(stream) as JsonObject;
    }

    // what a copy never takes over from the entry it copies
    private static readonly string[] NotCopied = ["reprintedAs", "srd", "srd52", "basicRules", "basicRules2024", "otherSources", "page", "hasFluff", "hasFluffImages", "_versions", "additionalSources"];

    private static List<JsonObject> ResolveCopies(List<JsonObject> entries)
    {
        var byKey = entries.GroupBy(KeyOf).ToDictionary(g => g.Key, g => g.First());
        var resolved = new Dictionary<JsonObject, JsonObject>(ReferenceEqualityComparer.Instance);

        JsonObject Resolve(JsonObject entry, int depth)
        {
            if (resolved.TryGetValue(entry, out var done))
            {
                return done;
            }
            if (entry["_copy"] is not JsonObject copy || depth > 10)
            {
                return resolved[entry] = entry;
            }
            var baseKey = $"{Str(copy, "name")}|{Str(copy, "source")}".ToLowerInvariant();
            if (!byKey.TryGetValue(baseKey, out var baseEntry))
            {
                return resolved[entry] = entry;
            }
            var result = (JsonObject)Resolve(baseEntry, depth + 1).DeepClone();
            foreach (var key in NotCopied)
            {
                result.Remove(key);
            }
            foreach (var (key, value) in entry)
            {
                if (key != "_copy")
                {
                    result[key] = value?.DeepClone();
                }
            }
            if (copy["_mod"] is JsonObject mods)
            {
                ApplyMods(result, mods);
            }
            // which entry it copies: 5etools' 2014 subclasses on the 2024 classes are such copies
            result["_copiedFrom"] = baseKey;
            return resolved[entry] = result;
        }

        return entries.Select(e => Resolve(e, 0)).ToList();
    }

    private static string KeyOf(JsonObject entry) => $"{Str(entry, "name")}|{Str(entry, "source")}".ToLowerInvariant();

    /// <summary>5etools' edits: replace, add, insert or remove items of a list, or replace words in the text.</summary>
    internal static void ApplyMods(JsonObject target, JsonObject mods)
    {
        foreach (var (property, value) in mods)
        {
            var list = value is JsonArray many ? many.OfType<JsonObject>().ToList() : value is JsonObject one ? [one] : [];
            foreach (var mod in list)
            {
                if (property == "*")
                {
                    if (Str(mod, "mode") == "replaceTxt")
                    {
                        foreach (var key in target.Select(p => p.Key).ToList())
                        {
                            target[key] = ReplaceText(target[key], mod);
                        }
                    }
                    continue;
                }
                ApplyMod(target, property, mod);
            }
        }
    }

    private static void ApplyMod(JsonObject target, string property, JsonObject mod)
    {
        var items = mod["items"] is JsonArray a ? a.Select(i => i?.DeepClone()).ToList() : mod["items"] is { } single ? [single.DeepClone()] : [];
        if (target[property] is not JsonArray array)
        {
            if (Str(mod, "mode") is "appendArr" or "prependArr" or "insertArr" or "replaceOrAppendArr")
            {
                target[property] = array = [];
            }
            else if (Str(mod, "mode") == "replaceTxt" && target[property] is { } node)
            {
                target[property] = ReplaceText(node, mod);
                return;
            }
            else
            {
                return;
            }
        }

        int IndexOf(JsonNode? match) => match switch
        {
            JsonValue v when v.TryGetValue<string>(out var name) => array.ToList().FindIndex(i =>
                i is JsonObject o ? string.Equals(Str(o, "name"), name, StringComparison.OrdinalIgnoreCase) : i?.ToString() == name),
            JsonObject o when o["index"] is JsonValue index && index.TryGetValue<int>(out var at) => at,
            _ => -1,
        };

        switch (Str(mod, "mode"))
        {
            case "appendArr":
                items.ForEach(array.Add);
                break;
            case "prependArr":
                for (var i = items.Count - 1; i >= 0; i--)
                {
                    array.Insert(0, items[i]);
                }
                break;
            case "insertArr":
                var insertAt = Math.Clamp(mod["index"]?.GetValue<int>() ?? array.Count, 0, array.Count);
                for (var i = items.Count - 1; i >= 0; i--)
                {
                    array.Insert(insertAt, items[i]);
                }
                break;
            case "replaceArr":
            case "replaceOrAppendArr":
                var at = IndexOf(mod["replace"]);
                if (at < 0)
                {
                    if (Str(mod, "mode") == "replaceOrAppendArr")
                    {
                        items.ForEach(array.Add);
                    }
                    break;
                }
                array.RemoveAt(at);
                for (var i = items.Count - 1; i >= 0; i--)
                {
                    array.Insert(at, items[i]);
                }
                break;
            case "removeArr":
                var names = mod["names"] is JsonArray n ? n.Select(x => x?.ToString()).ToList() : mod["names"] is { } one ? [one.ToString()] : [];
                foreach (var name in names)
                {
                    var index = IndexOf(JsonValue.Create(name));
                    if (index >= 0)
                    {
                        array.RemoveAt(index);
                    }
                }
                break;
            case "replaceTxt":
                target[property] = ReplaceText(array, mod);
                break;
        }
    }

    private static JsonNode? ReplaceText(JsonNode? node, JsonObject mod)
    {
        var find = Str(mod, "replace");
        if (string.IsNullOrEmpty(find) || node is null)
        {
            return node;
        }
        var with = Str(mod, "with") ?? "";
        var flags = Str(mod, "flags") ?? "";
        var regex = new Regex(find, flags.Contains('i') ? RegexOptions.IgnoreCase : RegexOptions.None);
        return Walk(node.DeepClone());

        JsonNode? Walk(JsonNode? n) => n switch
        {
            JsonValue v when v.TryGetValue<string>(out var s) => JsonValue.Create(regex.Replace(s, with)),
            JsonArray arr => new JsonArray(arr.Select(i => Walk(i?.DeepClone())).ToArray()),
            JsonObject obj => Rebuild(obj),
            _ => n,
        };

        JsonObject Rebuild(JsonObject obj)
        {
            var copy = new JsonObject();
            foreach (var (key, value) in obj)
            {
                copy[key] = key is "entries" or "items" or "entry" ? Walk(value?.DeepClone()) : value?.DeepClone();
            }
            return copy;
        }
    }

    public static string? Str(JsonNode? node, string property) =>
        node is JsonObject o && o[property] is JsonValue v && v.TryGetValue<string>(out var s) ? s : null;

    public static int? Int(JsonNode? node, string property) =>
        node is JsonObject o && o[property] is JsonValue v && v.TryGetValue<int>(out var i) ? i : null;

    public static bool Bool(JsonNode? node, string property) =>
        node is JsonObject o && o[property] is JsonValue v && v.TryGetValue<bool>(out var b) && b;

    public static JsonElement Element(JsonNode? node) => JsonSerializer.SerializeToElement(node);
}

/// <summary>Words for the values 5etools stores as codes: abilities, schools, casting times, ranges and durations.</summary>
internal static class FiveEToolsText
{
    public static readonly string[] Abilities = ["str", "dex", "con", "int", "wis", "cha"];

    public static string AbilityName(string code) => code.ToLowerInvariant() switch
    {
        "str" => "Strength",
        "dex" => "Dexterity",
        "con" => "Constitution",
        "int" => "Intelligence",
        "wis" => "Wisdom",
        "cha" => "Charisma",
        _ => code,
    };

    public static string School(string? code) => code switch
    {
        "A" => "Abjuration",
        "C" => "Conjuration",
        "D" => "Divination",
        "E" => "Enchantment",
        "V" => "Evocation",
        "I" => "Illusion",
        "N" => "Necromancy",
        "T" => "Transmutation",
        _ => code ?? "",
    };

    public static string CastingTime(JsonNode? time)
    {
        if (time is not JsonArray times || times.Count == 0 || times[0] is not JsonObject first)
        {
            return "";
        }
        var number = FiveEToolsJson.Int(first, "number") ?? 1;
        return FiveEToolsJson.Str(first, "unit") switch
        {
            "action" => number == 1 ? "Action" : $"{number} actions",
            "bonus" => "Bonus Action",
            "reaction" => "Reaction",
            "minute" => number == 1 ? "1 minute" : $"{number} minutes",
            "hour" => number == 1 ? "1 hour" : $"{number} hours",
            { } unit => $"{number} {unit}",
            null => "",
        };
    }

    public static string Range(JsonNode? range)
    {
        var distance = range?["distance"];
        var type = FiveEToolsJson.Str(distance, "type");
        var amount = FiveEToolsJson.Int(distance, "amount");
        var text = type switch
        {
            "self" => "Self",
            "touch" => "Touch",
            "sight" => "Sight",
            "unlimited" => "Unlimited",
            "feet" or "miles" when amount is { } n => $"{n} {(n == 1 ? type.TrimEnd('s') : type)}",
            _ => FiveEToolsJson.Str(range, "type") == "special" ? "Special" : "",
        };
        // a self-centred area: "Self (15-foot cone)"
        if (FiveEToolsJson.Str(range, "type") is "cone" or "line" or "sphere" or "emanation" or "radius" or "cube" or "hemisphere" && amount is { } size)
        {
            text = $"Self ({size}-{(type == "miles" ? "mile" : "foot")} {FiveEToolsJson.Str(range, "type")})";
        }
        return text;
    }

    public static (string Text, bool Concentration) Duration(JsonNode? duration)
    {
        if (duration is not JsonArray durations || durations.Count == 0 || durations[0] is not JsonObject first)
        {
            return ("", false);
        }
        var concentration = FiveEToolsJson.Bool(first, "concentration");
        var text = FiveEToolsJson.Str(first, "type") switch
        {
            "instant" => "Instantaneous",
            "permanent" => "Until dispelled",
            "special" => "Special",
            "timed" when first["duration"] is JsonObject d => $"{FiveEToolsJson.Int(d, "amount") ?? 1} {Unit(FiveEToolsJson.Str(d, "type"), FiveEToolsJson.Int(d, "amount") ?? 1)}",
            _ => "",
        };
        if (FiveEToolsJson.Str(first, "type") == "timed" && first["duration"] is JsonObject upTo && FiveEToolsJson.Bool(upTo, "upTo"))
        {
            text = $"up to {text}";
        }
        return (concentration ? $"Concentration, {text}" : text.Length == 0 ? text : char.ToUpperInvariant(text[0]) + text[1..], concentration);

        static string Unit(string? unit, int amount) => amount == 1 ? unit ?? "" : $"{unit}s";
    }
}
