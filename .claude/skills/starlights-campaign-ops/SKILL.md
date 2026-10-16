---
name: starlights-campaign-ops
description: Help the owner maintain Starfall campaign session notes, NPCs, places, quests, treasure and character grants through existing authenticated APIs. Prepare changes for approval before writing live data. Use for campaign operations, not application development or autonomous session invention.
---

# Campaign operations

Use after the owner supplies campaign instructions or notes. Follow `AGENTS.md` and
`docs/ai/DEVELOPMENT_DIRECTIVE.md`. This skill is guidance for Claude Code, not an in-app
AI feature or service. It does not authorize live changes by itself.

Reuse [architecture](../starlights-architecture/SKILL.md) for code locations,
[D&D rules](../starlights-dnd-rules/SKILL.md) for rule/source/edition questions, and
[homebrew](../starlights-homebrew/SKILL.md) for homebrew lookup and availability.
Do not duplicate their rules or implement missing operations.

## Access and identity

- Establish the intended application origin and campaign from the owner's instructions.
  Do not guess a production address from development defaults or inspect deployment
  secrets to obtain access. Use the owner's authorized authenticated session; preserve
  any reverse-proxy authentication as well as application tokens.
- `GET /api/campaigns` returns `{ campaigns, dm }`; match campaign ID, name and party,
  then `GET /api/campaigns/{campaignId}` returns `{ campaign, party, entries, dm, carried }`.
  A locked list row can expose only a name. Resolve ambiguous matches with the owner.
- Application authentication uses `X-Player-Token` (comma-separated unlock tokens),
  not an invented Bearer scheme. `X-Player-Name` is the URI-encoded player name; it is
  not sufficient to impersonate a locked player. Reuse `lib/api-client.ts` and
  `lib/player.tsx` when operating through the app. Keep tokens/passwords out of logs,
  repository files and reports.
- Existing unlocks: `POST /api/campaigns/{id}/unlock` or `/dm-unlock`, each with
  `{ password }`; the former grants campaign reading, the latter that campaign's DM
  access. `POST /api/characters/players/unlock` takes `{ name, password }` for a
  locked player. The app also supports `POST /api/admin/unlock` with `{ password }`;
  do not escalate to site admin without authorization. A campaign DM token does not
  by itself unlock a player's `/api/characters/{id}/inventory` route.
- Campaign reads may be public when unlocked; edits still require the endpoint's DM
  checks. `AllowAnonymous()` in FastEndpoints is not permission to bypass these checks.
  On 401/403, stop that operation and arrange legitimate access. Never use production
  SQL, forge tokens, change passwords or disable authentication as a workaround.
- The player's campaign view is a new server request omitting **all** campaign-DM
  and admin tokens (`unlockTokenHeader(false)`), retaining authorized player/campaign
  read tokens. Verify `dm: false`; filtering a DM response locally is not verification.

## Session notes: propose, approve, apply, verify

1. Read the selected campaign and relevant existing sessions, NPCs, places, quests,
   magic items and ledger entries. The current UI orders sessions by descending
   `number` (`null` counts as zero), keeping ties; `updatedAt` is an edit time, not
   the date played. Compare `number`, `occurredOn` and the supplied notes to identify
   the latest played session. Clarify conflicting dates/numbers or an ambiguous target.
2. Organize the owner's notes chronologically, retaining decisions, outcomes and
   established history. Do not invent events, identities, rewards or quest completion.
   Keep uncertainty explicit. Published adventure events and future DM preparation
   are not events that happened. Put approved preparation in `dmNotes` or a DM notebook,
   never silently into the public recap.
3. Match entity updates by existing IDs and context before proposing new entries.
   Separate session prose, NPC/place/quest changes, discovered treasure, and actual
   inventory/currency assignments. Discovery alone does not imply granting ownership.
