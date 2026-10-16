#!/usr/bin/env python3
"""A small, read-only Starlights API client (Python 3.9+, standard library only).

Lists a server's characters and, for each, its attack list as the sheet shows it: the weapons on the attack list
and the custom attacks written by hand (Aurora's Manage -> Attacks), in their order.

    python3 starlights_client.py http://localhost:8093
    python3 starlights_client.py http://localhost:8093 --player "Ilyra's player"   # asks for the password if locked
    STARLIGHTS_PASSWORD=... python3 starlights_client.py http://localhost:8093 --player Name --json

See docs/api/README.md for the endpoints and their limits.
"""
import argparse
import getpass
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


class Starlights:
    """GET/POST against one Starlights server, carrying the player tokens it was given."""

    TOKEN_HEADER = "X-Player-Token"

    def __init__(self, base_url, tokens=()):
        self.base_url = base_url.rstrip("/")
        self.tokens = list(tokens)

    def request(self, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base_url + path, data=data, method=method)
        req.add_header("Accept", "application/json")
        if data is not None:
            req.add_header("Content-Type", "application/json")
        if self.tokens:
            req.add_header(self.TOKEN_HEADER, ",".join(self.tokens))  # several tokens: comma separated
        with urllib.request.urlopen(req, timeout=30) as response:
            text = response.read().decode()
            return json.loads(text) if text else None

    # ---- players: there are no accounts; a player is a name, optionally locked with a password
    def players(self):
        return self.request("GET", "/api/characters/players")["players"]

    def unlock(self, name, password):
        """Exchanges a locked player's password for a token (valid 180 days, until the password changes)."""
        token = self.request("POST", "/api/characters/players/unlock", {"name": name, "password": password})["token"]
        self.tokens.append(token)
        return token

    # ---- characters
    def characters(self, player=None):
        query = "?" + urllib.parse.urlencode({"player": player}) if player else ""
        return self.request("GET", "/api/characters" + query)["characters"]

    def character(self, character_id):
        return self.request("GET", f"/api/characters/{character_id}")["character"]

    def inventory(self, character_id):
        return self.request("GET", f"/api/characters/{character_id}/inventory")

    def combat(self, character_id):
        return self.request("GET", f"/api/characters/{character_id}/combat")

    def magic(self, character_id):
        return self.request("GET", f"/api/characters/{character_id}/magic")

    def spellcasting(self, character_id):
        return self.request("GET", f"/api/characters/{character_id}/spellcasting")

    def ability_scores(self, character_id):
        return self.request("GET", f"/api/characters/{character_id}/ability-scores")["abilityScores"]

    # ---- content
    def item_catalog(self):
        """Every item's figures (weapon dice, properties, armor class), by element id."""
        return {i["id"]: i for i in self.request("GET", "/api/elements/items")["items"]}


def attack_list(inventory, catalog):
    """The sheet's attack rows, in order. Custom attacks carry their figures as written; for a weapon the API gives
    the item and its dice, and the sheet works out the to-hit and damage bonus from the character (see README)."""
    rows = []
    for entry in inventory.get("items", []):
        if entry.get("attack"):
            item = catalog.get(entry.get("baseElementId") or entry.get("elementId") or "", {})
            weapon = item.get("weapon") or {}
            rows.append({
                "place": entry["attack"],
                "name": entry.get("name") or catalog.get(entry.get("elementId") or "", {}).get("name", "?"),
                "kind": "weapon",
                "range": weapon.get("range") or "5 ft",
                "damage": f"{weapon.get('damage', '')} {weapon.get('damageType', '')}".strip(),
                "properties": weapon.get("properties", []),
            })
    for attack in inventory.get("customAttacks") or []:
        rows.append({
            "place": attack.get("place") or 10_000,
            "name": attack["name"],
            "kind": "custom",
            "range": attack.get("range"),
            "toHit": attack.get("toHit"),
            "damage": attack.get("damage"),
            "ability": attack.get("ability"),
            "description": attack.get("description"),
        })
    return sorted(rows, key=lambda r: r["place"])


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("url", help="the Starlights address, e.g. http://localhost:8093")
    parser.add_argument("--player", help="only this player's characters (unlocked with its password when locked)")
    parser.add_argument("--json", action="store_true", help="print JSON instead of text")
    args = parser.parse_args()

    api = Starlights(args.url)
    if args.player:
        locked = next((p.get("locked") for p in api.players() if p["name"].lower() == args.player.lower()), False)
        if locked:
            api.unlock(args.player, os.environ.get("STARLIGHTS_PASSWORD") or getpass.getpass(f"Password for {args.player}: "))

    catalog = api.item_catalog()
    result = []
    for summary in api.characters(args.player):
        try:
            inventory = api.inventory(summary["characterId"])
        except urllib.error.HTTPError as error:
            if error.code == 401:  # a locked player's character: needs that player's token
                result.append({"name": summary["name"], "locked": True})
                continue
            raise
        result.append({"name": summary["name"], "level": summary.get("level"), "attacks": attack_list(inventory, catalog)})

    if args.json:
        json.dump(result, sys.stdout, indent=2)
        print()
        return
    for character in result:
        print(f"{character['name']}" + (" (locked)" if character.get("locked") else f" — level {character.get('level')}"))
        for row in character.get("attacks", []):
            figures = f"{row['toHit']}, {row['damage']}" if row["kind"] == "custom" else f"{row['damage']} (bonus from the character)"
            print(f"  {row['place']:>2}. {row['name']} [{row['kind']}] {row['range'] or ''} — {figures}")


if __name__ == "__main__":
    main()
