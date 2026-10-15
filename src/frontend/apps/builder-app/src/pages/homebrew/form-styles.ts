/** The Homebrew page forms' textarea and select styles (shared by its tabs). */
import { cn } from "@/lib/utils";

export const area = "w-full rounded-md border bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
export const select = cn(area, "h-9 py-1");
