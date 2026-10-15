# Official Project Starlights artwork

Owner-supplied `Project Starlights Celestial Emblem.png`; original is preserved outside the repository.
SHA-256: `7de485acdbc275b4884ae66edb33ec0089ede1d506c2d73511f3050fb2050d38`.

`tools/frontend/branding.mjs` deterministically resizes/crops the actual artwork using headless Chromium canvas. It takes the original path as its argument and `PLAYWRIGHT_MODULE` as the installed module path. No artwork is regenerated and no background removal is attempted. The full logo retains the wordmark; the navigation and touch image retain the compass; tiny favicon sizes use the central D20. All retain intentional navy framing. Images have explicit dimensions at call sites.
