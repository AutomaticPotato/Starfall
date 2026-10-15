/**
 * The simulator's magic items and consumables: what each one does in a fight, read from its text. Charges are the
 * Equipment tab's (spending one here spends it there); a weapon's switchable powers (a Flame Tongue ablaze, a Holy
 * Avenger against fiends) add their damage to its attack cards; a potion heals and is used up. Bonuses an item's
 * rules give (AC, saves, ability scores, speed) are already in the character's numbers while it is active.
 */
import { FlaskConicalIcon, GemIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PartyMemberChoice } from "@/lib/api/campaigns";
import type { SheetItem } from "@/lib/api/sheet";
import { average, formatRoll, itemHealing, plainSpellText, rollDice, type CombatState, type ItemRider } from "@/lib/rules/battle";
import { itemUses, type ItemUse, type UseSlot } from "@/lib/rules/item-uses";
import { cn } from "@/lib/utils";

export function Items({
  items,
  riders,
  state,
  edition,
  update,
  setCharges,
  consume,
  heal,
  markUsed,
}: {
  items: SheetItem[];
  riders: Record<string, ItemRider[]>;
  state: CombatState;
  edition: "2014" | "2024";
  update: (change: (c: CombatState) => CombatState) => void;
  setCharges: (entryId: string, used: number) => void;
  consume: (entryId: string) => void;
  heal: (amount: number) => void;
  markUsed: (slot: "Action" | "Bonus Action") => void;
}) {
  if (items.length === 0) {
    return <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">No magic items or potions carried. Add them in the builder's Equipment tab.</p>;
  }
  const active = new Set(state.active ?? []);
  const toggle = (key: string) => update((c) => ({ ...c, active: (c.active ?? []).includes(key) ? (c.active ?? []).filter((k) => k !== key) : [...(c.active ?? []), key] }));
  const sorted = [...items].sort((a, b) => Number(b.active) - Number(a.active) || Number(a.consumable) - Number(b.consumable) || a.name.localeCompare(b.name));

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {sorted.map((item) => {
        const heals = item.consumable ? itemHealing(item.html) : null;
        const powers = riders[item.entryId] ?? [];
        const chargesLeft = item.charges ? Math.max(0, item.charges - item.chargesUsed) : null;
        return (
          <article key={item.entryId} className={cn("rounded-xl border bg-card p-3 shadow-sm", item.active ? "border-amber-300/30" : "border-border")}>
            <header className="flex flex-wrap items-center gap-2">
              {item.consumable ? <FlaskConicalIcon className="size-4 text-[var(--success)]" /> : <GemIcon className="size-4 text-[var(--warning)]" />}
              <h3 className="font-semibold text-foreground">{item.name}</h3>
              {item.quantity > 1 && <span className="text-sm text-muted-foreground">×{item.quantity}</span>}
              <span className="flex-1" />
              {item.rarity && <span className="rounded-full border border-border px-2 py-0.5 text-sm text-muted-foreground">{item.rarity}</span>}
              {item.requiresAttunement && (
                <span className={cn("rounded-full border px-2 py-0.5 text-sm", item.attuned ? "border-emerald-300/40 text-[var(--success)]" : "border-red-300/40 text-destructive")}>
                  {item.attuned ? "attuned" : "not attuned"}
                </span>
              )}
            </header>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.bonuses.length > 0
                ? item.active
                  ? `Active: ${item.bonuses.join(", ")}, already in your numbers.`
                  : item.requiresAttunement && !item.attuned
                    ? `Attune to it (a short rest with it, in the Equipment tab) for ${item.bonuses.join(", ")}.`
                    : `Equip it in the Equipment tab for ${item.bonuses.join(", ")}.`
                : item.requiresAttunement && !item.attuned
                  ? "Needs attunement (a short rest with it) before its magic works: attune it in the Equipment tab."
                  : item.consumable
                    ? "Used up when you use it."
                    : "Its powers are below and in what it does."}
            </p>

            {chargesLeft !== null && item.charges !== null && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>Charges</span>
                <span className="inline-flex gap-0.5">
                  {Array.from({ length: Math.min(item.charges, 30) }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={i < chargesLeft ? "Spend a charge" : "Get back a charge"}
                      onClick={() => setCharges(item.entryId, i < chargesLeft ? item.chargesUsed + 1 : item.chargesUsed - 1)}
                      className={cn("size-3 rotate-45 border border-violet-300/70", i < chargesLeft ? "bg-violet-400" : "bg-transparent")}
                    />
                  ))}
                </span>
                <span>
                  {chargesLeft}/{item.charges}
                </span>
              </div>
            )}

            {item.spells.length > 0 && (
              <p className="mt-2 text-sm text-[var(--info)]">
                Casts{" "}
                {item.spells
                  .map((s) => `${s.spell.name} (${s.cost ? `${s.cost} charge${s.cost === 1 ? "" : "s"}${s.upcast ? ", more for a higher level" : ""}` : "no charge"}${s.dc ? `, save DC ${s.dc}` : ""})`)
                  .join(", ")}
                : cast them from the Spells tab.
              </p>
            )}

            {powers.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {powers.map((p) => {
                  const key = `${item.entryId}:${p.id}`;
                  const on = p.always || active.has(key);
                  return (
                    <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full border border-red-300/40 bg-red-500/10 px-2 py-0.5 text-destructive">
                        +{formatRoll(p.roll)} ({average(p.roll)} avg)
                      </span>
                      <span className="text-muted-foreground">{p.label}</span>
                      <span className="flex-1" />
                      {p.always || p.critOnly ? (
                        <span className="text-muted-foreground">{p.critOnly ? "added to critical hits" : "always on"}</span>
                      ) : (
                        <Button size="sm" variant={on ? "default" : "secondary"} className={cn("h-7", on && "bg-primary text-primary-foreground hover:bg-primary/90")} aria-pressed={on} onClick={() => toggle(key)}>
                          {on ? "On" : "Switch on"}
                        </Button>
                      )}
                    </li>
                  );
                })}
                <li className="text-sm text-muted-foreground">Switched-on damage is added to this weapon's attack cards.</li>
              </ul>
            )}

            {heals && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full border border-emerald-300/40 bg-emerald-400/10 px-2 py-0.5 text-[var(--success)]">
                  Heals {formatRoll(heals, false)} ({average(heals)} avg)
                </span>
                <span className="text-muted-foreground">{edition === "2024" ? "Drinking it is a Bonus Action." : "Drinking it is an action."}</span>
                <span className="flex-1" />
                <Button
                  size="sm"
                  className="h-7 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => {
                    const amount = rollDice(heals);
                    heal(amount);
                    consume(item.entryId);
                    markUsed(edition === "2024" ? "Bonus Action" : "Action");
                    toast.success(`${item.name}: healed ${amount} hit points`);
                  }}
                >
                  Drink (roll)
                </Button>
              </div>
            )}

            <details className="mt-2 text-sm text-muted-foreground">
              <summary className="cursor-pointer text-muted-foreground">What it does</summary>
              <p className="mt-1 whitespace-pre-line">{plainSpellText(item.html) || "No description."}</p>
            </details>
          </article>
        );
      })}
    </div>
  );
}

