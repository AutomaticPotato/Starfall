# Starfall visual-fidelity correction (2026-10-21)

Owner's pack `Starfall_Claude_Visual_Fidelity_Pack.zip` (Copyparty data folder; `CLAUDE_MISSION.md` authoritative).
Targets: `references/01_TARGET_dashboard_three_themes.png` (homepage composition), `02_TARGET_astral_design_system.png`
(style). Branch `feature/visual-fidelity` from `aurora-server` `79610c3`. Frontend only: no backend, database, API,
rules, Aurora import, PDF or route change.

## What changed

- **One page frame** (`components/ornaments.tsx:StarfallShell`, `styles/ornament.css` "shell") around header, page and
  footer in both app layouts (`App.tsx`: `App` 90rem wide, `AppWide` 120rem for the tool pages). A 1px double rule in
  the theme's metal/blue line colours with the supplied `page-corner` on all four corners (mirrored) and
  `edge-horizontal` / `edge-vertical` jewels mid-side. Placement comes from the SVGs' geometry (corner rule 13/256 in,
  radius 31/256; inner rule 7/256 further in; edges ruled through their middle), so every picture lies on the line
  (checked to ±1.5px by `tools/frontend/ornaments.mjs`). At least one screen tall (footer at the foot). 128px corners
  from 1280px, 88px at 768–1279px, no frame on phones (<768px) or in print. Replaces `PageCorners` (corners floating
  in the empty margins: the "detached ornament" defect).
- **Homepage** (`pages/landing/Index.tsx`): the 512 × 870 portrait is gone from the hero. Compact brand block (the
  supplied `home-d20-icon` over a live STARFALL wordmark, theme gradient, site font) beside the eyebrow + rule and the
  introduction; the feature grid is target-shaped (Character Builder 2 of 4 columns over two rows, four tiles right,
  31rem high) with thin metal borders, a bottom-up shade for legible copy and a chevron; one `tile-corner` accent
  per tile (top left; the Character Builder also bottom right); no frame around the grid any more; the three support
  panels sit directly under the grid with Lucide icons in the ornament colour. Header text "Project Starfall" →
  "STARFALL" (also the home link's label and the page `<title>`); the footer credits stay.
- **Themes** (`styles/themes.css`, `lib/themes.ts`): Porcelain warm ivory (`#f4f0e8`) with a slate-blue primary
  (`#33508a`, was indigo); **Slate is now dark** slate blue/charcoal (`#2d3e51`, panels `#273749`, pale text, silver-blue
  primary), as in the mockup (it was a light grey theme; its pale artwork was made for the dark one); Midnight a
  deeper navy (`#0c1628`). `isDarkTheme` (Midnight, Slate) sets `dark` / color-scheme (provider, toasts). `index.html`
  sets the saved theme before the first paint (no flash of Porcelain on reload).
- **Across the app**: every page gets the frame and shared header; the home tile accent is reused on the Lore banner
  (`pages/lore/lore-home.tsx`, two corners) and campaign cards (`pages/campaigns/campaigns-page.tsx`, one corner, hover
  glow). Dense screens (builder, sheet, battle, encounter, Lore reader, tables) get nothing beyond the frame.
- **Checks** (`tools/frontend/`): `ornaments.mjs` now tests the attached frame (8 shell ornaments on the line from
  768px, none on phones, print removes them, missing files change nothing) on 11 pages; `homepage-branding.mjs` tests
  the new hero (theme before first paint, emblem per theme, no portrait, brand block not portrait-shaped, intro beside
  it, Builder tile left of four smaller tiles, no overflow/shift, theme switch + reload).

## Assets installed (`src/frontend/apps/builder-app/public/ornaments/<midnight|porcelain|slate>/`)

Already there (PR #11, unchanged): `page-corner`, `panel-corner`, `tile-corner`, `section-divider`, `section-marker`,
`nav-active-underline`. Added from `assets/universal/`: `home-d20-icon.svg`, `edge-horizontal.svg`, `edge-vertical.svg`
(9 files, byte-identical to the pack; SVGs checked: no scripts, external references or embedded images). Not
installed: `celestial-accent`, `botanical-sprig-optional`, `shooting-star-optional` and every PNG (SVGs render well;
the optional pieces were not needed for the target). The legacy portraits stay in `public/branding/starfall/`, unused.
No reference image or mockup crop is in the bundle.

## Verification (disposable install only: SQL `starfall-vf-sql`, API 8241, web before 8242 / after 8243)

| Check | Result |
| --- | --- |
| Frontend build (`tsc -b` + Vite), Vitest | PASS; 29 files / 256 tests passed, 5 skipped |
| ESLint on the 9 changed source files | clean. Whole app: 38 errors, all in files this branch does not touch (unchanged from `aurora-server`; CI does not lint) |
| `homepage-branding.mjs` (3 themes × 320–1920px, switching, reload) | 20/20 |
| `ornaments.mjs` (11 pages × 3 themes × 390/768/1440/1920, theme switch, print, missing files) | 92/92 |
| `smoke.mjs` (synthetic API; 90 viewport/theme/page checks, spells, HP, theme cancel) | PASS. It was already failing on `aurora-server` (waited for the "Project Starlights" logo removed in PR #7); its home wait and Slate button name are updated |
| `accessibility.mjs` (keyboard section navigation, theme preview/Escape/focus, failed-save rollback) | PASS |
| axe-core 4.10 WCAG 2 A/AA, 13 pages × 3 themes, before vs after | no new violations; Slate battle page 4 → 1. Left (both builds): violet chip on `/battle/:id` (3.3–3.9:1), `nested-interactive` on Characters cards |
| PDF sheet field values (`/characters/:id/sheet?fields`, 3 imported characters) | byte-identical before/after |
| Screenshots (page errors, failed requests, horizontal overflow) | 0 / 0 / 0 on every shot, before and after |

Screenshots (BEFORE/AFTER, every theme): `~/.cache/starlights-test/vf/shots/` (`before-home`, `before-app`,
`final-home`, `final-app`, `final-app-wide`); contact sheets in `~/.cache/starlights-test/vf/`.

## Remaining differences from the mockup

- Wordmark: live text in the site font (sans, wide tracking, metallic gradient); the mockup's is a Trajan-like serif.
  A display serif would mean a new font dependency; left to the owner.
- The supplied page corners are finer and plainer than the mockup's painted floral corners; used as supplied.
- Navigation emblem: still the established raster emblem with its navy frame (as in the Porcelain mockup).
- `/characters/:id/builder` (the upstream debug builder with fixed side panels) keeps its own layout, no frame.
- The builder's fixed save bar spans the whole window across the frame on desktop.
- `tools/frontend/qa.mjs` (Codex's final QA) still looks for the pre-PR #7 logo and a fixed port: stale before this
  branch too, not run.

## Not done / for the owner

Production not deployed. Branch `feature/celestial-polish` (another session's unpushed commit `f4d4e85`, 2026-10-21)
edits the same three files with an entrance-strip approach this mission replaces: do not merge both.
