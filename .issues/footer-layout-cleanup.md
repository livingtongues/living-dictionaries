# Footer layout cleanup & mobile spacing

Clean up the site footer: centralize placement, fix the "floats up over content" scroll
behavior, pin to viewport bottom on short pages, roomier/bigger mobile controls, and stop the
dictionaries page from double-scrolling.

## Decisions (Jacob, 2026-07-07)
- **Centralize** the footer in root `+layout.svelte` (removed all per-page `<Footer>` imports).
- **Hidden** on app-workspace routes: `/[dictionaryId]/*`, `/admin/*`, `/chat`, `/translate`,
  `/tile-map`. Shown everywhere else (home, about, account, dictionaries, terms, etc).
- **No more `position: sticky; bottom:0`** — footer sits at the bottom of content, and a
  `min-height:100dvh` flex column pins it to the viewport bottom when the page is short (account).
- **Dictionaries page** = fit-to-viewport: the shell is exactly `100dvh` so the table scrolls
  internally and the page itself never scrolls.
- **Hot path protected**: Footer is **dynamically imported** in the layout, so its 121KB
  `homepage-baked.json` never enters the shared layout chunk on dictionary/entry pages.

## Done ✅
- ✅ `+layout.svelte`: `show_footer` + `fit_viewport` deriveds, sticky-footer flex wrapper,
  `{#await import('.../Footer.svelte')}` dynamic load.
- ✅ Removed per-page `<Footer>` from: `+page` (home), about, dictionaries, globe*, tutorials,
  create-dictionary, terms, home-preview*, privacy-policy, `+error`. (*globe & home-preview are
  being deleted by the concurrent home-swap agent — moot.)
- ✅ `dictionaries/+page.svelte`: `.dict-list-panel` `92vh`+sticky → `flex:1; min-height:0`.
- ✅ `Footer.svelte`: dropped desktop `position:sticky`; added `@media (max-width:767.9px)` block
  with more padding/line-height and larger, roomier-to-tap FB/IG/color-scheme controls.
- ✅ Verified: svelte-check 0 errors, eslint 0 errors, headless screenshots (mobile+desktop) —
  account/dictionaries have NO page scroll (footer pinned), about scrolls normally, chat/admin/
  dictionary/entries have NO footer and NO wrapper div (clean hot path), 0 runtime errors.

## ⚠️ Concurrent-agent collision (flag for Jacob)
Session `66b6a7f4` ("Switch home-preview to home") has **staged, uncommitted** changes in this same
working tree: deletes `/globe`, old `/home` components, moves globe topojson → home-v2/map, and swaps
`home-preview` → `/`. My footer edits to `globe` and `home-preview` are moot (files being deleted).
The new home-v2 `/` will pick up the footer automatically via the centralized layout. Both change
sets are intermixed in the working tree — coordinate the commits.
