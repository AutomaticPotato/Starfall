/**
 * The Starlights ornament components (styles in styles/ornament.css): theme-coloured, decorative only — they are
 * hidden from assistive technology and never take clicks. Use them by the component's job: decorative on the home
 * page and landing sections, restrained on summary panels, none on dense controls and data.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Corner = "tl" | "tr" | "bl" | "br";

export function OrnamentalCorner({ corner }: { corner: Corner }) {
  return <span aria-hidden className="ornament-corner" data-corner={corner} />;
}

/** A thin frame with filigree corners around a section ("decorative" adds a second outline and larger corners). */
export function OrnamentalFrame({ level = "restrained", className, children }: { level?: "decorative" | "restrained"; className?: string; children: ReactNode }) {
  return (
    <div className={cn("ornament-frame", className)} data-level={level}>
      {children}
      {(["tl", "tr", "bl", "br"] as const).map((c) => (
        <OrnamentalCorner key={c} corner={c} />
      ))}
    </div>
  );
}

/** A horizontal rule with a four-pointed star (centred, or starting at the star). */
export function CelestialDivider({ align = "center", className }: { align?: "center" | "start"; className?: string }) {
  return (
    <div aria-hidden className={cn("celestial-divider", className)} data-align={align}>
      <span className="celestial-divider-line" />
      <span className="celestial-divider-star" />
      <span className="celestial-divider-line" />
    </div>
  );
}

/** A section title with an optional small caps line above it and a celestial divider under it. */
export function FantasySectionHeader({ eyebrow, title, description, as: Heading = "h2", className, children }: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header className={cn("space-y-2", className)}>
      {eyebrow && <p className="fantasy-eyebrow">{eyebrow}</p>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Heading className="font-heading text-2xl tracking-wide bg-none! pb-0!">{title}</Heading>
        {children}
      </div>
      <CelestialDivider align="start" />
      {description && <p className="text-muted-foreground">{description}</p>}
    </header>
  );
}

/** The Starlights compass star, drawn in the theme's ornament colours (for empty states and small brand marks). */
export function CelestialEmblem({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 48 48" width={size} height={size} className={cn("shrink-0", className)}>
      <circle cx="24" cy="24" r="17" fill="none" stroke="var(--ornament)" strokeWidth="1.2" />
      <circle cx="24" cy="24" r="12.5" fill="none" stroke="var(--ornament-line)" strokeWidth="0.8" />
      <path d="M24 2c1.2 9 4.6 13 13 14.2-8.4 1.2-11.8 5.4-13 14.2-1.2-8.8-4.6-13-13-14.2C19.4 15 22.8 11 24 2z" fill="var(--ornament)" transform="translate(0 7.8) scale(1 0.68)" />
      <path d="M2 24c9-1.2 13-4.6 14.2-13 1.2 8.4 5.4 11.8 14.2 13-8.8 1.2-13 4.6-14.2 13C15 28.6 11 25.2 2 24z" fill="var(--ornament-accent)" opacity="0.75" transform="translate(7.8 0) scale(0.68 1)" />
      <circle cx="24" cy="24" r="2.4" fill="var(--ornament-ivory)" stroke="var(--ornament)" strokeWidth="0.8" />
    </svg>
  );
}
