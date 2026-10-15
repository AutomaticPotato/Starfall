/**
 * The home page's homebrew workshop: one tile per thing the group can make, each opening the Homebrew page on its
 * "new" form (players see the page; making needs the admin password).
 */
import { BookOpenIcon, FlameIcon, GemIcon, ShieldIcon, SkullIcon, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

const MAKE: { tab: string; title: string; text: string; icon: LucideIcon }[] = [
  { tab: "monsters", title: "Monster", text: "A stat block your encounters can add.", icon: SkullIcon },
  { tab: "items", title: "Magic item", text: "Gear the builder and campaigns hand out.", icon: GemIcon },
  { tab: "classes", title: "Class", text: "With multiclassing, subclasses and spellcasting.", icon: ShieldIcon },
  { tab: "subclasses", title: "Subclass", text: "For a book's class or your own.", icon: BookOpenIcon },
  { tab: "spells", title: "Spell", text: "On the class lists you choose.", icon: FlameIcon },
];

export function HomebrewSection() {
  return (
    <section aria-labelledby="homebrew-workshop" className="my-12 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="homebrew-workshop" className="font-heading text-2xl tracking-wide">
          Homebrew workshop
        </h2>
        <Link to="/homebrew" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Everything your group has made
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {MAKE.map(({ tab, title, text, icon: Icon }) => (
          <Link
            key={tab}
            to={`/homebrew?tab=${tab}&new=1`}
            className="group flex min-h-28 flex-col gap-1 rounded-xl border bg-background/60 p-4 backdrop-blur-sm transition-colors hover:border-primary/60 hover:bg-background/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Icon className="size-5 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden />
            <span className="font-heading text-lg tracking-wide">New {title.toLowerCase()}</span>
            <span className="text-sm text-muted-foreground">{text}</span>
          </Link>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Homebrew stays switched off until a player ticks it in a character's Sources, or a DM turns on Use homebrew for a campaign.</p>
    </section>
  );
}
