import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { SpellPrintingFacts } from "@/lib/rules/spell-options";

/** Fetch only ambiguous spell identities; reuse the existing read-only compendium batch API. */
export function useSpellPrintings(ids: string[], enabled: boolean) {
  return useQuery({
    queryKey: ["spell-printings", ids.join(",")],
    enabled: enabled && ids.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const entries: SpellPrintingFacts[] = [];
      // Keep each URL comfortably below request-size limits and the server's 300-ID cap.
      for (let i = 0; i < ids.length; i += 80) {
        const result = await apiClient.get<{ entries: SpellPrintingFacts[] }>(`/api/elements/compendium/batch?ids=${ids.slice(i, i + 80).join(",")}`);
        entries.push(...result.entries);
      }
      return new Map(entries.map((entry) => [entry.id, entry]));
    },
  });
}
