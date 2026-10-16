# Starlights API — integration guide

Starlights is a web app on top of an HTTP API. Everything the app shows comes from that API, so another program (a
character viewer like [Flare](https://github.com/Egorobi/Flare), a Discord bot, a VTT bridge) can read the same data
from a Starlights server your group runs.

- **The description:** [`openapi.json`](openapi.json), OpenAPI 3.1, generated from the server's real endpoints (see
  [Keeping it current](#keeping-it-current)). Open it in any OpenAPI tool, or read it in the browser with
  [`index.html`](index.html) (Scalar; serve the folder, e.g. `python3 -m http.server -d docs/api`, or GitHub Pages).
- **Examples:** [`examples/starlights_client.py`](examples/starlights_client.py) (Python, standard library only) and
  [`examples/starlights-client.ts`](examples/starlights-client.ts) (TypeScript, `fetch`). Both log in as a player
  when needed and print each character's attack list, custom attacks included.

Nothing here needs a public server. A Starlights server is meant for a private network (your LAN, Tailscale); the
description is in this repository, and a production server does not serve it.

## Reaching a server

The API is under `/api` on the same address as the web app: `http://<server>:8093/api/...` for a default Docker
install. JSON in and out, property names in camelCase.

- **From a program** (Python, Node, a desktop app): call it directly.
- **From a web page on another site:** outside development the server allows no other origins (CORS), so a browser
  page elsewhere cannot call it. Use a small server-side proxy, or run the page from the same address.
- An installation can put the whole site behind a password at the door (a reverse proxy with HTTP Basic auth, as the
  homelab install does for its public door). That is the proxy's, not the API's: send its `Authorization` header too.

## Players and passwords

There are no accounts. A **player** is the name characters are filed under (`playerName`); a player may be
**locked** with a password, which closes their characters to everyone else.

| | |
|---|---|
| `GET /api/characters/players` | `{ players: [{ name, characters, locked }] }` (a locked player's count is not given) |
| `POST /api/characters/players/unlock` | `{ name, password }` → `{ name, token }`; `401` for a wrong password (answered after a short delay), `429` after 5 tries a minute |
| `X-Player-Token` request header | the token(s): several players' tokens comma-separated. Valid 180 days, and only while the password stays the same |

What a token changes:

- `GET /api/characters` (the list) leaves out a locked player's characters unless the request carries their token.
- Everything under `/api/characters/{characterId}/…` of a locked player answers `401 { "locked": "<player>" }` without
  their token, reads and writes alike. An unlocked player's characters are open to everyone who can reach the server.

Not for integrations: the **admin** key (`X-Admin-Key`) and admin token, which change the books' content
(`/api/elements` writes, `/api/admin/...`), and the campaign DM tokens. Don't ask your group for them; a viewer
needs only a player's password, and only for a locked player.

## Characters

All take `{characterId}` (a GUID from the list). Read-only unless marked.

| Endpoint | What it gives |
|---|---|
| `GET /api/characters?player=<name>` | `{ characters: [{ characterId, name, level, build, portraitUrl, playerName }] }`; `player` is optional |
| `GET /api/characters/{id}` | `{ character }`: the same summary as in the list |
| `GET …/ability-scores` | `{ abilityScores: [{ abilityScoreId, name, abbreviation, baseScore, additionalScore, calculatedScore, calculatedModifier }] }` |
| `GET …/saving-throws`, `GET …/skills` | each with its ability, bonus parts and `calculatedBonus` |
| `GET …/statistics` | `{ statistics: [{ groupName, totalValue, values, isFinalized }] }`: every calculated statistic by Aurora's name (`proficiency`, speeds, …) with where each part comes from |
| `GET …/classes` | classes and levels |
| `GET …/features` | features and traits with their texts |
| `GET …/defenses` | resistances, immunities, vulnerabilities |
| `GET …/inventory` / `PUT` | items, coins, treasure, **custom attacks** (below) |
| `GET …/spellcasting` | each spellcasting: ability, attack bonus, save DC, slots, the spells it knows and prepares |
| `GET …/magic` / `PUT` | the player's choices: prepared spells, spent slots |
| `GET …/combat` / `PUT` | play state: damage taken, temporary HP, hit dice spent, conditions, exhaustion, death saves, uses of features and items |
| `GET …/story` | the story fields (appearance, backstory, …) |
| `GET …/export` | the whole character as one Starlights character file (see [character portability](../character-portability.md)) |

Content the sheet needs alongside: `GET /api/elements/items` (every item's figures: weapon dice and properties, armor
class, by element id; default values are left out of the JSON) and `GET /api/elements/spell-index` (every spell).
Both send an `ETag`: send it back as `If-None-Match` and get `304` while nothing changed.

## Attacks

The sheet's attack list (on screen, in the PDF and in the Battle Action Simulator) is made of two kinds of rows,
both in `GET /api/characters/{id}/inventory`:

1. **Weapons on the list:** inventory `items` with an `attack` number (their place). The figures are worked out from
   the item (`/api/elements/items`: dice, properties, magic bonus) and the character (ability modifiers,
   proficiency, fighting styles), so they follow level-ups and new equipment. The API gives the parts; the web app
   does the arithmetic (`src/frontend/apps/builder-app/src/lib/rules/items.ts`, `attacks()`). No endpoint returns the
   finished weapon rows yet.
2. **Custom attacks:** `customAttacks`, written by hand and kept exactly as written, such as an artificer's armor
   attack or a natural weapon. No item stands behind them:

```json
"customAttacks": [
  { "id": "6f1d2c3b-…", "name": "Thunder Gauntlets", "range": "5 ft", "toHit": "+6 vs AC",
    "damage": "1d8+3 thunder", "ability": "Intelligence", "description": "…", "place": 2 }
]
```

Rows are shown in `attack`/`place` order (the two share one numbering). When nothing has a place, the sheet shows
the equipped weapons, then the custom attacks.

Where custom attacks come from: importing an Aurora character file (`.dnd5e`) keeps every displayed attack in
`<attacks>` whose identifier is not an item of the file (Aurora's **Manage → Attacks**), and the attack of an item
the server's content doesn't have. They keep Aurora's figures: Starlights does not recalculate them. Importing the
same file again updates them by identifier and adds nothing twice. They stay through builder saves, level-ups,
trades, character export and import.

## Writing

Writes replace the whole document: read it, change it, send it all back.

- **Inventory:** `PUT …/inventory` with the `revision` you read. The answer is `{ revision }` (the new one); `409` when
  someone saved in between: read again and reapply. Leave `customAttacks` out (or `null`) to keep the stored ones;
  send `[]` to remove them all. Server-owned fields (`registrationId`) are ignored.
- **Combat:** `PUT …/combat` with the `received` value you read; `409` with the current state when the character was
  given something in between (a potion from a party member).
- **Magic:** `PUT …/magic`; the last write wins.

Changing the build (classes, choices, ability scores) goes through the builder session
(`/api/characters/{id}/builder/session` with save and discard), as the web app's builder does. Plan on reading
there.

## Examples

```bash
curl -s http://localhost:8093/api/characters | jq '.characters[] | {characterId, name, level}'
curl -s http://localhost:8093/api/characters/<id>/inventory | jq '.customAttacks'

# a locked player's character
TOKEN=$(curl -s -X POST http://localhost:8093/api/characters/players/unlock \
  -H 'Content-Type: application/json' -d '{"name":"Ilyra","password":"…"}' | jq -r .token)
curl -s -H "X-Player-Token: $TOKEN" http://localhost:8093/api/characters/<id>/inventory
```

```bash
python3 docs/api/examples/starlights_client.py http://localhost:8093 [--player NAME] [--json]
node docs/api/examples/starlights-client.ts http://localhost:8093   # Node 22.18+; STARLIGHTS_PLAYER/STARLIGHTS_PASSWORD
```

Generated clients: `npx openapi-typescript docs/api/openapi.json -o starlights.d.ts`, or
`openapi-python-client generate --path docs/api/openapi.json`.

## Limitations

- **Weapon attack figures are not in the API** (see [Attacks](#attacks)): a client gets the weapon, its dice and the
  character's modifiers, and adds them itself, or shows the custom attacks and the weapon names. A consolidated
  "character sheet" endpoint would remove this; it does not exist yet.
- **Access is all or nothing per player.** No read-only tokens, no scopes; anyone who can reach the server can read
  an unlocked player's characters and change them.
- **Query parameters** declared with FastEndpoints' `[QueryParam]` (like `player` on the list) are not in
  `openapi.json`; this guide names them.
- **Content administration** (`/api/elements` writes, `/api/admin`) is in the description for completeness but needs
  the admin key. Some of those endpoints answer `201 Created` where the description says `200`.
- The API has no versioning beyond this repository: a new Starlights version can add fields. Ignore fields you don't
  know, and compare `openapi.json` between versions.

## Keeping it current

`openapi.json` is written by an integration test from the running endpoints (in-memory database, no server
needed), and the same test fails when the endpoints change and the file does not:

```bash
# regenerate (from the repository root)
STARLIGHTS_UPDATE_OPENAPI=1 dotnet test src/tests/integration/Starlights.Integration.Tests --filter FullyQualifiedName~OpenApiDocument
# check (part of the normal test run; the GitHub workflow runs it when started by hand)
dotnet test src/tests/integration/Starlights.Integration.Tests --filter FullyQualifiedName~OpenApiDocument
```

In development (`dotnet run` / Aspire) the server also serves it live at `/openapi/v1.json` with Scalar at
`/scalar`.
