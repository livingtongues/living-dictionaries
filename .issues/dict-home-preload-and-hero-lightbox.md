# Dict home: anticipatory route preload + hero cover lightbox

## Diagnosis (done)
- Nav loading bar (root `+layout.svelte` `navigating?.to`) on home → entries is **cold route JS**,
  not Orama (Orama builds from `[dictionaryId]/+layout.ts` the moment home loads; layout doesn't
  re-run on the nav; `entries/+page.ts` is trivial).
- Body `data-sveltekit-preload-data="hover"` only applies to `<a>`; the search doorway is a
  `<button onclick={goto(...)}>` so nothing ever preloads it.

## Task 1 — preload entries + entry route code from dictionary home ✅
- `[dictionaryId]/+page.svelte` onMount → `requestIdleCallback` (setTimeout fallback for Safari) →
  `preloadCode('/{url}/entries')` + `preloadCode('/{url}/entry/_')` (SvelteKit 2: one pathname per call).
- Belt & braces: `onpointerenter`/`onfocus` on the search doorway button → preloadCode entries.

## Task 2 — hero cover image → fullscreen lightbox ✅
- Reuse `$lib/components/image/image-lightbox.svelte` (portal/backdrop/Escape). Bump fade 150→200ms
  + subtle scale-in on the image (shared with admin messages + chat composer — desired polish).
- Full-bleed invisible `<button class="hero-expand">` inserted after `.hero-scrim`, BEFORE
  HeroImageControls + `.hero-content` (document-order stacking keeps all controls above it).
  `cursor: zoom-in`, aria-label via new EN key `dict_home.view_cover_image`.
- Click-through gaps: `.hero-content { pointer-events: none }` when has-image + re-enable
  (`pointer-events: auto`) on its interactive/inline children; `h1 { width: fit-content }` so the
  area right of the title stays clickable. Text selection preserved on re-enabled elements.
- Lightbox src = same `image_src(serving_url, 'w1600')` the hero uses → cache-warm, instant paint.

## Verification
- Puppeteer vs dev (port 3041): confirm entries-route module requests fire at idle after home load,
  and click → nav completes with no new module fetches; before/after nav timing.
- Lightbox: browser click-through test (chips/search/edit buttons still work, empty area zooms),
  screenshot fullscreen viewer, Escape/backdrop close.

## Status
- [x] Task 1 code ✅
- [x] Task 2 code ✅
- [x] Browser verification ✅ (script: /tmp/ld-verify.mjs; seeded a prod lh3 cover onto dev `achi`)
  - nav home→entries: baseline 3267ms / 64 entries-route module requests at click →
    preloaded **89ms / 0 requests at click** (all 64 fetched at idle before click)
  - lightbox: opens from empty hero space (zoom-in cursor), Escape closes, search doorway +
    manager edit pencil + cover controls all still work, zero pageerrors (visitor + manager)
- [x] `pnpm check` 0 errors; eslint clean on touched files ✅
