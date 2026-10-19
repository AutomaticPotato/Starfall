# Official Project Starfall artwork

Owner-supplied `Project Starlights Celestial Emblem.png`; original is preserved outside the repository.
SHA-256: `7de485acdbc275b4884ae66edb33ec0089ede1d506c2d73511f3050fb2050d38`.

`tools/frontend/branding.mjs` deterministically resizes/crops the actual artwork using headless Chromium canvas. It takes the original path as its argument and `PLAYWRIGHT_MODULE` as the installed module path. No artwork is regenerated and no background removal is attempted. The full logo retains the wordmark; the navigation and touch image retain the compass; tiny favicon sizes use the central D20. All retain intentional navy framing. Images have explicit dimensions at call sites.

## Starfall homepage artwork

`starfall/starfall-{midnight,porcelain,slate}.webp`: the owner-supplied pack `Starfall Theme_Assets_for Claude_Code.zip`,
copied unchanged (512 × 870, WebP; the pack's PNG copies stay outside the repository). The homepage shows the one for
the theme in use (`useTheme().resolvedTheme`), whole and unscaled beyond its width. The navigation emblem and the
favicons above are unchanged; `starlights-logo.webp` is no longer shown.
SHA-256: midnight `fc1ef64b…0e536ace`, porcelain `ddc6f7a7…54862c898`, slate `d7dd010f…f4c4e55`.

