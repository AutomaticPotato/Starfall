import { toast } from "sonner";
import { SpellBrowser } from "@/components/spells/spell-browser";
import { Button } from "@/components/ui/button";
import { useSpellIndex } from "@/lib/api/magic";
import { isPrepared, prepareProblem, preparedCount, togglePrepared, type Caster, type MagicState } from "@/lib/rules/magic";

/** Same cards and filters as the builder; retain the simulator's explicit DM override. */
export function PrepareSpells({ casters, magic, onChange }: { casters: Caster[]; magic: MagicState; onChange: (fn: (m: MagicState) => MagicState) => void }) {
  const index = useSpellIndex();
  const preparing = casters.filter((c) => c.prepares);
  if (!preparing.length) return <p className="text-sm text-muted-foreground">Your known spells are always ready; you do not need to prepare them.</p>;
  if (index.isLoading) return <p role="status">Loading spells…</p>;
  if (index.error) return <p role="alert">Could not load spell details. Try reloading the page.</p>;
  return (
    <div className="space-y-5">
      {preparing.map((c) => {
        const { count, max } = preparedCount(c, magic);
        const always = c.spells.filter((s) => s.kind === "always").map((s) => s.elementId);
        const ids = [...new Set([...always, ...c.preparable, ...c.spells.filter((s) => s.kind === "spellbook").map((s) => s.elementId)])];
        return (
          <section key={c.name} className="space-y-3">
            <h3 className="section-heading">
              {c.name} · {c.edition}
            </h3>
            <p role="status" className="text-sm">
              {count}
              {max !== null ? ` / ${max}` : ""} prepared{max !== null ? ` · ${Math.max(0, max - count)} remaining` : ""}. Always-prepared spells do not count.
            </p>
            <SpellBrowser
              label={`${c.name} preparation`}
              entries={ids.flatMap((id) => {
                const known = c.spells.find((s) => s.elementId === id);
                const f = index.byId?.get(id);
                if ((known?.level ?? f?.level ?? 0) === 0) return [];
                const on = isPrepared(c, magic, id);
                const name = known?.name ?? f?.name ?? "Unknown spell";
                const automatic = always.includes(id);
                const problem = on ? null : prepareProblem(c, magic, id);
                return [
                  {
                    id,
                    name,
                    source: f?.source,
                    figures: f,
                    status: automatic ? "Always prepared" : on ? "Prepared" : "Not prepared",
                    requirement: problem,
                    action: (
                      <Button
                        variant={on ? "outline" : "default"}
                        disabled={automatic}
                        onClick={() => {
                          if (!problem) {
                            onChange((m) => togglePrepared(c, m, id));
                            return;
                          }
                          if (max !== null && count >= max && window.confirm(`${problem}\n\nPrepare ${name} over the limit with your DM's permission?`)) {
                            onChange((m) => ({ ...m, prepared: { ...m.prepared, [c.name]: [...new Set([...(m.prepared[c.name] ?? []), id])] } }));
                            toast(`${name} prepared over the limit`, { description: "Unprepare another spell after the fight." });
                          } else if (!(max !== null && count >= max)) toast.error(problem);
                        }}
                      >
                        {automatic ? "Always prepared" : on ? "Unprepare" : problem && max !== null && count >= max ? "DM override…" : "Prepare"}
                      </Button>
                    ),
                  },
                ];
              })}
            />
          </section>
        );
      })}
    </div>
  );
}