4. Present a reviewable proposal: campaign/session identity, each entry ID or proposed
   create, before/after changes, visibility and DM-only content, source references,
   and each grant's recipient, exact item/base IDs, quantity, coins and fund effect.
   List ambiguities and unsupported operations separately. Do not put private details
   in Git or a public handoff; show the proposal only in the authorized conversation.
5. **Request explicit approval of the concrete changes before any live write.** Rough
   notes or a request to prepare changes are not approval. Apply only the approved set;
   a changed proposal needs approval for its changed scope. Prior explicit approval
   of the same concrete operations remains valid.
6. Re-read affected records just before writing. Entry writes have no revision guard:
   if another editor changed them since review, reconcile and obtain approval for
   material changes. Use the existing APIs below, preserving unrelated fields. Record
   returned IDs and completed steps privately; stop on a failed or uncertain write.
   There is no transaction spanning a batch of session/entity/grant requests.
7. Fetch the campaign and affected inventories again, independent of cached UI state.
   Compare persisted values with the approved set. Fetch the player view separately:
   public entries/links must be visible, hidden sessions/DM notes/DM links absent.
   If permissions prevent either read, report verification incomplete, not success.
   Report what persisted, what failed or remains uncertain, and any unperformed steps.

## Campaign entry contracts

Paths below are relative to the chosen authenticated API origin; `{id}` is a campaign
ID, `{entryId}` an entry ID. Source of truth: `lib/api/campaigns.ts` and the server
`CampaignEndpoints.cs`, `CampaignNoteEndpoints.cs`, `CampaignView.cs` listed below.

| Operation | Existing API and contract |
| --- | --- |
| Read campaign and entries | `GET /api/campaigns/{id}`; no separate entry-read route is needed. |
| Create ordinary entry | `POST /api/campaigns/{id}/entries` with the full entry input; returns saved entry with ID. |
| Update ordinary entry | `PUT /api/campaigns/{id}/entries/{entryId}` with the full entry input; kind remains unchanged. |
| Scoped notebook | `POST /api/campaigns/{id}/notes` or `PUT /api/campaigns/{id}/notes/{entryId}` with `{ title, body, scope }`, scope `private`, `party` or `dm`. Use this route for notes, not generic entries. |

Full ordinary-entry input:
`{ kind, title, number, occurredOn, visible, body, dmNotes, imageUrl, data, sort }`.
`number` and `occurredOn` may be null; dates use `YYYY-MM-DD`. Reads add `id` and
`updatedAt`. Kinds include `session`, `npc`, `place`, `faction`, `quest`, `item`,
`magicitem`, `ledger`, `handout`, `map`, `encounter`, `note`.

PUT is replacement of these fields, not a sparse patch. Start from the current **DM**
entry; preserve `number`, date, `sort`, visibility, image, all unknown `data` keys,
and existing prose/DM notes unless an approved edit changes them. Omitting fields can
erase them; replacing `imageUrl` also deletes the previous uploaded image. Never
construct an update from a player response, whose private fields have been removed.

Use existing `data` conventions from `pages/campaigns/campaign-dialogs.tsx`:

- NPCs: `role`, `status`; quests: `status` = `open`, `done`, `failed`. Preserve existing
  place/entity metadata rather than inventing a new schema.
- References: `links: [{ category, key, name, ch?, anchor?, dmOnly? }]` points into
  Compendium of Lore. Keep keys and chapter/anchor IDs from actual content.
- Magic items: `elementId`, `baseElementId`, `bookName` for a catalog-backed item;
  custom descriptors include `category`, `rarity`, `attunement`, `weight`, `whereabouts`.
  Read the existing picker/dialog before setting values; these are not inventory IDs.
- Ledger: `coins: { cp?, sp?, ep?, gp?, pp? }`, `to: "party"` or character ID,
  `items: string[]`. Signed coins in party rows determine the party fund. Manual ledger
  entries record history; they do **not** change character inventories or purses.

