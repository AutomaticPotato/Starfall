import { useState } from "react";
import { toast } from "sonner";
import { SpellBrowser, SpellCard } from "@/components/spells/spell-browser";
import { Button } from "@/components/ui/button";
import { useBuilderChoices, useChoiceOptions, useClearChoice, usePickChoice, type BuilderChoice } from "@/lib/api/builder";
import { editionOf, useCharacterSources, useSources } from "@/lib/api/sources";
import { useSpellPrintings } from "@/lib/api/spell-printings";
import { groupSpellOptions, spellPrintingKey, spellComparisonIds } from "@/lib/rules/spell-options";

export function SpellChoice({ characterId, choice }: { characterId: string; choice: BuilderChoice }) {
  const [open, setOpen] = useState(false);
  const [printings, setPrintings] = useState<Record<string, string>>({});
  const options = useChoiceOptions(characterId, choice.ruleId, open);
  const sources = useSources();
  const restricted = useCharacterSources(characterId);
  const choices = useBuilderChoices(characterId);
  const pick = usePickChoice(characterId);
  const clear = useClearChoice(characterId);
  const busy = pick.isPending || clear.isPending || choices.data?.pending;
  const edition = sources.data && restricted.data ? editionOf(restricted.data.restricted, sources.data.sources) : null;
  const otherSelections = (choices.data?.choices ?? [])
    .filter((c) => c.type === "Spell" && c.ruleId !== choice.ruleId && c.registrationId === choice.registrationId && c.selected)
    .map((c) => c.selected!);
  const comparisonIds = spellComparisonIds([...(options.data?.options ?? []), ...otherSelections]);
  const printingFacts = useSpellPrintings(comparisonIds, open);
  const identity = { sources: sources.data?.sources ?? [], facts: printingFacts.data ?? new Map() };
  const groups = groupSpellOptions(options.data?.options ?? [], edition, choice.selected?.elementId, identity);
  // Block equivalent printings only within this feature; other classes and distinct versions keep their choices.
  const learned = new Set(otherSelections.map((selected) => spellPrintingKey(selected, identity)));
  const fail = (e: Error) => toast.error("Could not update spells", { description: e.message });
  return (
    <section className="surface spell-browser p-3 sm:p-4" data-open-choice={(!choice.optional && !choice.selected) || undefined}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold">{choice.name}</h4>
          <p className="text-sm text-muted-foreground">
            {choice.parentName} · Level {choice.level || 1} · Selection {choice.slot} of {choice.slots}
            {choice.optional ? " · Optional" : ""}
          </p>
        </div>
        <Button variant={choice.selected ? "outline" : "default"} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Close list" : choice.selected ? "Replace spell" : "Choose spell"}
        </Button>
      </div>
      {choice.selected ? (
        <div className="mt-3">
          <SpellCard
            entry={{
              id: choice.selected.elementId,
              name: choice.selected.name,
              source: choice.selected.source,
              status: "Learned",
              action: (
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() =>
                    clear.mutate(choice, { onError: fail, onSuccess: () => toast.success(`${choice.selected!.name} removed from this selection`) })
                  }
                >
                  Remove
                </Button>
              ),
            }}
          />
        </div>
      ) : (
        <p className="mt-2 text-sm text-[var(--warning)]">
          {choice.optional ? "You may choose one spell here." : "Choose one spell to complete this selection."}
        </p>
      )}
      {open && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            {choice.selected ? "Learning another spell replaces this selection. " : ""}Choices and requirements come from your enabled books. Verified identical reprints
            share one card; different rules versions and homebrew stay separate.
          </p>
          {options.isLoading || printingFacts.isLoading ? (
            <p role="status">Loading available spells…</p>
          ) : options.error ? (
            <div role="alert">
              Could not load spells.{" "}
              <Button variant="outline" onClick={() => options.refetch()}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              {printingFacts.error && <p role="status">Could not compare printings. Entries remain separate; no saved spells were changed.</p>}
              <SpellBrowser
                label="available spells"
                entries={groups.map(({ key, option, printings: versions }) => {
                  const o = versions.find((v) => v.elementId === printings[key]) ?? option;
                  const selected = choice.selected?.elementId === o.elementId;
                  const duplicate = learned.has(spellPrintingKey(o, identity));
                  const reason = duplicate
                    ? "Already learned for this feature. Choose a different spell."
                    : o.eligible === false
                      ? `Requires ${o.prerequisite || "a requirement this character does not meet yet"}.`
                      : o.prerequisite;
                  return {
                    id: o.elementId,
                    name: o.name,
                    source: o.source,
                    sources: versions.flatMap((v) => (v.source ? [v.source] : [])),
                    figures: o.spell,
                    requirement: reason,
                    status: selected ? "Learned" : undefined,
                    action: (
                      <Button
                        disabled={!!busy || selected || duplicate || o.eligible === false}
                        onClick={() =>
                          pick.mutate(
                            { choice, elementId: o.elementId },
                            {
                              onError: fail,
                              onSuccess: () => {
                                toast.success(`${o.name} selected`, { description: "Use Save to keep your builder changes." });
                                setOpen(false);
                              },
                            },
                          )
                        }
                      >
                        {busy ? "Updating…" : selected ? "Learned" : "Learn"}
                      </Button>
                    ),
                    details:
                      versions.length > 1 ? (
                        <label className="block text-sm">
                          Book printing
                          <select value={o.elementId} onChange={(e) => setPrintings({ ...printings, [key]: e.target.value })}>
                            {versions.map((v) => (
                              <option key={v.elementId} value={v.elementId}>
                                {v.source || "Unspecified source"}
                                {v.eligible === false ? " — requirements not met" : ""}
                              </option>
                            ))}
                          </select>
                          <span className="text-muted-foreground">
                            One spell, {versions.length} printings. Changing this preview does not change a learned spell.
                          </span>
                        </label>
                      ) : undefined,
                  };
                })}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}
