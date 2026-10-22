import { useState } from "react";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, TrashIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSaveInventory } from "@/lib/api/inventory";
import { newId } from "@/lib/id";
import type { CustomAttack, Inventory } from "@/lib/rules/items";
import { moveCustomAttack, orderedCustomAttacks, removeCustomAttack, saveCustomAttack } from "@/lib/rules/custom-attacks";

export function CustomAttacksEditor({ characterId, inventory }: { characterId: string; inventory: Inventory }) {
  const save = useSaveInventory(characterId);
  const [draft, setDraft] = useState<CustomAttack | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<CustomAttack | null>(null);
  const [error, setError] = useState("");
  const attacks = orderedCustomAttacks(inventory);
  const failed = (e: Error) => { setError(e.message); toast.error("Could not save custom attacks", { description: e.message }); };
  const update = (change: (current: Inventory) => Partial<Inventory>) => {
    try { save.update(change, failed); } catch (e) { failed(e as Error); }
  };
  return (
    <section className="space-y-3 rounded-lg border p-3" aria-label="Custom attacks">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-heading">Custom Attacks</h3>
        <Button size="sm" disabled={save.isPending || attacks.length >= 100} onClick={() => { setCreating(true); setError(""); setDraft({ id: newId(), name: "" }); }}><PlusIcon /> Add attack</Button>
      </div>
      <p className="text-xs text-muted-foreground">Write attacks for features, natural weapons or other abilities, including attacks imported from Aurora. Figures are used as written on your sheet, PDF and in battle. Changes save to equipment; use the builder’s Save or Discard to keep or revert the build.</p>
      {attacks.length === 0 && <p className="text-sm text-muted-foreground">No custom attacks yet.</p>}
      <ol className="space-y-2">
        {attacks.map((attack, index) => (
          <li key={attack.id} className="flex flex-wrap items-center gap-2 rounded-md bg-muted/30 p-2">
            <div className="min-w-0 flex-1 basis-40 break-words"><p className="font-medium">{attack.name}</p><p className="text-xs text-muted-foreground">{[attack.range, attack.toHit, attack.damage].filter(Boolean).join(" · ")}</p></div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" aria-label={`Move ${attack.name} up`} disabled={save.isPending || index === 0} onClick={() => update((current) => moveCustomAttack(current, attack.id, -1))}><ArrowUpIcon /></Button>
              <Button variant="ghost" size="icon" aria-label={`Move ${attack.name} down`} disabled={save.isPending || index === attacks.length - 1} onClick={() => update((current) => moveCustomAttack(current, attack.id, 1))}><ArrowDownIcon /></Button>
              <Button variant="ghost" size="icon" aria-label={`Edit ${attack.name}`} disabled={save.isPending} onClick={() => { setCreating(false); setError(""); setDraft({ ...attack }); }}><PencilIcon /></Button>
              <Button variant="ghost" size="icon" aria-label={`Delete ${attack.name}`} disabled={save.isPending} onClick={() => { setError(""); setDeleting(attack); }}><TrashIcon /></Button>
            </div>
          </li>
        ))}
      </ol>
      <Dialog open={!!draft} onOpenChange={(open) => { if (!open && !save.isPending) setDraft(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{creating ? "Add custom attack" : "Edit custom attack"}</DialogTitle><DialogDescription>Manual edits are preserved when you import the Aurora file again.</DialogDescription></DialogHeader>
          {draft && <form className="space-y-3" onSubmit={async (event) => {
            event.preventDefault(); setError("");
            // Await persistence so errors leave the draft open for correction or retry.
            try {
              const change = (current: Inventory) => saveCustomAttack(current, draft, creating);
              const next = { ...inventory, ...change(inventory) };
              await save.mutateAsync({ next, change });
              setDraft(null);
            } catch (e) { failed(e as Error); }
          }}>
            {([
              ["name", "Name", 200, "Thunder Gauntlets"], ["range", "Range", 100, "5 ft"],
              ["toHit", "Attack roll or save", 100, "+6 vs AC or DC 15 Dex"], ["damage", "Damage", 200, "1d8+3 thunder"],
              ["ability", "Ability", 40, "Intelligence"],
            ] as const).map(([key, label, maxLength, placeholder]) => <label key={key} className="block space-y-1 text-sm"><span>{label}</span><Input value={draft[key] ?? ""} required={key === "name"} maxLength={maxLength} placeholder={placeholder} disabled={save.isPending} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
            <label className="block space-y-1 text-sm"><span>Description</span><textarea className="min-h-24 w-full rounded-md border bg-background p-2" maxLength={5000} value={draft.description ?? ""} disabled={save.isPending} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={save.isPending} onClick={() => setDraft(null)}>Cancel</Button><Button disabled={save.isPending || !draft.name.trim()} type="submit">{save.isPending ? "Saving…" : "Save attack"}</Button></div>
          </form>}
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleting} onOpenChange={(open) => { if (!open && !save.isPending) setDeleting(null); }}>
        <DialogContent><DialogHeader><DialogTitle>Delete {deleting?.name}?</DialogTitle><DialogDescription>This attack will also stay removed when you reimport its Aurora file.</DialogDescription></DialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2"><Button variant="outline" disabled={save.isPending} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={save.isPending} onClick={async () => {
            if (!deleting) return;
            try { const change = (current: Inventory) => removeCustomAttack(current, deleting.id); await save.mutateAsync({ next: { ...inventory, ...change(inventory) }, change }); setDeleting(null); } catch (e) { failed(e as Error); }
          }}>Delete attack</Button></div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