Visibility is enforced by the server: players receive revealed entries, no `dmNotes`,
and no `data.links` marked `dmOnly`. **Ledger entries are always player-visible even
when `visible` is false**; do not put secrets there. Arbitrary `data` fields are not
automatically private. Private notebooks belong only to their verified author, even
against a DM; party notes are shared and DM notes require DM access. Do not promote
private notes into a session recap without the owner's authorization to share them.

## Items, treasure and ownership

Identify characters using the campaign's `party` details and `GET /api/characters`;
confirm `characterId`, character name and owner, not just a display-name match.
Read `GET /api/characters/{characterId}/inventory` for each relevant character.
Inventory is `{ version, revision, items, coins, treasure, questItems }`; each item
has its own `id`, optional catalog `elementId`/`baseElementId` or `custom`, `quantity`
and equipment/container/attunement/usage fields. Preserve these fields and ownership.

Lookup paths:

- `GET /api/elements/items` → `{ version, items }`, the installed mundane/magic catalog.
  Match source/edition and `id`; Aurora IDs, Lore keys and catalog GUIDs are different
  identifiers. Exclude `buildOption` entries from grants.
- `GET /api/elements/items/{elementId}/bases` → `{ items }` for valid base weapon/armor
  choices. Resolve a requested generic magic item to its approved base before granting.
- `GET /api/elements/compendium` → `{ items }`, then `/api/elements/compendium/{id}`
  for descriptions, source, Aurora IDs, setters and rules; batch lookup is
  `/api/elements/compendium/batch?ids=<comma-separated GUIDs>` → `{ entries }`.
- Homebrew lookup: `GET /api/elements/homebrew/items`, installed catalog and campaign
  `magicitem` entries. Consult the homebrew skill for current shapes and source enablement.
  Respect campaign `useHomebrew` and character Sources; do not silently toggle either.

Record discovered treasure using approved session/item/magicitem/ledger entries first
when no recipient is established. A campaign item record does not itself grant equipment.

| Approved operation | Supported write and effects |
| --- | --- |
| DM grants item and/or coins | `POST /api/campaigns/{id}/give` with `{ characterId, campaignItemId?, elementId?, baseElementId?, quantity, coins?, fromFund, note?, imageUrl? }`; recipient must belong to the campaign. Choose campaign item or catalog item, not ambiguous competing selectors. |
| Transfer existing property | `POST /api/campaigns/{id}/trade` with `{ fromCharacterId, toCharacterId, itemId?, quantity, coins }`; both characters must be distinct party members. Requires campaign DM or campaign access plus source-character edit access. `itemId` is the source inventory entry ID; quantity zero transfers all of that entry. |
| Edit a character inventory | `PUT /api/characters/{characterId}/inventory` replaces the full inventory and requires its current `revision`; returns `{ revision }`, or 409 if stale. Re-read/reconcile on conflict; never force an old copy over new state. This is not a campaign grant/transfer workflow and does not automatically add campaign ledger rows. |

Give details and limits:

- `campaignItemId` must identify a campaign `magicitem`. A catalog-backed entry grants
  its catalog/base IDs; otherwise the API makes a custom magic-item copy with campaign
  source/name. Custom prose is not a new executable rules implementation.
- Send explicit positive item quantities (1–1000); the server accepts zero but converts
  it to one when an item is selected. Coins-only gives use no item IDs and quantity zero.
  Coin denominations are `cp`, `sp`, `ep`, `gp`, `pp`, each integer 0–1,000,000;
  `note` is at most 500 characters. An explicit image must be uploaded to this campaign.
- Give updates the recipient inventory/revision and open builder snapshot, and creates
  a visible recipient ledger row. With `fromFund: true` and coins, it also creates the
  negative party-fund row. Response includes `{ given, ledger }`. Do not create those
  ledger rows again. Check the fund before approving: the endpoint does not enforce
  sufficient fund balance. It does not track/decrement a shared stock of physical items.
- Trade moves property and records its ledger effects, preserving builder snapshots
  where possible; it can require the source player to Save/Discard first. Ask the owner
  to resolve that state; do not save/discard their builder work automatically.
