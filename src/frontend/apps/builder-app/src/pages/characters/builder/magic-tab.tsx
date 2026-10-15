import { AlertTriangleIcon, BookOpenIcon, CheckIcon, MoonIcon, SparklesIcon, SunriseIcon, WandSparklesIcon } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { SpellBrowser, SpellCard } from "@/components/spells/spell-browser";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import type { BuilderChoice } from "@/lib/api/builder";
import { useMagic, useSaveMagic, useSpellcasting, useSpellIndex, type SpellFigures } from "@/lib/api/magic";
import { spellChoiceGroups } from "@/lib/rules/wizard-steps";
import {
  casterLevelShare,
  expended,
  isPrepared,
  longRest,
  nextLevelSummary,
  ordinal,
  pactSlots,
  prepareProblem,
  preparedCount,
  setPactSpent,
  setSpent,
  shortRest,
  spellSlots,
  stalePrepared,
  togglePrepared,
  usesMulticlassTable,
  type Caster,
  type KnownSpell,
  type MagicState,
} from "@/lib/rules/magic";
import { cn } from "@/lib/utils";

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/**
 * The character's spellcasting, like Aurora's Magic tab: first the spells to choose (the builder's spell choices,
 * from the class, the species, the background and feats), then for each spellcasting class its ability, spell attack
 * and save DC, the spells it has by level and, for classes that prepare, which are prepared today (always-prepared
 * spells do not count). Spell slots are ticked off as they are spent and come back on a rest.
 */
