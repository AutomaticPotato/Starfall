/**
 * A creature's stat block over its name: pointing at the name opens it (a phone opens it with a tap), and it stays open
 * while the pointer is on it, so the DM can read and scroll the actions mid-fight without leaving the order of play.
 * A Compendium creature shows its book's stat block, a homebrew monster the Homebrew page's.
 */
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { LoreRenderProvider } from "@/components/lore/render";
import { StatBlock } from "@/components/lore/stat-block";
import { HomebrewStatBlock } from "@/components/homebrew-stat-block";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { useLoreEntry, useLoreMeta } from "@/lib/lore/data";
import { monsterSubtitle } from "@/lib/lore/monster-text";
import type { HomebrewMonster } from "@/lib/rules/homebrew";
import { cn } from "@/lib/utils";

const OPEN_DELAY = 250;
const CLOSE_DELAY = 200;

export function CreaturePeek({ bestiaryKey, homebrew, className, children }: { bestiaryKey?: string | null; homebrew?: HomebrewMonster; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const later = (fn: () => void, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  // the pointer, not a finger: a tap is a click, and the click toggles it
  const hover = (on: boolean) => (e: PointerEvent) => e.pointerType === "mouse" && later(() => setOpen(on), on ? OPEN_DELAY : CLOSE_DELAY);

  if (!bestiaryKey && !homebrew) return <span className={className}>{children}</span>;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerEnter={hover(true)}
          onPointerLeave={hover(false)}
          className={cn("cursor-help text-left underline decoration-dotted decoration-muted-foreground/60 underline-offset-4", className)}
          aria-label={typeof children === "string" ? `${children}: stat block` : undefined}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
        className="max-h-[min(70vh,40rem)] w-[min(94vw,32rem)] overflow-y-auto p-3 text-sm"
      >
        {homebrew ? <HomebrewStatBlock monster={homebrew} /> : <BestiaryBlock k={bestiaryKey!} />}
      </PopoverContent>
    </Popover>
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
