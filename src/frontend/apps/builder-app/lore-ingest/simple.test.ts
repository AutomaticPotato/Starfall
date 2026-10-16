import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Report } from "./common";
import { ingestSpecies } from "./simple";

describe("species", () => {
  it("makes a subrace that copies another subrace whole, with the copied subrace's race", () => {
    const dir = mkdtempSync(join(tmpdir(), "starlights-species-"));
    try {
      writeFileSync(join(dir, "races.json"), JSON.stringify({
        race: [{ name: "Person", source: "TST", entries: [{ name: "Age", type: "entries", entries: ["Synthetic age."] }] }],
        subrace: [
          { name: "Variant", source: "TST", raceName: "Person", raceSource: "TST", entries: [{ name: "Feat", type: "entries", entries: ["Synthetic feat."] }] },
          {
            name: "Copied", source: "TS2",
            _copy: {
              name: "Variant", source: "TST", raceName: "Person", raceSource: "TST",
              _mod: { entries: { mode: "appendArr", items: [{ name: "Age", type: "entries", entries: ["Copied age."], data: { overwrite: "Age" } }] } },
            },
          },
        ],
      }));
      writeFileSync(join(dir, "fluff-races.json"), JSON.stringify({ raceFluff: [] }));
      const report = new Report();
      const { rows, chunks } = ingestSpecies({ data: dir, sources: {}, report });
      expect(rows.map((r) => r.name)).toContain("Person (Copied)");
      const copied = Object.values(chunks).flatMap((c) => Object.values(c)).find((e) => e.name === "Person (Copied)")!;
      expect(copied.entries).toEqual([
        { name: "Age", type: "entries", entries: ["Copied age."], data: { overwrite: "Age" } },
        { name: "Feat", type: "entries", entries: ["Synthetic feat."] },
      ]);
      // the synthetic books are not in the sources list, which the test leaves out
      expect(report.problems.filter((p) => !p.startsWith("unknown source"))).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
