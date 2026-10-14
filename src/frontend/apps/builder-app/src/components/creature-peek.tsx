/**
 * A creature's stat block over its name: pointing at the name opens it (a phone opens it with a tap), and it stays open
 * while the pointer is on it, so the DM can read and scroll the actions mid-fight without leaving the order of play.
 * A Compendium creature shows its book's stat block, a homebrew monster the Homebrew page's.
 */
import type { ReactNode } from "react";
import { HomebrewStatBlock } from "@/components/homebrew-stat-block";
import { LoreRenderProvider } from "@/components/lore/render";
import { StatBlock } from "@/components/lore/stat-block";
import { Peek } from "@/components/peek";
import { Spinner } from "@/components/ui/spinner";
import { useLoreEntry, useLoreMeta } from "@/lib/lore/data";
import { monsterSubtitle } from "@/lib/lore/monster-text";
import type { HomebrewMonster } from "@/lib/rules/homebrew";

export function CreaturePeek({ bestiaryKey, homebrew, className, children }: { bestiaryKey?: string | null; homebrew?: HomebrewMonster; className?: string; children: ReactNode }) {
  if (!bestiaryKey && !homebrew) return <span className={className}>{children}</span>;
  return (
    <Peek label={typeof children === "string" ? `${children}: stat block` : undefined} className={className} content={() => (homebrew ? <HomebrewStatBlock monster={homebrew} /> : <BestiaryBlock k={bestiaryKey!} />)}>
      {children}
    </Peek>
  );
}

function BestiaryBlock({ k }: { k: string }) {
  const meta = useLoreMeta();
  const entry = useLoreEntry(meta.data, "bestiary", k);
  if (meta.isLoading || entry.isLoading) return <Spinner className="mx-auto my-4 size-5" />;
  if (!meta.data || !entry.data?.entry) return <p className="text-muted-foreground">No stat block found for this creature.</p>;
  // the numbers only: its picture and lore stay on its Compendium page (a phone would scroll past the picture first)
  const m = entry.data.entry;
  return (
    <LoreRenderProvider value={{ meta: meta.data }}>
      <h3 className="font-heading text-lg leading-tight">{m.name}</h3>
      <p className="mb-2 text-xs italic text-muted-foreground">{monsterSubtitle(m as Record<string, unknown>)}</p>
      <StatBlock meta={meta.data} m={m} />
    </LoreRenderProvider>
  );
}
