/**
 * What something is, over its name: pointing at the name opens it after a moment, a tap (a phone) opens and closes it,
 * and it stays open while the pointer is on it, so a long text can be read and scrolled. The content is only built
 * while it is open. Used for spells, features and weapons in the Battle Action Simulator, creatures in encounter mode.
 */
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const OPEN_DELAY = 250;
const CLOSE_DELAY = 200;

export function Peek({
  content,
  label,
  className,
  contentClassName,
  children,
}: {
  /** what opens: built only while it is open */
  content: () => ReactNode;
  /** what a screen reader says for the name ("Fireball: what it does") */
  label?: string;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const later = (fn: () => void, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  // the pointer, not a finger: a tap is a click, and the click toggles it
  const hover = (on: boolean) => (e: PointerEvent) => e.pointerType === "mouse" && later(() => setOpen(on), on ? OPEN_DELAY : CLOSE_DELAY);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerEnter={hover(true)}
          onPointerLeave={hover(false)}
          aria-label={label}
          className={cn("cursor-help text-left underline decoration-dotted decoration-current/40 underline-offset-4", className)}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={8}
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
        className={cn("max-h-[min(70vh,40rem)] w-[min(94vw,32rem)] overflow-y-auto p-3 text-sm", contentClassName)}
      >
        {open && content()}
      </PopoverContent>
    </Popover>
  );
}