/**
 * The magic items' uses that take this action (a potion to drink, a brooch's reaction, a charm's bonus action), each
 * with a button that rolls its dice, applies what it can (temporary hit points, healing), spends its charges and
 * marks the action as used. Healing and temporary hit points that can go to someone else (a potion given, "a
 * creature you touch regains") can be used on another character of the party, and go into their simulator. Things the
 * fight state can't hold (a bonus to a save, damage reduced for an ally) are rolled and shown, for the player to call
 * out.
 */
export function ItemUses({
  items,
  slot,
  edition,
  spent,
  blocked,
  setCharges,
  consume,
  tempHp,
  heal,
  markUsed,
  party = [],
  applyToAlly,
}: {
  items: SheetItem[];
  slot: UseSlot;
  edition: "2014" | "2024";
  spent: boolean;
  blocked: boolean;
  setCharges: (entryId: string, used: number) => void;
  consume: (entryId: string) => void;
  tempHp: (amount: number) => void;
  heal: (amount: number) => void;
  markUsed: (slot: UseSlot) => void;
  /** the other characters of its campaigns' parties */
  party?: PartyMemberChoice[];
  applyToAlly?: (target: PartyMemberChoice, kind: "heal" | "tempHp", amount: number) => Promise<string>;
}) {
  const rows = items
    .filter((i) => !(i.requiresAttunement && !i.attuned))
    .flatMap((item) => itemUses(item.html, { consumable: item.consumable, edition, castsSpells: item.spells.length > 0 }).filter((u) => u.slot === slot).map((use) => ({ item, use })));
  if (rows.length === 0) return null;
  const props = { slot, spent, blocked, setCharges, consume, tempHp, heal, markUsed, party: applyToAlly ? party : [], applyToAlly };
  return (
    <section className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <GemIcon className="size-4 text-[var(--info)]" /> Magic items
      </h2>
      <div className="grid gap-2 md:grid-cols-2">
        {rows.map(({ item, use }) => (
          <ItemUseRow key={`${item.entryId}-${use.id}`} item={item} use={use} {...props} />
        ))}
      </div>
    </section>
  );
}

