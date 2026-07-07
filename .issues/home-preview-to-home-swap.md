# Swap /home-preview → / (make homepage v2 the real homepage)

Make the homepage-v2 preview the actual `/` homepage, delete the old Mapbox home page +
the superseded `/globe` experiment + all now-orphaned components/data, fully i18n the page
(Jacob rewrote the hero copy as hard-coded English), then AI-draft translations for the
new/changed keys.

Decisions (from Jacob, 2026-07-07):
- **Q1 = A**: also delete `/globe` + old-home cluster + orphaned land data; keep only the
  country topojson home-v2 needs.
- **Q2 = A**: reuse existing `home_v2.headline` / `home_v2.subline` keys, update their English
  to Jacob's rewritten hero copy, let AI fill re-translate.
- **Q3 = A**: prune now-orphaned + pre-existing dead i18n keys.
- **Q4 = A**: two-phase. Phase 1 = all code + i18n wiring, STOP before commit. Jacob
  reviews/commits/pushes (deploy). Phase 2 = run /fill-translations against prod + refresh seeds.

## Phase 1 — code (do NOT commit) ✅ DONE

### Swap the page ✅
- ✅ Replace root `src/routes/+page.svelte` with home-preview's version (hero h1/subline wired to i18n)
- ✅ Replace root `src/routes/+page.ts` with home-preview's pass-through load
- ✅ Add root `src/routes/+page.server.ts` (git mv from home-preview — map_dicts + ssr_map)
- ✅ Delete `src/routes/home-preview/` entirely
- ✅ Nothing references `/home-preview` in src (verified) — no redirects needed (unknown routes already 301→/)

### i18n wiring (hard-coded strings → keys) ✅
- ✅ `+page.svelte` h1 → `t('home_v2.headline')`, subline → `t('home_v2.subline')`
- ✅ Update en.json `home_v2.headline` = "Serving Language Communities Around the World"
- ✅ Update en.json `home_v2.subline` = "Collaborative, multimedia dictionaries built by communities speaking endangered and under-represented languages."
- ✅ `FeaturedEntryFullscreen.svelte` aria-label → `t('misc.pause')`/`t('misc.play')`
- ✅ `WordCards.svelte` aria-label → `t('misc.pause')`/`t('misc.play')` (added page/t import)
- ✅ `HeroSearch.svelte` aria-label "Clear" → `t('misc.clear')`
- ✅ Add `misc.play`, `misc.pause`, `misc.clear` (SEO description/keywords stay English as before)

### Delete /globe + orphans ✅
- ✅ Delete `src/routes/globe/`
- ✅ Delete `src/lib/components/home/` (DictionaryPoints, MyDictionaries, Search, SearchDictionaries[.stories], SelectedDict)
- ✅ Move `countries-{110m,50m}.json` → `home-v2/map/data/` (git mv); updated 2 import sites → relative `./data/…`
- ✅ Delete rest of `src/lib/components/globe/` (Canvas, Globe, Zoomer, DictionaryPoints, constants.ts, utils/, land-110m/50m) → whole folder gone
- ✅ Kept mapbox infra (`maps/mapbox/*`) — still used by settings/entry/synopsis maps
- ✅ /og keeps its own `routes/og/land-110m.json`

### Prune dead i18n keys (en.json) ✅
- ✅ Removed `home.main_banner`, `home.show_all_my_dictionaries`, `home.public_dictionaries`
- ✅ Removed `home_v2.showcase_heading`, `showcase_subline`, `map_hint_wheel`, `zoom_in`, `zoom_out`
- ✅ KEEP: home.read_more, home.open_dictionary, home.my_dictionaries, home.find_dictionary, home.no_results, home.list_of_dictionaries

### Docs ✅
- ✅ AGENTS.md Routes: `/` now = homepage v2; removed `/home-preview` line
- ✅ `.knowledge/domain/homepage-v2.md`: swap done, moved-data path, deleted globe/old-home

### Verify ✅
- ✅ `pnpm check` → 0 errors
- ✅ `pnpm eslint` on changed files → clean
- ✅ `pnpm test` → 1319 passed / 3 skipped
- ✅ Headless puppeteer screenshot of `/` (desktop + mobile) — hero i18n copy, canvas map,
     294 cards, 6 stats, 6 features, footer, i18n search placeholder; only console noise is the
     Google One-Tap CORS block (headless artifact). Admin-3 API diagram correctly hidden.

**NOTE:** the working tree also holds the concurrent Footer-agent's edits (Footer.svelte,
+layout.svelte, +error.svelte, about/create-dictionary/dictionaries/privacy-policy/terms/tutorials
+page.svelte). Those are NOT mine — Jacob to review/commit together.

## Phase 2 — AI translation fill ✅ DONE (2026-07-07, prod)
- ✅ Backed up prod first: `r2/backups-rolling/db/living/2026-07-07T06-23-45Z.tar.zst`
- ✅ Verified deploy `e15d3258` mirrored keys into prod: 3 new (`misc.play/pause/clear`),
     2 changed en (`home_v2.headline/subline`), 8 soft-deleted (pruned).
- ✅ `en_changed` queue = **0** (headline/subline had no prior translations → just "missing", nothing to triage).
- ✅ Scope = the whole homepage: **44 keys × 17 locales = 748 missing cells** (all 41 `home_v2.*`
     never translated during preview + 3 new `misc`). Other homepage keys already translated.
- ✅ Drafted + inserted all **748** into prod `i18n_translations` (`source='ai'`, `needs_review='ai'`,
     `updated_by_name='AI (fill-translations)'`, `ON CONFLICT DO NOTHING`) — 44/locale, 0 conflicts.
     `{count}` tokens preserved; brand `api_ld_label` matches each locale's `misc.LD`;
     `feature_free_body` keeps the English org name so the link-split still works.
- ✅ `pnpm i18n:refresh` (pulls prod export) → 17 non-English locale files updated, no `en.json` change.
- ✅ Validated all 90 locale JSONs parse; full `pnpm test` green (1319 pass).
- ✅ End-to-end render check: `/` in `es` (LTR) + `he` (RTL) — hero/stats/features/CTA all translated,
     RTL layout correct, map connector shows "· N ערכים".

### Handoff to Jacob (per commit rule — I did NOT commit)
- The 17 `src/lib/i18n/locales/*.json` files are staged-ready but **uncommitted**. Review + commit
  (`i18n: AI translation fill 2026-07-07`) + push → deploy bakes them into the app for end users.
- **Commit selectively**: the working tree also has an UNRELATED in-flight `HeroSearchBar` refactor
  (`+page.svelte`, `QuickJump.svelte`, new `HeroSearchBar.svelte`/`.stories.ts`) — not mine.
  `git add src/lib/i18n/locales/` to keep the i18n commit clean.
- "Notify translators" on `/translate` is now safe to press (748 AI drafts await review).

## Notes / findings
- Mapbox is NOT orphaned: settings/WhereSpoken, [dict]/synopsis/VisualMap, [dict]/entry EntryMedia + GeoTaggingModal all use it.
- home-v2 map only needs `countries-110m.json` (bundled) + `countries-50m.json` (lazy). land-* only served old /globe + /og(own copy).
- An agent is editing the site Footer concurrently — no overlap with this work.
