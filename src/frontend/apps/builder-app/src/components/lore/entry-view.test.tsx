import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { LoreEntry, LoreMeta } from "@/lib/lore/types";
import { EntryView } from "./entry-view";

const meta: LoreMeta = {
  version: "test",
  built: "",
  imageBase: "",
  sources: {
    MM: { abbr: "MM", name: "Monster Manual", short: "MM", date: null, edition: "2014", group: "core", kind: "book" },
  },
  tagDefaults: {},
  categories: {},
  redirects: {},
};

const entry: LoreEntry = {
  name: "Test Dragon",
  source: "MM",
  page: 10,
  size: ["L"],
  type: "dragon",
  alignment: ["N"],
  ac: [16],
  hp: { average: 100, formula: "10d10 + 40" },
  speed: { walk: 30 },
  str: 18,
  dex: 14,
  con: 18,
  int: 12,
  wis: 14,
  cha: 16,
  passive: 12,
  languages: ["Common"],
  cr: "5",
  environment: ["mountain"],
  _versionOf: { name: "Older Dragon", source: "MM" },
  trait: [{ name: "Keen Sight", entries: ["The dragon sees well."] }],
  _fluff: { entries: ["A long history of lore."] },
};

function html(printStatBlockOnly: boolean) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <EntryView meta={meta} category="bestiary" entry={entry} printStatBlockOnly={printStatBlockOnly} />
    </MemoryRouter>,
  );
}

describe("Bestiary entry printing", () => {
  it("keeps the creature heading and stat block while hiding supplementary content in print-only mode", () => {
    const output = html(true);

    expect(output).toContain("<h2");
    expect(output).toContain("Test Dragon");
    expect(output).toContain("Monster Manual, p. 10");
    expect(output).toContain("AC</span> 16");
    expect(output).toContain("Keen Sight");
    expect(output).toMatch(/<p class="[^"]*print:hidden[^"]*">A version of /);
    expect(output).toContain("Older Dragon");
    expect(output).toMatch(/<p class="[^"]*print:hidden[^"]*">Found in: mountain<\/p>/);
    expect(output).toMatch(/<section class="[^"]*print:hidden[^"]*">\s*<h3[^>]*>Lore<\/h3>/);
  });

  it("leaves all entry content printable when stat-block-only mode is off", () => {
    const output = html(false);

    expect(output).toContain("Found in: mountain");
    expect(output).toContain("A long history of lore.");
    expect(output).not.toContain("print:hidden");
  });
});