function ItemUseRow({
  item,
  use,
  slot,
  spent,
  blocked,
  setCharges,
  consume,
  tempHp,
  heal,
  markUsed,
  party,
  applyToAlly,
}: {
  item: SheetItem;
  use: ItemUse;
  slot: UseSlot;
  spent: boolean;
  blocked: boolean;
  setCharges: (entryId: string, used: number) => void;
  consume: (entryId: string) => void;
  tempHp: (amount: number) => void;
  heal: (amount: number) => void;
  markUsed: (slot: UseSlot) => void;
  party: PartyMemberChoice[];
  applyToAlly?: (target: PartyMemberChoice, kind: "heal" | "tempHp", amount: number) => Promise<string>;
}) {
  // whom it is used on: "" is the character itself
  const [on, setOn] = useState("");
  const [sending, setSending] = useState(false);
  const left = item.charges ? item.charges - item.chargesUsed : null;
  const noCharge = use.charges > 0 && (left === null || left < use.charges);
  const targets = use.forOthers ? party : [];
  const target = targets.find((t) => t.key === on);
  const severalCampaigns = new Set(targets.map((t) => t.campaignId)).size > 1;

  const spend = () => {
    if (use.charges && item.charges) setCharges(item.entryId, item.chargesUsed + use.charges);
    if (use.consumes) consume(item.entryId);
    markUsed(slot);
  };

  function onUse() {
    const amount = use.roll ? rollDice(use.roll) : 0;
    if (target && applyToAlly && (use.kind === "heal" || use.kind === "tempHp")) {
      const kind = use.kind;
      setSending(true);
      applyToAlly(target, kind, amount)
        .then((name) => {
          spend();
          toast.success(`${item.name}: ${name} ${kind === "heal" ? `regains ${amount} hit points` : `gains ${amount} temporary hit points`}`, {
            description: "It is in their simulator now.",
          });
        })
        .catch((e: Error) => toast.error(`Could not use ${item.name} on ${target.name}`, { description: e.message.includes("403") ? "You can't change this character (its player has a password)." : e.message }))
        .finally(() => setSending(false));
      return;
    }
    if (use.kind === "tempHp") tempHp(amount);
    if (use.kind === "heal") heal(amount);
    spend();
    const said: Record<ItemUse["kind"], string> = {
      tempHp: `gained ${amount} temporary hit points`,
      heal: `healed ${amount} hit points`,
      saveBonus: `add +${amount} to the saving throw`,
      reduceDamage: `reduce the damage by ${amount}`,
      other: "used",
    };
    toast.success(`${item.name}: ${said[use.kind]}`, { description: use.kind === "reduceDamage" ? "Tell the DM (or the ally) to take that much less." : undefined });
  }

  return (
    <div className="rounded-lg border border-border bg-muted p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-foreground">{item.name}</div>
          <div className="text-sm text-muted-foreground">{target && use.consumes ? `Give it to ${target.name}: heal` : use.label}</div>
          <div className="text-sm text-muted-foreground">
            {use.consumes ? `Used up${item.quantity > 1 ? ` (${item.quantity} left)` : ""}` : use.charges ? `${use.charges} charge${use.charges === 1 ? "" : "s"} · ${left ?? 0} left` : "No charge"}
            {use.roll ? ` · ${formatRoll(use.roll, false)} (${average(use.roll)} avg)` : ""}
          </div>
          {targets.length > 0 && (
            <label className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              On
              <select
                value={on}
                onChange={(e) => setOn(e.target.value)}
                className="h-6 max-w-[12rem] rounded border border-border bg-muted px-1 text-sm text-foreground"
                aria-label={`Use ${item.name} on`}
              >
                <option value="">yourself</option>
                {targets.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                    {severalCampaigns ? ` (${t.campaignName})` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <Button
          size="sm"
          className="h-7 bg-violet-500 text-foreground hover:bg-violet-400"
          disabled={spent || blocked || noCharge || sending}
          title={noCharge ? "No charges left" : spent ? `Your ${slot.toLowerCase()} is used this turn` : undefined}
          onClick={onUse}
        >
          Use
        </Button>
      </div>
      {use.text && <p className="mt-1 text-sm text-muted-foreground">{use.text}</p>}
    </div>
  );
}
