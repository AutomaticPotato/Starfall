/**
 * The DM's difficulty check for an encounter: tick the characters and creatures that take part (and add planned
 * ones by challenge rating), and see how hard it is by the 2014 and the 2024 Dungeon Master's Guide. Apart from
 * those, an optional estimate that also weighs the magic items the characters carry; it is not from either book.
 */
import { useQueries } from "@tanstack/react-query";
import { ChevronDownIcon, PlusIcon, ScaleIcon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import type { PartyMember } from "@/lib/api/campaigns";
import { useItemCatalog } from "@/lib/api/items";
import { chunkUrl, sourceOfKey } from "@/lib/lore/data";
import type { LoreMeta } from "@/lib/lore/types";
import type { Combatant } from "@/lib/rules/encounter";
import {
  CHALLENGE_RATINGS,
  DEFAULT_ITEM_WEIGHTS,
  difficulty2014,
  difficulty2024,
  effectiveLevel,
  itemBonus,
  normalizeCr,
  RARITIES,
  type HeldItem,
  type Rarity,
  type Result2014,
  type Result2024,
} from "@/lib/rules/encounter-difficulty";
import type { HomebrewMonster } from "@/lib/rules/homebrew";
import type { Inventory } from "@/lib/rules/items";
import { cn } from "@/lib/utils";

const WEIGHTS_KEY = "starlights.encounter-item-weights";
const CONSUMABLE = /^(potions?|scrolls?|spell scrolls?|ammunition|poisons?|explosives?)$/i;

function storedWeights(): Record<Rarity, number> {
  try {
    const saved = JSON.parse(localStorage.getItem(WEIGHTS_KEY) ?? "null") as Partial<Record<Rarity, number>> | null;
    return { ...DEFAULT_ITEM_WEIGHTS, ...(saved ?? {}) };
  } catch {
    return { ...DEFAULT_ITEM_WEIGHTS };
  }
}

/** The challenge rating of each creature in the fight that has one: from its Compendium entry, or its homebrew stat block. */
function useCombatantCrs(meta: LoreMeta | undefined, monsters: Combatant[], homebrew: HomebrewMonster[] | undefined): Map<string, string> {
  const sources = [...new Set(monsters.filter((c) => c.link?.category === "bestiary").map((c) => sourceOfKey(c.link!.key)))];
  const chunks = useQueries({
    queries: sources.map((source) => ({
      // the same cache entry the stat blocks use
      queryKey: ["lore", meta?.version, "chunk", "bestiary", source],
      queryFn: async () => {
        const response = await fetch(chunkUrl(meta!, "bestiary", source));
        if (!response.ok) throw new Error(`The Compendium's ${source} creatures did not load.`);
        return (await response.json()) as { entries: Record<string, Record<string, unknown>> };
      },
      enabled: !!meta,
      staleTime: Infinity,
    })),
  });
  // a handful of creatures: worked out on every render, no memo needed
  {
    const crs = new Map<string, string>();
    for (const c of monsters) {
      let cr: string | null = null;
      if (c.link?.category === "bestiary") {
        const chunk = chunks[sources.indexOf(sourceOfKey(c.link.key))]?.data;
        cr = normalizeCr(chunk?.entries[c.link.key]?.cr);
      } else if (c.link?.category === "homebrew") {
        cr = normalizeCr(homebrew?.find((m) => m.id === c.link?.key)?.cr);
      }
      if (cr) crs.set(c.id, cr);
    }
    return crs;
  }
}

function Tick({ on, onChange, children, title }: { on: boolean; onChange: (on: boolean) => void; children: React.ReactNode; title?: string }) {
  return (
    <label
      title={title}
      className={cn(
        "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-sm sm:min-h-8",
        on ? "border-primary/60 bg-primary/10" : "text-muted-foreground",
      )}
    >
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-current" />
      {children}
    </label>
  );
}

function CrSelect({ value, onChange, label, placeholder = "CR…" }: { value: string; onChange: (cr: string) => void; label: string; placeholder?: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-md border bg-background px-1.5 text-sm sm:h-8">
      <option value="">{placeholder}</option>
      {CHALLENGE_RATINGS.map((cr) => (
        <option key={cr} value={cr}>
          CR {cr}
        </option>
      ))}
    </select>
  );
}

const TONE: Record<string, string> = {
  Trivial: "bg-muted text-muted-foreground",
  Easy: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300",
  Low: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300",
  Medium: "bg-amber-500/20 text-amber-800 dark:text-amber-300",
  Moderate: "bg-amber-500/20 text-amber-800 dark:text-amber-300",
  Hard: "bg-orange-600/20 text-orange-800 dark:text-orange-300",
  High: "bg-orange-600/20 text-orange-800 dark:text-orange-300",
  Deadly: "bg-red-600/20 text-red-800 dark:text-red-300",
  "Beyond High": "bg-red-600/20 text-red-800 dark:text-red-300",
};

const fmt = (n: number) => n.toLocaleString("en-US");

function Results({ r14, r24, heading }: { r14: Result2014 | null; r24: Result2024 | null; heading?: string }) {
  if (!r14 || !r24) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-md border p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading ? `${heading} · ` : ""}2014 rules</span>
          <span className={cn("rounded-full px-2 py-0.5 text-sm font-semibold", TONE[r14.rating])}>{r14.rating}</span>
        </div>
        <p className="mt-1 text-sm tabular-nums">
          {fmt(r14.xp)} XP × {r14.multiplier} = <strong>{fmt(r14.adjusted)}</strong> adjusted XP
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          Easy {fmt(r14.thresholds.easy)} · Medium {fmt(r14.thresholds.medium)} · Hard {fmt(r14.thresholds.hard)} · Deadly {fmt(r14.thresholds.deadly)}
        </p>
      </div>
      <div className="rounded-md border p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{heading ? `${heading} · ` : ""}2024 rules</span>
          <span className={cn("rounded-full px-2 py-0.5 text-sm font-semibold", TONE[r24.rating])}>{r24.rating}</span>
        </div>
        <p className="mt-1 text-sm tabular-nums">
          <strong>{fmt(r24.xp)}</strong> XP (no multiplier)
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          Budgets: Low {fmt(r24.budgets.low)} · Moderate {fmt(r24.budgets.moderate)} · High {fmt(r24.budgets.high)}
        </p>
      </div>
    </div>
  );
}

