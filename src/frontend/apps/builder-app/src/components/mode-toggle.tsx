import { PaletteIcon } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { THEMES, type Theme } from "@/lib/themes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function ModeToggle() {
  const { theme, setTheme, previewTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Theme>(theme);
  function close(next: boolean) {
    setOpen(next);
    previewTheme(null);
    if (next) setDraft(theme);
  }
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Choose theme">
          <PaletteIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Make yourself at home</DialogTitle>
          <DialogDescription>Preview a theme, then save it for this browser.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3" role="group" aria-label="Theme preview">
          {THEMES.map((t) => (
            <button
              type="button"
              key={t.id}
              aria-pressed={draft === t.id}
              onClick={() => {
                setDraft(t.id);
                previewTheme(t.id);
              }}
              className="flex min-h-20 items-center gap-4 rounded-xl border p-4 text-left hover:bg-muted aria-pressed:ring-2 aria-pressed:ring-ring"
            >
              <span className="flex shrink-0 -space-x-2" aria-hidden>
                {t.colors.map((color) => (
                  <span key={color} className="size-7 rounded-full border border-black/20" style={{ background: color }} />
                ))}
              </span>
              <span>
                <span className="block font-semibold">{t.name}</span>
                <span className="text-sm text-muted-foreground">{t.description}</span>
              </span>
            </button>
          ))}
          <Button
            variant="outline"
            aria-pressed={draft === "system"}
            onClick={() => {
              setDraft("system");
              previewTheme("system");
            }}
          >
            Follow device appearance
          </Button>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setTheme(draft);
              setOpen(false);
            }}
          >
            Save theme
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
