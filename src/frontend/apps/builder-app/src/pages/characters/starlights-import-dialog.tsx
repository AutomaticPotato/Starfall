import { useQueryClient } from "@tanstack/react-query";
import { FileInputIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { importCharacter, previewImport, readCharacterFile, serverMessage, type CharacterFile, type ImportPreview } from "@/lib/api/character-portability";

/**
 * Import a character exported from another Starlights server (.starlights.json): read the file, show what it is and
 * what this server lacks, and only on confirmation create it as a new character of the current player.
 */
export function StarlightsImportDialog({ player }: { player: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<CharacterFile | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setPreview(null);
    setError(null);
  }

  async function choose(chosen: File | undefined) {
    reset();
    if (!chosen) return;
    setBusy(true);
    try {
      const data = await readCharacterFile(chosen);
      setFile(data);
      setPreview(await previewImport(data, player));
    } catch (e) {
      setError(serverMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!file) return;
    setBusy(true);
    try {
      const result = await importCharacter(file, player);
      qc.invalidateQueries({ queryKey: ["characters"] }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["players"] }).catch(() => {});
      toast.success(`${result.name} imported`, { description: result.warnings.join(" ") || undefined });
      setOpen(false);
      reset();
      navigate(`/characters/${result.characterId}`);
    } catch (e) {
      setError(serverMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const summary = preview?.summary;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileInputIcon size={16} />
          Import Starlights character
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import a Starlights character</DialogTitle>
          <DialogDescription>
            A <code>.starlights.json</code> file exported from any Starlights server. It becomes a new character of {player}; nothing existing is changed, and it joins no campaign.
          </DialogDescription>
        </DialogHeader>

        <input
          type="file"
          accept=".json,application/json"
          disabled={busy}
          aria-label="Character file"
          className="block w-full text-sm file:me-3 file:rounded-md file:border file:bg-muted file:px-3 file:py-1.5"
          onChange={(e) => choose(e.target.files?.[0])}
        />

        {busy && !preview && <Spinner className="mx-auto my-6 size-5" />}
        {error && <p className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
        {preview?.error && <p className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{preview.error}</p>}

        {summary && !preview?.error && (
          <div className="space-y-3 text-sm">
            <div className="flex gap-3">
              {preview?.portrait ? (
                <img src={preview.portrait} alt="" className="size-20 shrink-0 rounded-lg border object-cover" />
              ) : (
                <div className="size-20 shrink-0 rounded-lg border bg-muted" />
              )}
              <div className="min-w-0">
                <p className="font-heading text-lg leading-tight">{preview!.name}</p>
                {preview!.renamed && <p className="text-xs text-muted-foreground">Renamed: {player} already has a character called {summary.name}.</p>}
                <p>
                  Level {summary.level} {summary.classes.map((c) => (summary.classes.length > 1 ? `${c.name} ${c.level}` : c.name)).join(" / ") || "(no class yet)"}
                </p>
                <p className="text-muted-foreground">
                  {[summary.species, summary.background, summary.edition === "unknown" ? null : summary.edition === "mixed" ? "2014 and 2024 rules" : `${summary.edition} rules`].filter(Boolean).join(" · ")}
                </p>
                <p className="text-xs text-muted-foreground">Exported {new Date(preview!.exportedAt).toLocaleString()}</p>
              </div>
            </div>

            {preview!.missing.length > 0 && (
              <div className="rounded-md border border-destructive/40 p-3">
                <p className="font-medium text-destructive">This server lacks content the character uses, so it can't be imported yet:</p>
                <ul className="mt-1 list-disc ps-5">
                  {preview!.missing.slice(0, 25).map((m) => (
                    <li key={m.id}>
                      {m.type} <strong>{m.name}</strong> from {m.source}
                      {m.homebrew ? " (homebrew: install its file on the Homebrew page)" : ""}
                    </li>
                  ))}
                  {preview!.missing.length > 25 && <li>… and {preview!.missing.length - 25} more</li>}
                </ul>
              </div>
            )}
            {preview!.homebrew.length > 0 && (
              <p className="text-muted-foreground">
                Uses homebrew: {[...new Set(preview!.homebrew.map((h) => h.source))].join(", ")}
                {preview!.homebrew.every((h) => h.installed) ? " (installed here)." : "."}
              </p>
            )}
            {preview!.warnings.map((w) => (
              <p key={w} className="flex gap-2 text-amber-700 dark:text-amber-400">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
                {w}
              </p>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={busy || !preview?.canImport} onClick={confirm}>
            {busy && preview ? <Spinner /> : null}
            Import as a new character
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
