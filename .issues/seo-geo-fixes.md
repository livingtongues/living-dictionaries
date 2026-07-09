# SEO + GEO fixes (from otter /seo-audit 2026-07-09)

Live-crawl audit found the corpus largely invisible to crawlers. Jacob approved these fixes
(audit report in the otter session; command at `otter/claude/commands/seo-audit.md`).

## Approved scope

1. ✅→ **Sitemap**: `/sitemap.xml` index → per-dict `/sitemaps/{dict_id}.xml` generated on
   request from each dict.db. Child = `/{url}/entries`, `/{url}/about`, `/{url}/grammar`
   (only if `dictionaries.grammar` non-null), every `/{url}/entry/{id}`. Index also lists a
   static child (`/`, `/about`, `/dictionaries`, `/tutorials`). Cache-Control **1 week**
   (`s-maxage=604800`) so Cloudflare can intercept. Add `Sitemap:` line to robots.txt,
   drop stale comment.
2. **SSR /dictionaries**: `+page.server.ts` with public catalog rows (8 displayed columns);
   client store takes over for admin view + CSV as today.
3. ~~SSR entry lists~~ — SKIPPED intentionally (client-side rendering by design, keep server
   light). Instead: make `[dictionaryId]/home` SEO-ready (it will replace the `/{dict}` →
   entries redirect).
4. **JSON-LD**: DefinedTerm on entry pages · DefinedTermSet + Language on dictionary home ·
   WebSite + Organization on homepage. Escape `<` → `<` in JSON.stringify.
5. **Canonicals** in SeoMetaTags for every indexable page: origin + pathname, query stripped;
   entry page keeps explicit url prop; omit when norobots.
6. **og:image absolute** — prefix generated `/og?props=…` with origin.
7. **llms.txt** `+server.ts` route — what LD is, URL shapes, agent section (/api/v1 +
   openapi.json + per-dict Agents page), live counts from shared.db.
8. **h1 headword on entry page only** — via `svelte:element` in EntryField (lexeme field),
   ONLY if pixel-identical (verify with before/after screenshots).
9. **Homepage title dedupe** — `seoTitle` returns SITE_NAME when title === SITE_NAME.
10. **Entry image alt text** — headword + first gloss (Image.svelte thumb / EntryMedia).
11. ~~hreflang~~ — skipped.

## Key code facts

- `SeoMetaTags.svelte` = single head component; `seo-title.ts` beside it.
- Deletion is HARD in dict.db — every `entries` row is live (no deleted flag).
- `dictionary_db_path()` + `existsSync` guard pattern (see home/+page.server.ts — don't let
  `get_dictionary_db` create missing files).
- Homepage `+page.server.ts` already queries shared.db public dictionaries — reuse pattern.
- `[dictionaryId]` layout already 308s legacy ids → canonical slug (canonical-path.ts).
- `/api/v1/+server.ts` is a self-describing agent landing — llms.txt leans on it.

## Verification (mustang)

Dev server port 3041; curl sitemap/llms/canonical/JSON-LD from raw HTML; pixel-compare
entry page before/after h1 swap via headless puppeteer (browser-tools launch()).

## Status — ALL DONE 2026-07-09, verified on dev (mustang), awaiting Jacob review + commit

- ✅ 1 sitemap + robots — `routes/sitemap.xml/+server.ts`, `routes/sitemaps/[dict_id].xml/+server.ts`
  (special id `site` = static pages), `$lib/server/sitemap-helpers.ts`; robots.txt now has
  `Sitemap:` line. Verified: index lists site + achi; achi child = 487 URLs with lastmod; 404
  for unknown/private dict; `Cache-Control: public, max-age=3600, s-maxage=604800`.
- ✅ 2 /dictionaries SSR — `+page.server.ts` (8 columns, public only, ORDER BY name); page falls
  back to `ssr_dictionaries` until the client store loads. Verified SSR HTML has row + link;
  hydrated table identical, no page errors.
- ✅ 3 dictionary home — already had h1 + real card hrefs + resolved SSR; added DefinedTermSet
  + Language JSON-LD and a dictionary-specific meta description (about-snippet or generated).
- ✅ 4 JSON-LD ×3 — new `$lib/components/JsonLd.svelte` (escapes `<` → `<`); DefinedTerm on
  entry (public dicts only), DefinedTermSet on home, WebSite+Organization on homepage. All
  verified in SSR HTML.
- ✅ 5 canonicals — SeoMetaTags renders `<link rel=canonical>` (origin+pathname, query stripped;
  explicit `url` prop wins) when not norobots; og:url/twitter:url now use it too.
- ✅ 6 og:image absolute — `page.url.origin` prefix on generated `/og` URLs.
- ✅ 7 llms.txt — `routes/llms.txt/+server.ts`, live counts from shared.db, agent API section
  (/api/v1 + openapi.json + per-dict Agents page).
- ✅ 8 entry h1 — `svelte:element` in EntryField for the lexeme field. Pixel-compare before/after
  (sharp, raw bytes): **0 differing bytes** — Tailwind reset already neutralizes h1.
- ✅ 9 title dedupe — seoTitle returns SITE_NAME when title === SITE_NAME (+ test).
- ✅ 10 alt text — Image.svelte `alt={title}`; title (headword) is already passed at every call
  site. (No local photo data to render-verify; typechecked.)

`pnpm check` 0 errors · full vitest suite 1402 passed.

## Follow-ups for Jacob

- **Cloudflare** ✅ DONE (2026-07-09): zone had NO cache-settings ruleset at all. Created Cache
  Rule (ruleset `19a14f16…`, rule `543c900f…`) on the `http_request_cache_settings` phase:
  expression matches `/sitemap.xml`, `/sitemaps/*`, `/llms.txt`; action `set_cache_settings` with
  `cache: true` + `edge_ttl`/`browser_ttl` = `respect_origin` → our `s-maxage=604800` now drives
  edge TTL. Note: `.txt` was already cacheable by default here (robots.txt returns cf HIT), but
  `.xml` was not — this rule covers it. VERIFY AFTER DEPLOY: routes currently 301/404 in prod
  (new code not deployed), so once live, curl each twice and confirm `cf-cache-status: HIT`.
- After deploy: submit `https://livingdictionaries.app/sitemap.xml` in Google Search Console.
- When dictionary home GAs (replaces `/{dict}` → entries redirect), swap the child sitemap's
  `/{url}/entries` line for `/{url}` and consider canonicalizing home to `/{url}`.
