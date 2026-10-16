import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { CampaignEntry, CampaignView } from "@/lib/api/campaigns";
import { campaignSessions, matchingSessions, sessionLabel } from "./session-navigation";

const entry = (id: string, changes: Partial<CampaignEntry> = {}): CampaignEntry => ({
  id,
  kind: "session",
  title: `Chapter ${id}`,
  body: "",
  visible: true,
  number: 1,
  sort: 0,
  updatedAt: "2026-10-16",
  data: {},
  ...changes,
});

describe("campaign session navigation", () => {
  it("keeps descending session numbers, original ties and unnumbered entries without renumbering or changing cached data", () => {
    const entries = [
      entry("early", { number: 2 }),
      entry("latest", { number: 42 }),
      entry("tie", { number: 2 }),
      entry("zero", { number: 0 }),
      entry("no-number", { number: null }),
      entry("npc", { kind: "npc", number: 99 }),
    ];
    const before = structuredClone(entries);
    expect(campaignSessions(entries, true).map((e) => e.id)).toEqual(["latest", "early", "tie", "zero", "no-number"]);
    expect(entries).toEqual(before);
    expect(sessionLabel(entries[3])).toBe("Session 0 · Chapter zero");
    expect(sessionLabel(entries[4])).toBe("Chapter no-number");
  });

  it("finds titles, existing notes, session numbers and dates, ignoring case, accents and line breaks", () => {
    const sessions = [entry("one", { title: "Café at Dawn", body: "Meet the\n  silver dragon", number: 17, occurredOn: "2026-10-16" }), entry("two")];
    for (const query of [" CAFE ", "SILVER dragon", "session 17", "2026-10-16"]) {
      expect(matchingSessions(sessions, query, false).map((e) => e.id)).toEqual(["one"]);
    }
    expect(matchingSessions(sessions, "unknown clue", false)).toEqual([]);
    expect(matchingSessions(sessions, "   ", false)).toEqual(sessions);
  });

  it("limits DM-note matches and hidden session titles to the DM view, including empty searches", () => {
    const sessions = [entry("public", { dmNotes: "secret patron" }), entry("hidden", { visible: false, title: "Hidden betrayal", body: "secret patron" })];
    expect(matchingSessions(campaignSessions(sessions, true), "secret patron", true)).toHaveLength(2);
    expect(matchingSessions(campaignSessions(sessions, false), "secret patron", false)).toEqual([]);
    expect(campaignSessions(sessions, false).map((e) => e.id)).toEqual(["public"]);
    expect(matchingSessions(sessions, "hidden betrayal", false)).toEqual([]);
    expect(matchingSessions(sessions, "", false).map((e) => e.id)).toEqual(["public"]);
  });

  it("uses only the supplied player view and never searches private notebook or reference-entry content", () => {
    const entries = [entry("public"), entry("notebook", { kind: "note", body: "private notebook text" }), entry("reference", { kind: "npc", body: "secret identity" })];
    expect(matchingSessions(campaignSessions(entries, true), "private notebook", true)).toEqual([]);
    expect(matchingSessions(campaignSessions(entries, true), "secret identity", true)).toEqual([]);
    expect(matchingSessions(campaignSessions([entries[0]], false), "secret", false)).toEqual([]);
  });

  it("preserves the original entry, content and reference links when finding a session", () => {
    const original = entry("linked", { body: "# Meeting\nKeep **this** text.", data: { links: [{ name: "Existing reference", href: "/lore/test" }] } });
    const [found] = matchingSessions([original], "meeting", true);
    expect(found).toBe(original);
    expect(found.data).toBe(original.data);
    expect(found.body).toBe("# Meeting\nKeep **this** text.");
  });
});

const fixture = vi.hoisted(() => ({ view: null as CampaignView | null }));
vi.mock("@/lib/api/campaigns", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/campaigns")>()),
  useCampaign: () => ({ data: fixture.view }),
}));
import { CampaignPage } from "./campaign-page";

function renderSessions(dm: boolean, entries: CampaignEntry[]) {
  fixture.view = {
    campaign: { id: "synthetic-campaign", name: "Test campaign", description: "", party: [], locked: false, updatedAt: "2026-10-16" },
    party: [],
    entries,
    dm,
  };
  return renderToStaticMarkup(
    <MemoryRouter>
      <CampaignPage />
    </MemoryRouter>,
  );
}

describe("Sessions tab rendering", () => {
  it("starts with the latest session open and older notes folded, keeping navigation and edit controls", () => {
    const html = renderSessions(true, [
      entry("older", { number: 2, body: "Older session body" }),
      entry("latest", { number: 9, body: "Latest session body", dmNotes: "A private clue" }),
    ]);
    expect(html).toContain("Search sessions");
    expect(html).toContain("Jump to session");
    expect(html).toContain("Expand shown");
    expect(html).toContain("Collapse shown");
    expect(html).toContain("Latest session body");
    expect(html).not.toContain("Older session body");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Edit Chapter latest"');
    expect(html).toContain("A private clue");
  });

  it("renders neither hidden session titles nor DM notes or session-edit controls for a player", () => {
    const html = renderSessions(false, [
      entry("public", { body: "Shared recap", dmNotes: "Secret patron" }),
      entry("hidden", { number: 10, visible: false, title: "Secret plan" }),
    ]);
    expect(html).toContain("Shared recap");
    expect(html).not.toContain("Secret patron");
    expect(html).not.toContain("Secret plan");
    expect(html).not.toContain('aria-label="Edit Chapter public"');
    expect(html).not.toContain("Add a session");
  });

  it("provides an honest empty state without an unusable jump selector", () => {
    const html = renderSessions(false, []);
    expect(html).toContain("No sessions yet.");
    expect(html).not.toContain("Choose a session");
  });
});