export function MagicTab({ characterId, spellChoices = [], renderChoice }: { characterId: string; spellChoices?: BuilderChoice[]; renderChoice?: (choice: BuilderChoice) => ReactNode }) {
  const { data: casting, isLoading, error: castingError } = useSpellcasting(characterId);
  const { data: magic, error: magicError } = useMagic(characterId);
  const { byId: figures } = useSpellIndex();
  const save = useSaveMagic(characterId);
  const failed = (e: Error) => toast.error("Could not save", { description: e.message });
  const picks = renderChoice ? <SpellPicks choices={spellChoices} renderChoice={renderChoice} /> : null;

  if (castingError || magicError) return <div className="space-y-4">{picks}<p role="alert">Could not load spellcasting. Reload the page to try again.</p></div>;

  if (isLoading || !casting || !magic)
    return (
      <div className="spell-browser max-w-6xl space-y-5">
        {picks}
        <Spinner className="mx-auto my-8 size-5" />
      </div>
    );

  const casters = casting.casters;
  const slots = spellSlots(casters);
  const pact = pactSlots(casters);
  const change = (fn: (m: MagicState) => MagicState) => save.update(fn, failed);

  if (casters.length === 0 && casting.otherSpells.length === 0) {
    return (
      <div className="spell-browser max-w-6xl space-y-5">
        {picks}
        {spellChoices.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No spellcasting. Spells from a class, species, feat or magic item show up here.</div>
        )}
      </div>
    );
  }

  return (
    <div className="spell-browser max-w-6xl space-y-5">
      {picks}
      {(Object.keys(slots).length > 0 || pact) && (
        <section className="surface">
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b bg-muted/30 px-3 py-2 font-heading">
            <SparklesIcon className="size-4 text-muted-foreground" />
            Spell slots
            {usesMulticlassTable(casters) && (
              <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground">
                shared by your classes (multiclass caster level {Math.min(20, casters.reduce((n, c) => n + casterLevelShare(c), 0))})
              </span>
            )}
            <span className="ms-auto flex gap-2">
              {pact && (
                <Button size="sm" variant="outline" onClick={() => change(shortRest)} title="Pact magic slots come back" disabled={save.isPending}>
                  <SunriseIcon /> Restore pact slots
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={save.isPending}
                onClick={() => {
                  change(longRest);
                  toast.success("Every slot is back");
                }}
              >
                <MoonIcon /> Restore all slots
              </Button>
            </span>
          </h3>
          <div className="divide-y">
            {Object.entries(slots).map(([level, total]) => (
              <SlotRow
                key={level}
                label={`${ordinal(Number(level))} level`}
                total={total}
                spent={expended(magic, Number(level))}
                onSpent={(n) => change((m) => setSpent(m, Number(level), n, total))}
              />
            ))}
            {pact && (
              <SlotRow
                label={`Pact magic (${ordinal(pact.level)})`}
                note="back after a short rest"
                total={pact.count}
                spent={magic.expendedPactSlots}
                onSpent={(n) => change((m) => setPactSpent(m, n, pact.count))}
              />
            )}
          </div>
        </section>
      )}

      {casters.map((c) => (
        <CasterCard key={c.name} caster={c} magic={magic} figures={figures} proficiency={casting.proficiencyBonus} busy={save.isPending} onChange={change} />
      ))}

      {casting.otherSpells.length > 0 && (
        <section className="surface">
          <h3 className="flex flex-wrap items-baseline gap-x-2 border-b bg-muted/30 px-3 py-2 font-heading">
            <WandSparklesIcon className="size-4 self-center text-muted-foreground" />
            Other spells
            <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground">from your species, background, feats and features: cast as they say</span>
          </h3>
          <div className="divide-y">
            {casting.otherSpells.map((s) => (
              <SpellRow key={s.registrationId} spell={s} figures={figures?.get(s.elementId)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * The spells to choose, grouped by what gives them (class, species, background and feats), each a pick like the
 * Build tab's: open the list, point at (or tap ⓘ next to) a spell to read what it does, pick it.
 */
function SpellPicks({ choices, renderChoice }: { choices: BuilderChoice[]; renderChoice: (choice: BuilderChoice) => ReactNode }) {
  const [level, setLevel] = useState("all");
  const levels = [...new Set(choices.map((c) => c.level || 1))].sort((a, b) => a - b);
  const groups = spellChoiceGroups(choices);
  const visible = spellChoiceGroups(choices.filter((c) => level === "all" || String(c.level || 1) === level));
  if (groups.length === 0) return null;
  const open = groups.reduce((n, g) => n + g.open, 0);
  return (
    <section className="surface" aria-labelledby="spell-picks">
      <h3 id="spell-picks" className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b bg-muted/30 px-3 py-2 font-heading">
        <BookOpenIcon className="size-4 text-muted-foreground" />
        Choose your spells
        <span className={cn("ms-auto rounded-full px-2 py-0.5 font-sans text-xs", open > 0 ? "bg-amber-500/90 text-black" : "bg-muted text-muted-foreground")}>
          {open > 0 ? `${open} to choose` : "all chosen"}
        </span>
      </h3>
      <div className="space-y-4 p-3">
        <p className="text-sm text-muted-foreground" role="status">{choices.filter((c) => c.selected).length} of {choices.length} selections filled · {open} required selections remaining. Preparation is separate below.</p>
        <nav className="flex flex-wrap gap-2" aria-label="Spell progression levels">
          <Button variant={level === "all" ? "default" : "outline"} aria-pressed={level === "all"} onClick={() => setLevel("all")}>All levels</Button>
          {levels.map((n) => { const remaining = choices.filter((c) => (c.level || 1) === n && !c.optional && !c.selected).length; return <Button key={n} variant={level === String(n) ? "default" : "outline"} aria-pressed={level === String(n)} onClick={() => setLevel(String(n))}>Level {n}{remaining ? ` · ${remaining} left` : " · ✓"}</Button>; })}
        </nav>
        {visible.map((g) => (
          <div key={g.title} className="space-y-2">
            <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {g.title}
              {g.open > 0 && <span className="text-xs text-amber-700 dark:text-amber-300">{g.open} open</span>}
            </h4>
            {g.choices.map((c) => renderChoice(c))}
          </div>
        ))}
      </div>
    </section>
  );
}

/** One level's slots as boxes to tick, like on the paper sheet: ticking the third box spends three slots. */
function SlotRow({ label, note, total, spent, onSpent }: { label: string; note?: string; total: number; spent: number; onSpent: (spent: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
      <span className="w-24 text-sm sm:w-36">
        {label}
        {note && <span className="block text-xs text-muted-foreground">{note}</span>}
      </span>
      <span className="flex flex-wrap gap-1.5" role="group" aria-label={`${label} slots`}>
        {Array.from({ length: total }, (_, i) => {
          const isSpent = i < spent;
          return (
            <button
              key={i}
              type="button"
              aria-pressed={isSpent}
              aria-label={`${label} slot ${i + 1} of ${total}${isSpent ? ", spent" : ""}`}
              onClick={() => onSpent(isSpent ? i : i + 1)}
              className={cn(
                "flex size-11 items-center justify-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-ring",
                isSpent ? "border-muted-foreground/40 bg-muted text-muted-foreground" : "border-primary/60 bg-primary/10 hover:bg-primary/20",
              )}
            >
              {isSpent && <CheckIcon className="size-4" />}
            </button>
          );
        })}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {total - spent} of {total} left
      </span>
    </div>
  );
}

function Figure({ label, value, children, warn }: { label: string; value: ReactNode; children?: ReactNode; warn?: boolean }) {
  const body = (
    <span className={cn("inline-block rounded-md border px-2 py-1 text-left", warn && "border-destructive/60", children && "hover:bg-muted/60")}>
      <span className="block text-xs leading-tight text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
  if (!children) return body;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="rounded-md">
          {body}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 text-sm">{children}</PopoverContent>
    </Popover>
  );
}

function Breakdown({ parts, total }: { parts: [string, number][]; total: string }) {
  return (
    <>
      {parts
        .filter(([, v], i) => i === 0 || v !== 0)
        .map(([label, v], i) => (
          <p key={label} className="flex justify-between">
            <span className="text-muted-foreground">{label}</span>
            <span className="tabular-nums">{i === 0 ? v : signed(v)}</span>
          </p>
        ))}
      <p className="mt-1 flex justify-between border-t pt-1 font-medium">
        <span>Total</span>
        <span className="tabular-nums">{total}</span>
      </p>
    </>
  );
}

interface Row {
  spell: KnownSpell;
  /** prepared by choice, or always prepared */
  prepared: boolean;
  /** a prepare toggle is offered */
  preparable: boolean;
  stale: boolean;
}

function CasterCard({
  caster: c,
  magic,
  figures,
  proficiency,
  busy,
  onChange,
}: {
  caster: Caster;
  magic: MagicState;
  figures: Map<string, SpellFigures> | undefined;
  proficiency: number;
  busy: boolean;
  onChange: (fn: (m: MagicState) => MagicState) => void;
}) {
  const { count, max } = preparedCount(c, magic);
  const stale = new Set(stalePrepared(c, magic));
  const [showAll, setShowAll] = useState(() => c.knowsWholeList && count === 0);

  const rows = useMemo(() => {
    const stale = new Set(stalePrepared(c, magic));
    const byId = new Map<string, Row>();
    for (const s of c.spells) {
      byId.set(s.elementId, { spell: s, prepared: s.kind === "always" || isPrepared(c, magic, s.elementId), preparable: c.prepares && s.kind === "spellbook", stale: false });
    }
    // a whole-list caster: every spell it may prepare, plus prepared ones that no longer fit
    const extra = c.knowsWholeList ? [...c.preparable, ...stale] : [...stale];
    for (const id of extra) {
      if (byId.has(id)) continue;
      const f = figures?.get(id);
      const spell: KnownSpell = { registrationId: id, elementId: id, name: f?.name ?? "Unknown spell", level: f?.level ?? 0, kind: "spellbook", origin: "" };
      byId.set(id, { spell, prepared: isPrepared(c, magic, id), preparable: true, stale: stale.has(id) });
    }
    return [...byId.values()].sort((a, b) => a.spell.level - b.spell.level || a.spell.name.localeCompare(b.spell.name));
  }, [c, magic, figures]);

  const visible = rows.filter((r) => !(c.knowsWholeList && !showAll && r.preparable && !r.prepared && !r.stale));
  const next = nextLevelSummary(c);
  const lists = c.lists.join(", ");

  return (
    <section className="surface">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-2">
        <h3 className="me-2 flex items-center gap-2 font-heading">
          <BookOpenIcon className="size-4 text-muted-foreground" />
          {c.name}
          <span className="text-xs font-normal normal-case tracking-normal text-muted-foreground">{c.className && c.className !== c.name ? `${c.className} ${c.classLevel}` : `level ${c.classLevel}`}</span>
        </h3>
        <Figure label="Ability" value={c.ability ?? "—"} />
        <Figure label="Spell attack" value={signed(c.attack)}>
          <p className="mb-2 font-medium">Spell attack bonus</p>
          <Breakdown parts={[["Proficiency bonus", proficiency], [c.ability ?? "Ability", c.abilityModifier], ["Items and features", c.attackBonus]]} total={signed(c.attack)} />
        </Figure>
        <Figure label="Save DC" value={c.dc}>
          <p className="mb-2 font-medium">Spell save DC</p>
          <Breakdown parts={[["Base", 8], ["Proficiency bonus", proficiency], [c.ability ?? "Ability", c.abilityModifier], ["Items and features", c.dcBonus]]} total={String(c.dc)} />
        </Figure>
        {!c.knowsWholeList && <Figure label={c.spellbook ? "In spellbook" : "Known spells"} value={c.spells.filter((s) => s.level > 0 && s.kind !== "always").length} />}
        <Figure label="Cantrips" value={c.spells.filter((s) => s.level === 0).length} />
        <span className="text-sm text-muted-foreground">{c.edition} rules</span>
        {c.prepares && max !== null && <Figure label="Prepared" value={`${count} / ${max}`} warn={count > max} />}
      </div>

      <div className="space-y-3 p-3">
        {c.prepares && max !== null && <p role="status" className="text-sm font-medium">{count} / {max} prepared · {Math.max(0, max - count)} remaining</p>}
        <p className="text-sm text-muted-foreground">
          {c.pact
            ? `Pact magic: all your slots are ${ordinal(c.pact.level)} level and come back after a short rest.`
            : c.knowsWholeList
              ? `You prepare spells from the whole ${lists} list, of a level you have slots for; change them after a long rest. Always-prepared spells don't count toward the ${max ?? ""} you prepare.`
              : c.spellbook
                ? `You prepare ${max ?? ""} spells from your spellbook after a long rest. Rituals in your spellbook can be cast as rituals without preparing them.`
                : `You know these spells and can cast any of them with a slot.${c.allowReplace ? " When you gain a level, you can swap one for another from the list." : ""}`}
        </p>
        {next.length > 0 && (
          <p className="text-sm">
            <span className="text-muted-foreground">At {c.className ?? c.name} level {c.nextLevel!.level}: </span>
            {next.join(", ")}
          </p>
        )}
        {stale.size > 0 && (
          <p className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/5 px-3 py-2 text-sm">
            <AlertTriangleIcon className="size-4 shrink-0 text-amber-600" />
            {stale.size === 1 ? "A prepared spell no longer fits" : `${stale.size} prepared spells no longer fit`} (a lower level or a book switched off). Unprepare{" "}
            {stale.size === 1 ? "it" : "them"} to free the place.
          </p>
        )}
        {c.prepares && max !== null && count > max && (
          <p className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/5 px-3 py-2 text-sm">
            <AlertTriangleIcon className="size-4 shrink-0 text-amber-600" /> More spells prepared than you can: unprepare {count - max}.
          </p>
        )}

        {c.knowsWholeList && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Which spells to show">
              {[
                [false, "Ready to cast"],
                [true, `All you can prepare (${c.preparable.length})`],
              ].map(([value, label]) => (
                <button
                  key={String(value)}
                  type="button"
                  aria-pressed={showAll === value}
                  onClick={() => setShowAll(value as boolean)}
                  className={cn("rounded px-2.5 py-1 text-sm", showAll === value ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
                >
                  {label as string}
                </button>
              ))}
            </div>

          </div>
        )}

        <SpellBrowser label={`${c.name} spells`} entries={visible.map((r) => {
          const problem = r.preparable && !r.prepared ? prepareProblem(c, magic, r.spell.elementId) : null;
          return { id: r.spell.elementId, name: r.spell.name, figures: { ...figures?.get(r.spell.elementId), level: r.spell.level }, source: figures?.get(r.spell.elementId)?.source,
            status: r.spell.kind === "always" ? "Always prepared · does not count toward your limit" : r.spell.level === 0 ? "Cantrip · no slot needed" : r.prepared ? "Prepared" : r.preparable ? "Not prepared" : "Known",
            requirement: r.stale ? "No longer available with your current level or enabled sources. Remove it to free a selection." : problem,
            action: r.preparable ? <Button variant={r.prepared ? "outline" : "default"} disabled={busy || !!problem} onClick={() => { onChange((m) => togglePrepared(c, m, r.spell.elementId)); toast(`${r.spell.name} ${r.prepared ? "unprepared" : "prepared"}`); }}>{r.prepared ? "Unprepare" : "Prepare"}</Button> : undefined };
        })} />
      </div>
    </section>
  );
}

function SpellRow({ spell, figures }: { spell: KnownSpell; figures: SpellFigures | undefined }) {
  return <SpellCard entry={{ id: spell.elementId, name: spell.name, figures: { ...figures, level: spell.level }, source: figures?.source, status: spell.kind === "always" ? "Always prepared" : spell.origin || "Known" }} />;
}
