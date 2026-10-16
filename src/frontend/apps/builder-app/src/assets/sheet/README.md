# The PDF sheet's templates and fonts

Everything the character sheet PDF is made from, built into the web app so the sheet works straight after setup
(`lib/aurora-sheet.ts` places the pages and writes the character into their boxes).

- **Templates** (`Page.*`, `Aurora.Pages.*`, `Partial.*`): Aurora Builder's sheet pages, strips and cards, taken from its
  installer, with the drawing unchanged. Aurora Builder is by Bas Driessen ([aurorabuilder.com](https://www.aurorabuilder.com)); the
  sheet's artwork and the Dungeons & Dragons logos belong to their owners (Wizards of the Coast). Four pages
  (`Page.background`, `Page.details_2`, `Aurora.Pages.equipment_page`, `Aurora.Pages.notes_page`) came with complete
  copies of Myriad Pro or Calibri attached as their form boxes' default font. Those are removed (the boxes now name
  Helvetica): the sheet never used them, since it reads only the boxes' places, sizes and colours and writes the values
  with the fonts below. The pages carry only the small font subsets their drawing needs.
- **`sheet-text-*.ttf`**: Carlito (Calibri's metric twin) cut down to Latin, for features, traits and spell texts.
  SIL Open Font License 1.1, see `OFL-sheet-text.txt`.
- **`sheet-fields-regular.ttf`**: Adobe's Source Sans 3 Regular cut down to Latin, for the values in the form boxes.
  SIL Open Font License 1.1, see `OFL-sheet-fields.txt`.

The fonts are renamed (Starfall Sheet Text, Starfall Sheet Fields) because the license reserves the names Carlito
and Source for unchanged copies. Cut down with fonttools `pyftsubset` (Latin, Latin Extended, Greek, Cyrillic,
punctuation and symbols; no ligatures, which pdf-lib turned into gaps).
