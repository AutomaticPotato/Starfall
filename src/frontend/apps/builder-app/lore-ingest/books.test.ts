import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ingestBooks } from "./books";
import { Report, type Writer } from "./common";

describe("book chapter formats", () => {
  it.each([
    ["book", false], ["book", true], ["adventure", false], ["adventure", true],
  ] as const)("imports %s chapters (wrapped: %s) with section links", (kind, wrapped) => {
    const dir = mkdtempSync(join(tmpdir(), "starlights-books-"));
    try {
      const chapters = [{ name: "Synthetic chapter", id: "chapter", entries: [{ type: "section", name: "Synthetic place", id: "place", entries: ["A test location."] }] }];
      for (const list of ["book", "adventure"]) {
        writeFileSync(join(dir, `${list}s.json`), JSON.stringify({ [list]: list === kind ? [{ id: "TEST", name: "Synthetic volume" }] : [] }));
      }
      mkdirSync(join(dir, kind));
      writeFileSync(join(dir, kind, `${kind}-test.json`), JSON.stringify(wrapped
        ? { [`${kind}Data`]: [{ id: "OTHER", data: [] }, { id: "test", data: chapters }] }
        : { data: chapters }));
      const written = new Map<string, unknown>();
      const writer = { write: (path: string, value: unknown) => written.set(path, value) } as unknown as Writer;
      const report = new Report();
      const result = ingestBooks({ data: dir, sources: {}, report }, writer);
      expect(result[`${kind}s`][0].chapters).toBe(1);
      expect(written.get(`reader/${kind}s/test/0.json`)).toEqual(chapters[0]);
      expect(written.get(`reader/${kind}s/test/toc.json`)).toMatchObject({ ids: { chapter: 0, place: 0 } });
      expect(report.problems).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
