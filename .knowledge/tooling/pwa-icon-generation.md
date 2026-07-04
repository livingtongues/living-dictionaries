# Generating PWA/manifest icon PNGs without ImageMagick/sharp

Neither `mustang` nor this repo has ImageMagick, `rsvg-convert`, Inkscape, or `sharp`
installed for one-off raster generation. The reliable fallback: render an HTML page (inline
SVG or `<canvas>`) with `puppeteer-core` + a local Chromium binary, screenshotting at the
exact target pixel size (`page.setViewport({ width: size, height: size })` then
`element.screenshot()`).

- `puppeteer-core` isn't a direct dependency of `site/`, but the linked `svelte-look` repo
  (`~/code/svelte-look`) has it — `require('~/code/svelte-look/node_modules/puppeteer-core')`
  works from a scratch script.
- Local Chromium binary on this machine: `~/.local/bin/chromium` (found via
  `chrome-launcher`'s `Launcher.getInstallations()`).
- To decode an existing PNG's raw pixels without a library (e.g. to check whether an icon
  has hidden padding/shadow baked in before regenerating it), a ~40-line manual
  zlib-inflate + PNG-unfilter script works fine for 8-bit RGBA non-interlaced PNGs.

## Android adaptive-icon / maskable-icon gotcha (2026-07 fix)

Both LD and house's installed-PWA icons showed a tiny mark floating in a mostly-empty
circle on Android home screens. Two compounding causes, worth checking for any new PWA icon:

1. `manifest.json` icons had no `"purpose": "maskable"` — Android defensively shrinks
   icons further before masking them into the launcher's adaptive shape when it doesn't know
   the icon already has safe padding.
2. The source PNGs themselves had baked-in padding/rounding/shadow (both were exported from
   an old favicon-generator-style tool that adds a "card + drop shadow" look) — so even after
   declaring `maskable`, the icon would still look shrunk since the artwork itself wasn't
   edge-to-edge.

Fix pattern: regenerate the icon as a **flat, full-bleed background** (no baked rounding/
shadow) with the mark sized to roughly 62-75% of the tile width, centered — then declare
`"purpose": "any maskable"` on the same file (one asset serves both; no need for separate
maskable/any variants when the background already fills the canvas). Verify by rendering a
`clip-path: circle(50%)` preview of the final PNG before shipping — that's what the Android
launcher actually shows.

LD's icon mark is the book+wifi glyph from `static/icons/safari-pinned-tab.svg` (deliberately
*without* its outer circle — the circle clashes with launcher-applied mask shapes and is hard
to align), on the brand teal radial gradient (`#7f9daa` center → `#546e7a` edge, same teal
used in `routes/og/OpenGraphImage.svelte` / `SvgGlobe.svelte`).