- Neither give nor trade has an idempotency key. Before each request compare the current
  inventory, `carried` and ledger with the approved quantities and previous completed
  steps. On timeout/unknown outcome, re-read and reconcile; never blindly retry a grant.
  `carried` is derived by catalog ID or custom name/source, not a unique physical-item
  ownership record. Use actual inventory IDs when transferring existing items.
- Inventory PUT, editing a ledger row, or deleting a campaign item is not an automatic
  reversal of a give/trade. For corrections, propose supported compensating operations
  and their ledger effects for approval. No bulk atomic grant/reversal API is provided.

## Campaign books and rules

Keep three kinds of information distinct in proposals: **established campaign history**
(owner and saved campaign records), **published reference material**, and **suggestions**.
Published plots do not override player decisions or establish that an event occurred.

Consult installed content first; check accessibility before claiming it was read:

- Compendium of Lore uses `VITE_LORE_BASE`, default `/lore-data`. Read `current.json`
  for `version`, then `/{version}/meta.json`, `index/{category}.json` and
  `data/{category}/{source-lowercase}.json`. Global lookup uses `/{version}/search.json`.
  Follow actual index keys/redirects; a search hit alone is not the full source text.
- For installed books/adventures, follow the indexes and reader files:
  `/{version}/reader/{books|adventures}/{id}/toc.json`, `search.json`, and
  `{chapter}.json`. Cite source/edition, book, chapter, section/page when supplied, with
  `/lore/{books|adventures}/{id}?ch={chapter}#{anchor}` or `/lore/{category}/{key}`.
- The rules skill identifies local 5etools and Aurora Legacy content locations. Verify
  they exist and are authorized before reading only the needed records. Use its lookup
  skill if available; if absent, use accessible installed/local sources and disclose gaps.
  Distinguish 2014 and 2024 material, official content and homebrew.
- For other campaign reference books, inspect only available owner-provided files or
  installed reader content. A title/index entry is not evidence that full chapters are
  installed. State unavailable sources and ask for the needed material or clarification;
  never pretend to have read them or fill gaps with invented quotations.
- Cite references without copying books into the repository. Never commit copyrighted
  book content, private campaign spoilers, player data or credentials. If approved
  reference links reveal secrets, mark them `dmOnly` and verify the player's response.

## Implementation references and unsupported operations

All source paths are repository-relative. Frontend paths below start at
`src/frontend/apps/builder-app/src/`:

- `lib/api/{campaigns,inventory,items,compendium,homebrew}.ts`, `lib/player.tsx`,
  `lib/api-client.ts`: requests, auth headers and query invalidation.
- `pages/campaigns/campaign-dialogs.tsx`, `lib/rules/{items,ledger}.ts`,
  `lib/lore/{data,types,campaign-links}.ts`, `pages/lore/book-reader.tsx`: data and UI conventions.
- `src/modules/characters/Modules.Characters.Endpoints/Campaigns/`:
  `CampaignEndpoints.cs`, `CampaignNoteEndpoints.cs`, `CampaignTradeEndpoint.cs`.
- `src/modules/characters/Modules.Characters.Endpoints/Characters/Inventory/InventoryEndpoints.cs`;
  `src/modules/characters/Modules.Characters/Services/Campaigns/{CampaignView,InventoryTrade,BuilderSnapshotInventory}.cs`.
- `src/modules/characters/Modules.Characters.Domain/Campaigns/Campaign.cs` for entry validation;
  `src/apps/Starlights.Application/Program.cs` and `Services/Players/PlayerAccess.cs`
  under `Modules.Characters` for access enforcement.

These are the existing application contracts reviewed for Mission 014A. Recheck the
relevant endpoint if integration changes it. No session import/AI summarization API,
atomic multi-entry update, entry revision precondition, idempotent grant, or general
campaign-stock accounting is supplied here. If a requested operation is unsupported,
state the limitation and propose a reviewable manual workflow using supported operations;
do not build new functionality, bypass auth or modify production SQL.
