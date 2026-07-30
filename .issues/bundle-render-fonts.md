# Bundle the share-card fonts instead of fetching Google Fonts at render time

**Filed 2026-07-30** out of the 2026-07-29 log review (`.cron/log-reviews/2026-07-29.md` §
`og_render_failed reason:"font"`) and the stabilization plan's item K (house
`.issues/stabilization-master-plan.md`). Deliberately NOT folded into the og-R2 store work — that
moves *where a card is stored*; this fixes *what a card looks like*.

house has the same fault against Hebrew and its own issue file
(`house/.issues/bundle-render-fonts.md`). **Fix one, port the shape to the other.**

---

## The fault

`site/src/routes/og/render-worker.js` bundles exactly one face — `notoSans.ttf`, 27 KB, Latin — and
reaches for **everything else over the network, per render**, through satori's `loadAdditionalAsset`
→ `https://fonts.googleapis.com/css2?family=…&text=…` behind a 3 s abort.

Two ways that goes wrong, and LD hits both:

1. **The fetch fails or times out** → `og_render_failed { reason: 'dynamic_font_fetch' }`, and the
   render retries with `static_fonts_only`.
2. **The fetch SUCCEEDS and the parse fails.** Google's Noto Sans Arabic carries a GSUB table
   satori's `@shuding/opentype.js` fork does not implement — `lookupType: 5 - substFormat: 3 is not
   yet supported` — thrown *inside* satori, which the `static_fonts_only` retry then catches.

Either way the card is rendered TWICE and ships **tofu** (▯▯▯) where the language should be.

### Measured, production, 2026-07-29

| | |
|---|---|
| `og_render_failed reason:"font"` | **1,536/day** |
| of which "Torwali English Urdu Dictionary" | **1,486 (97%)** |
| tail | Judeo-Kashani, Hazaragi, Kholosi — all Arabic-script |
| cost | every one is a DOUBLED render (~450 ms × 2) and still tofu |

So ~1,500 renders/day — a meaningful slice of the box's second core — are spent producing cards that
are wrong. Ruled 2026-07-27 as **pre-existing** and merely unmasked (not caused) by the 07-26 WebP
fix; do not re-derive that.

---

## What to build

- [ ] **Size it from telemetry first.** The `script` / `family` / `timed_out` fields landed on
      `og_render_failed` on 2026-07-30 (same lane as the R2 store), so after one day of production
      the failure set can be grouped by SCRIPT rather than guessed from a dictionary name. Query
      before choosing faces — a bundled font nobody needs is dead weight in the image.
- [ ] **Bundle the faces LD actually serves.** Arabic script is the whole headline; Devanagari,
      Bengali, Cyrillic and the rest of `language_font_map` are candidates only if the data says so.
      Same mechanism as today's Latin face: a `.ttf` under `src/routes/og/`, imported through the
      `raw_fonts(['.ttf'])` vite plugin, handed to the worker in `worker_data` and pushed into
      satori's `fonts` array.
- [ ] **Verify the bundled Arabic face actually PARSES.** This is the step that decides the whole
      job: Google Fonts' build of Noto Sans Arabic is the one that throws `lookupType: 5`. Candidates
      to render and compare: the notofonts.github.io static instance, Noto Naskh Arabic, and a
      `pyftsubset`/`fonttools` build with the unsupported lookups dropped. **Acceptance is a rendered
      PNG with real glyphs**, not a green test.
- [ ] **Keep the network fetch as the FALLBACK, never the primary.** Scripts we haven't bundled must
      still get their best shot; a bundled face just means the common ones never touch the network.
      Keep the 3 s abort and the bounded negative cache exactly as they are.
- [ ] **Watch the image size.** CJK faces are 10+ MB and are precisely why the `text=`-subsetted
      fetch exists — bundle those only if LD has real CJK dictionaries with share traffic, and prefer
      a subset build if so.
- [ ] **A worker test that renders a real card per bundled script** and asserts the PNG is not the
      tofu one. The cheapest honest assertion is a rendered-pixel comparison against a
      known-tofu render of the same string; `render-worker.test.ts` already drives the real chain.

## Verification

1. `render-worker.test.ts` renders one card per bundled script through the REAL worker.
2. Eyeball the PNGs (svelte-look or the test writing to `/tmp`) — tofu is obvious and a test that
   only checks "a PNG came back" would have passed every day of this bug.
3. Post-deploy: `og_render_failed reason:"font"` should collapse from ~1,500/day toward zero, and
   `og_card_rendered` count should DROP by roughly the same amount (each failure was a doubled
   render). Both are already in the coalesced telemetry.
4. Fetch a Torwali entry's `/og` card and look at it.

## Notes

- Don't bump `OG_IMAGE_VERSION` for this unless the cards visibly change for everyone — the Arabic
  cards that are wrong today are keyed by props, and a bump re-renders the whole world (see the
  90-day R2 lifecycle rule that garbage-collects orphaned generations).
- Actually — the cards ARE wrong today, and they're stored. Once the fonts land, the stale tofu cards
  must be invalidated for the affected dictionaries. Cheapest correct move: bump
  `OG_IMAGE_VERSION` and let the lifecycle rule reclaim the old generation. Decide with Jacob.
- `notoSans.ttf` being 27 KB says the current Latin face is already a subset — the same subsetting
  approach is available for whatever gets bundled.
