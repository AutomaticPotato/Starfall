/**
 * The site's background art at /art/. The app ships lore.webp, battle.webp and homebrew.webp (public/art); nginx
 * serves a group's own pictures of the same name from its art folder (deploy/data/art) first.
 */
export const ART_BASE = "/art/";

/** The landing page's backgrounds, one per hour of the day in turn. */
export const HOME_BACKGROUNDS = ["home-1.webp", "home-2.webp", "home-3.webp", "home-4.webp", "home-5.webp"].map((f) => ART_BASE + f);

export const LORE_BACKGROUND = `${ART_BASE}lore.webp`;
export const BATTLE_BACKGROUND = `${ART_BASE}battle.webp`;
export const HOMEBREW_TILE = `${ART_BASE}homebrew.webp`;

/** The background for an hour: they take turns, a new one each hour. */
export function homeBackgroundAt(date: Date): string {
  const hours = Math.floor(date.getTime() / 3_600_000);
  return HOME_BACKGROUNDS[hours % HOME_BACKGROUNDS.length];
}
