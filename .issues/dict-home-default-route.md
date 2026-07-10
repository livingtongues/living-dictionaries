# Dictionary /home becomes the default dict route

Decisions (Jacob):
- Full GA: everyone lands on home at `/{dict}`; admin-3 preview gate + shield removed.
- NO redirect from old `/{dict}/home` — Google never saw it (sidebar link was admin-gated in SSR HTML, never in sitemaps). Route is deleted.
- Tab title: "Gta? Living Dictionary" (expanded name, no site suffix) — tweak `seoTitle` to return expanded dictionaryName when title empty.
- Sidebar: keep "Home" label (`dict_home.home`), swap icon fa6-solid/house → **mdi/book-open-page-variant-outline** (the "Living Dictionary" node icon in AgentApiDiagram on site home) to differentiate from site-home house icon.
- Sitemap: add bare `/{slug}` now; Google discovery happens organically (no Search Console re-blast — /entries stays a real page; bare slug was a 307 before so likely not indexed).
- Unlisted dicts already excluded from all SEO surfaces (sitemaps + homepage map `WHERE public = 1`; `norobots={!dictionary.public}`; JSON-LD gated) — no changes needed.
- Settings page: remove everything now editable from home (name, iso, glottocode, gloss languages, orthographies, alternate names, WhereSpoken map, location, featured image). Keep: print_access, public checkbox, delete-dictionary contact, admin JSON.

## Tasks
- ✅ Move `home/+page.svelte` → `[dictionaryId]/+page.svelte` (fix relative imports `./X` → `./home/X`, `../contributors` → `./contributors`; drop `title` prop from SeoMetaTags)
- ✅ Move `home/+page.server.ts` → `[dictionaryId]/+page.server.ts`; delete the redirect `[dictionaryId]/+page.ts`
- ✅ Move `home/_page.stories.ts` → `[dictionaryId]/_page.stories.ts`
- ✅ SideMenu: un-gate, href `/${dictionary.url}`, active = `page.route.id === '/[dictionaryId]'`, new icon, drop shield
- ✅ `seoTitle`: `if (!title) return dictionaryName || SITE_NAME` + test
- ✅ Sitemap child: prepend `{ loc: /{slug} }`, update doc comment
- ✅ Settings trim + delete `settings/+page.ts` (inline small save wrapper for the two checkboxes); update SEO description text
- ✅ NudgeCard: location nudge opens the map modal (MapPanel `show_modal` becomes bindable) instead of linking to settings; image nudge drops the settings fallback; `nudge_location` also requires `!is_con_lang`
- ✅ Update `$lib/db/server/dict-home.ts` comment + AGENTS.md routes section
- ✅ Verify: vitest (full suite 1476 passed), lint, svelte-check 0 errors, svelte-look stories (page + SideMenu), live dev SSR checks (`<title>Achi Living Dictionary</title>`, home content at bare route, `/achi/home` → 404, sitemap lists bare slug first, trimmed settings 200s)

## Follow-on (same session): map crop fix
Jacob reported N/S-spread coordinates getting cropped in the home map panel — the panel
requested a fixed 480x280 image but displays it `object-fit: cover` in boxes up to ~4:1
(solo full-width + `max-height: 20rem`).
- ✅ `static_map_height` in `home/home-helpers.ts` (tested): request height tracks the measured
  box aspect, quantized to 40px steps (cache-friendly), clamped 120-480.
- ✅ MapPanel binds `clientWidth/Height` of the map button and passes the derived height; waits
  for measurement before rendering (avoids a throwaway 280px fetch).
- ✅ MapboxStatic got a `fill` prop (img + placeholder cover the parent; placeholder inline px
  width otherwise beats any parent `width:100%` rule) — MapPanel dropped its `:global` overrides;
  EntryMedia caller untouched.
- ✅ `/api/map-static` adds `padding=40` on auto-fit viewports so edge markers survive the
  residual quantization crop.
- ✅ MapPanel WithCoordinates story gained a 1200x340 viewport for the solo-wide case.

## Lessons/notes
- `[dictionaryId]/+layout.server.ts` already 301s legacy ids → canonical slug for the bare path.
- SideMenu.stories.ts had no home-link flavor gating to update (confirmed).
- Dev has no real Mapbox token (`map-static` 404s → gray placeholder), so the real-image aspect
  behavior needs a spot check on production after deploy: a dict with N/S points, solo map
  (no about/grammar), markers should sit fully inside the frame.

## Follow-up (2026-07-10)
- ✅ Perf logging audit: page_load / web vitals / SPA navigation are all wired globally in the root layout, so the dict home was already emitting metrics — but `normalize_route` still bucketed a bare `/{dict}` as `dictionary:entries` (stale from the redirect era). Now: bare root → `dictionary:home`, `/[dict]/entries` → `dictionary:entries`, `/[dict]/entries/[id]` → `dictionary:entry`. Tests updated. Historical rollup days keep their old bucket names (watermark-frozen) — fine, pre-change bare-root navs were redirects anyway.
- ✅ Copied the real Mapbox token from the living VPS into site/.env (gitignored) — dev now serves real static maps (`dummy` guard in /api/map-static no longer trips). Token is $env/static/public, so restart the dev server to pick it up.
