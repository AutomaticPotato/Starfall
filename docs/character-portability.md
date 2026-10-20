# Moving characters between Starfall servers

**Export:** on the Characters page, hover a character (on a phone: its menu) and press **Export**. You get
`<name>.starlights.json`. **Import:** on the other server, **Import Starfall character** on the Characters page,
choose the file, check the preview, press **Import as a new character**.

The import always creates a **new** character of the player who imports it (a password-locked player must be unlocked
first). It never overwrites a character, joins no campaign, and takes no player, password or permission from the file.
If another of that player's characters has the same name, the new one is called "Name (imported)".

## What the file holds

Format `starlights-character`, version 1 (JSON):

| Field | What |
|---|---|
| `format`, `version` | `"starlights-character"`, `1`. A newer version is refused with "update this server first". |
| `exportedAt`, `exportedFrom` | when, and the exporting server's Starfall commit |
| `sourceCharacterId` | the character's id on the exporting server (the importing server gives it a new one) |
| `summary` | name, level, classes and levels, edition (`2014`, `2024`, `mixed`), species, background, books used |
| `dependencies` | every rules element the character refers to: id, name, type, book, whether it is homebrew; for a built-in element (see below) also its rules |
| `portrait` | an uploaded portrait as a data URL, or a built-in picture's address |
| `storyImages` | pictures in the character's story |
| `columns` | the exporting server's columns, to notice fields another version lacks |
| `data` | the character itself: every row the builder keeps (ability scores, classes and levels, every choice and what it granted, skills, saves, inventory and currency, prepared spells, story, extras, books ticked) and its play state (hit points, conditions, resources, used slots) |

Rules content (classes, spells, items, feats, …) is **not** copied: it is referred to by id. Ids come from the
content's own (Aurora) ids, so a server with the same books gives the same ids. Homebrew is listed so it can be
installed first.

The few elements every server makes for itself when it starts (the six abilities, skills and saving throws, and the
builder's own rules such as Proficiency Bonus and Class Selection) have ids of each server's own. The file lists their
rules (each rule's id and what it says), and the importing server uses its own copy: the element of the same type and
name that it also made itself, whose rules say the same in the same order. Files exported before this was added
(Starfall v0.11.0 and earlier) lack those rules, so another server refuses them; export the character again from an
updated server.

## Import rules

- The preview lists rules content this server lacks; the import is **refused** until it is installed (books on the
  Content page, homebrew on the Homebrew page). Nothing is substituted.
- Every id in the file except verified rules content gets a new value, so importing the same file twice gives two
  separate characters and a file cannot reach any other character. Built-in elements take this server's ids (above);
  one that does not match exactly is listed as missing and the import is refused.
- Fields from a different Starfall version: details this server has no place for are listed as not kept; details
  the file lacks start empty. Both are shown before you confirm.
- After the import the character is worked through this server's rules once (as after a content update), keeping
  every pick.
- If anything fails, the half-made character is removed again.
