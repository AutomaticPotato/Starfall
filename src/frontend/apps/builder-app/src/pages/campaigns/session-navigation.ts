import type { CampaignEntry } from "@/lib/api/campaigns";
import { normalizeText } from "@/lib/rules/picker";

export const sessionLabel = (session: CampaignEntry) => `${session.number != null ? `Session ${session.number} · ` : ""}${session.title}`;

/** Keep the established numbering/order, without modifying the query cache or indexing other campaign tabs. */
export function campaignSessions(entries: CampaignEntry[], dmSide: boolean): CampaignEntry[] {
  return entries.filter((entry) => entry.kind === "session" && (dmSide || entry.visible)).sort((a, b) => (b.number ?? 0) - (a.number ?? 0));
}

/** Only search notes the current view may read. No cached index or persistent copy of DM text. */
export function matchingSessions(sessions: CampaignEntry[], query: string, dmSide: boolean): CampaignEntry[] {
  const term = normalizeText(query.trim()).replace(/\s+/g, " ");
  return sessions.filter(
    (session) =>
      (dmSide || session.visible) &&
      (!term ||
        normalizeText(`${sessionLabel(session)} ${session.occurredOn ?? ""} ${session.body} ${dmSide ? (session.dmNotes ?? "") : ""}`)
          .replace(/\s+/g, " ")
          .includes(term)),
  );
}