export function EncounterDifficulty({
  party,
  combatants,
  homebrew,
  meta,
}: {
  party: PartyMember[];
  combatants: Combatant[];
  homebrew?: HomebrewMonster[];
  meta?: LoreMeta;
}) {
  const members = party.filter((p) => !p.missing);
  const inFight = new Set(combatants.filter((c) => c.kind === "pc" && c.characterId).map((c) => c.characterId!));
  const monsters = combatants.filter((c) => c.kind !== "pc");
  // who counts: the characters in the fight, or the whole party before anyone is added
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const chosen = picked ?? (inFight.size > 0 ? inFight : new Set(members.map((m) => m.characterId)));
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [left, setLeft] = useState<Set<string>>(new Set());
  const [crs, setCrs] = useState<Record<string, string>>({});
  const [planned, setPlanned] = useState<{ id: string; cr: string; count: number }[]>([]);
  const [plan, setPlan] = useState({ cr: "", count: 1 });
  const [estimate, setEstimate] = useState(false);
  const [weights, setWeights] = useState<Record<Rarity, number>>(storedWeights);
  const [consumables, setConsumables] = useState(false);
  const known = useCombatantCrs(meta, monsters, homebrew);

  const team = members.filter((m) => chosen.has(m.characterId)).map((m) => ({ ...m, level: m.level ?? levels[m.characterId] ?? null }));
  const foes = monsters.filter((c) => !left.has(c.id));
  const foeCrs = [...foes.map((c) => known.get(c.id) ?? normalizeCr(crs[c.id])), ...planned.flatMap((p) => Array<string>(p.count).fill(p.cr))];
  const missingCr = foes.filter((c) => !known.get(c.id) && !normalizeCr(crs[c.id]));
  const missingLevel = team.filter((m) => !m.level);
  const teamLevels = team.map((m) => m.level ?? 0).filter((l) => l > 0);
  const ready = missingCr.length === 0 && missingLevel.length === 0 && teamLevels.length > 0 && foeCrs.length > 0;

  // the estimate reads what each ticked character carries (only while it is open)
  const catalog = useItemCatalog();
  const inventories = useQueries({
    queries: team.map((m) => ({
      queryKey: ["inventory", m.characterId],
      queryFn: () => apiClient.get<Inventory>(`/api/characters/${m.characterId}/inventory`),
      enabled: estimate,
    })),
  });
  const byId = useMemo(() => new Map((catalog.data?.items ?? []).map((i) => [i.id, i])), [catalog.data]);
  const held = team.map((m, i) => {
    const inv = inventories[i]?.data;
    const items: HeldItem[] = (inv?.items ?? []).flatMap((e) => {
      const info = e.elementId ? byId.get(e.elementId) : undefined;
      const rarity = info?.magic?.rarity ?? e.custom?.rarity ?? null;
      if (!rarity || rarity.toLowerCase() === "none") return [];
      const consumable = (info?.categories ?? []).some((c) => CONSUMABLE.test(c)) || /^(potion|scroll)\b/i.test(info?.name ?? e.name ?? "");
      return [{ name: e.name ?? info?.name ?? "an item", rarity, stored: !!e.stored, consumable }];
    });
    const bonus = itemBonus(items, weights, consumables);
    return { member: m, items, bonus, effective: effectiveLevel(m.level ?? 0, bonus), loading: estimate && !!inventories[i]?.isLoading };
  });

  const setWeight = (rarity: Rarity, value: number) => {
    const next = { ...weights, [rarity]: Math.max(0, Math.min(5, value)) };
    setWeights(next);
    try {
      localStorage.setItem(WEIGHTS_KEY, JSON.stringify(next));
    } catch {
      // private window: the weights last for this page only
    }
  };

  return (
    <section aria-labelledby="difficulty-heading" className="space-y-3 rounded-lg border p-3">
      <h3 id="difficulty-heading" className="flex items-center gap-2 text-sm font-semibold">
        <ScaleIcon className="size-4 text-muted-foreground" /> Difficulty
      </h3>

      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Characters</p>
        <div className="flex flex-wrap gap-1.5">
          {members.map((m) => (
            <Tick
              key={m.characterId}
              on={chosen.has(m.characterId)}
              onChange={(on) => {
                const next = new Set(chosen);
                if (on) next.add(m.characterId);
                else next.delete(m.characterId);
                setPicked(next);
              }}
            >
              {m.name}
              {m.level ? (
                <span className="text-muted-foreground">lvl {m.level}</span>
              ) : (
                <Input
                  aria-label={`${m.name}'s level`}
                  inputMode="numeric"
                  placeholder="lvl"
                  value={levels[m.characterId] ?? ""}
                  onClick={(e) => e.preventDefault()}
                  onChange={(e) => setLevels({ ...levels, [m.characterId]: Math.min(20, Math.max(0, Number(e.target.value.replace(/\D/g, "")) || 0)) })}
                  className="h-7 w-12 px-1 text-center"
                />
              )}
            </Tick>
          ))}
          {members.length === 0 && <span className="text-sm text-muted-foreground">The campaign has no party yet.</span>}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Creatures</p>
        <div className="flex flex-wrap gap-1.5">
          {monsters.map((c) => (
            <Tick key={c.id} on={!left.has(c.id)} onChange={(on) => setLeft((s) => {
              const next = new Set(s);
              if (on) next.delete(c.id);
              else next.add(c.id);
              return next;
            })}>
              {c.name}
              {known.get(c.id) ? (
                <span className="text-muted-foreground">CR {known.get(c.id)}</span>
              ) : (
                <span onClick={(e) => e.preventDefault()}>
                  <CrSelect label={`${c.name}'s challenge rating`} value={crs[c.id] ?? ""} onChange={(cr) => setCrs({ ...crs, [c.id]: cr })} />
                </span>
              )}
            </Tick>
          ))}
          {planned.map((p) => (
            <Badge key={p.id} variant="outline" className="h-9 gap-1.5 text-sm font-normal sm:h-8">
              {p.count} × CR {p.cr} <span className="text-muted-foreground">(planned)</span>
              <button type="button" aria-label="Remove planned creatures" onClick={() => setPlanned(planned.filter((x) => x.id !== p.id))} className="-me-1 rounded p-0.5 hover:bg-muted">
                <XIcon className="size-3.5" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Try more before adding them:</span>
          <Input
            aria-label="How many planned creatures"
            inputMode="numeric"
            value={plan.count}
            onChange={(e) => setPlan({ ...plan, count: Math.min(30, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)) })}
            className="h-9 w-12 px-1 text-center sm:h-8"
          />
          <CrSelect label="Planned creatures' challenge rating" value={plan.cr} onChange={(cr) => setPlan({ ...plan, cr })} />
          <Button
            size="sm"
            variant="outline"
            className="h-9 sm:h-8"
            disabled={!plan.cr}
            onClick={() => {
              setPlanned([...planned, { id: Math.random().toString(36).slice(2), cr: plan.cr, count: plan.count }]);
              setPlan({ cr: "", count: 1 });
            }}
          >
            <PlusIcon /> Add
          </Button>
        </div>
      </div>

      {ready ? (
        <Results r14={difficulty2014(teamLevels, foeCrs)} r24={difficulty2024(teamLevels, foeCrs)} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {teamLevels.length === 0 || missingLevel.length > 0
            ? missingLevel.length > 0
              ? `Give a level for ${missingLevel.map((m) => m.name).join(", ")}.`
              : "Tick the characters who take part."
            : foeCrs.length === 0
              ? "Add creatures to the encounter, or try some by challenge rating."
              : `Choose a challenge rating for ${missingCr.map((c) => c.name).join(", ")}.`}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        By the Dungeon Master's Guide: 2014, the creatures' XP times a multiplier for how many there are (a step up for fewer than three characters, down for six or more) against each
        character's thresholds; 2024, their XP added up against each character's budget. The 2014 guide also says to leave out creatures far weaker than the rest unless they matter: untick them.
      </p>

      <details open={estimate} onToggle={(e) => setEstimate((e.target as HTMLDetailsElement).open)} className="group rounded-md border border-dashed p-2.5">
        <summary className="flex cursor-pointer select-none list-none items-center gap-2 text-sm font-medium">
          <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" /> Estimate with the party's magic items
          <span className="text-xs font-normal text-muted-foreground">(not a rule from either guide)</span>
        </summary>
        {estimate && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Each magic item a character carries counts as part of a level, by rarity (stored items never count). The levels go into the same tables. It is a rough guide for
              well-equipped parties, set by you; the official result above doesn't change.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {RARITIES.map((r) => (
                <label key={r} className="inline-flex items-center gap-1 text-sm capitalize">
                  {r}
                  <Input
                    aria-label={`Levels for a ${r} item`}
                    inputMode="decimal"
                    value={weights[r]}
                    onChange={(e) => setWeight(r, Number(e.target.value.replace(/[^\d.]/g, "")) || 0)}
                    className="h-9 w-14 px-1 text-center sm:h-8"
                  />
                </label>
              ))}
              <Tick on={consumables} onChange={setConsumables}>
                Count potions and scrolls
              </Tick>
            </div>
            <ul className="space-y-1 text-sm">
              {held.map((h) => (
                <li key={h.member.characterId} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{h.member.name}</span>
                  {h.loading ? (
                    <span className="text-muted-foreground">reading their items…</span>
                  ) : (
                    <>
                      <span className="tabular-nums">
                        level {h.member.level ?? "?"} → {h.effective}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {h.items.filter((i) => !i.stored && (consumables || !i.consumable)).map((i) => `${i.name} (${i.rarity})`).join(", ") || "no magic items counted"}
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
            {ready && (
              <Results
                heading="Estimate"
                r14={difficulty2014(held.map((h) => h.effective), foeCrs)}
                r24={difficulty2024(held.map((h) => h.effective), foeCrs)}
              />
            )}
          </div>
        )}
      </details>
    </section>
  );
}
