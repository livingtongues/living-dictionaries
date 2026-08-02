# /create-dictionary page improvement — DONE, awaiting Jacob's review

Driven by the 2026-08-01 SEO/GEO audit: the page is the site's best-converting page (6.80% CTR,
position 2.2 for "dictionary maker") yet its SSR HTML had 58 chars of own text, no h1, no JSON-LD,
and was in no sitemap. Goal was primarily to make the page genuinely useful, with the mission
stated warmly and the conlang handling kept but de-fanged.

**Everything is uncommitted on `main`.** Files touched (only these — the maps refactor,
monthly-metrics etc. in the working tree are other sessions' work, untouched):

- `site/src/routes/create-dictionary/+page.svelte` — content + JSON-LD + styles; form logic unchanged
- `site/src/routes/create-dictionary/_page.stories.ts` — NEW svelte-look stories (Visitor,
  VisitorDesktop, ConlangBranch)
- `site/src/lib/i18n/locales/en.json` — new `create.*` keys, 3 old conlang keys removed
- `site/src/routes/sitemaps/[dict_id].xml/+server.ts` — 3 URLs added to the `site` branch
- this file

## What changed

### Page structure (SSR, all through `t()`)

- **Above the form:** `<h1>` "Create a Dictionary for Your Language" (`create.page_title`), a
  two-sentence lede stating what it is + the mission (`create.lede_1`), a chip strip of the six
  homepage feature titles (REUSES `home_v2.feature_*_title` — icons match FeaturesGrid, already
  translated), and a short "name your language below to begin" pointer (`create.lede_2`).
- **The form itself: untouched behavior.** Same fields, validation, URL-uniqueness check, consent
  questions, submit flow.
- **Below the form:** five question-styled `<h2>` sections (`create.faq_*_q/_a`): what is a Living
  Dictionary / who are they for / what do you need before you start (consent + author connection,
  and that dictionaries start private) / what happens after you create it / can I create one for a
  constructed language. These double as the FAQPage JSON-LD — one shared `faqs` array feeds both
  the markup and the structured data so they can't drift.

### Conlang tone (the subtle part)

- **`create.conlang_warning` is GONE.** It was shown to everyone who answered "No" — and, due to
  `{#if !conlang}` matching `undefined`, even *before* answering — so the first thing a legitimate
  community linguist read was "we reserve the right to remove it." Replaced by a one-line neutral
  hint under the question, always visible (`create.conlang_hint`): "Constructed languages
  (conlangs) are hosted here under their own terms, so please answer accurately." Substance kept
  (accuracy matters, separate handling), threat dropped.
- **`conlang_info_1/2` → `conlang_terms_1/2`**, rewritten matter-of-fact: "we are not able to
  offer" instead of the repeated "we do not offer"; "may be removed" only in the derogatory-content
  clause where it belongs. Same facts: no support/imports, not public/not on the map.
- **The FAQ answers the conlang question openly** ("Yes. …answering yes simply sets your dictionary
  up under its own terms…") — emphasis, not exclusion; honest self-selection without scolding.
- **New keys, not edited-in-place**: old keys removed from en.json so the DB i18n catalog drops
  them — otherwise other locales would keep serving the old threatening translations under the
  softened English. New keys fall back to English until translated at /translate
  (`/fill-translations` can gap-fill).

### SEO/meta

- Title: `Create a Dictionary for Your Language | Living Dictionaries` (was "Create New
  Dictionary | …"); the Header slot keeps the short "Create New Dictionary".
- New meta description (audio/photos/video, mission, free, minutes); added "Dictionary Maker" /
  "Make Your Own Dictionary" / "Dictionary Creator" to keywords (the queries it already ranks for).
- JSON-LD: `WebPage` (isPartOf the homepage's WebSite `@id`) + `FAQPage` via `JsonLd.svelte`.
  Chose FAQPage over HowTo because the page's sections genuinely are Q&A; a HowTo would have been
  invented structure.
- Sitemap: `site.xml` now lists `/create-dictionary` + also-missing `/terms` and `/privacy-policy`
  (both public, indexable, real content). `/setlocale`, `/chat`, `/translate`, `/account` etc.
  deliberately excluded (utility/gated).
- 🔴 Entry pages untouched — the title A/B test is uncontaminated.

## Verification (all done)

- **curl SSR:** exactly 1 `<h1>`, five `<h2>`s, one JSON-LD script parsing as `[WebPage, FAQPage]`,
  all copy present in raw HTML, title correct.
- **seo-audit:** `node scripts/seo-audit/audit.mjs --base http://localhost:3041 --no-search
  --no-gsc` → `/create-dictionary` **✅ all checks pass** (was ❌ `in_sitemap` + `ssr_content`).
  Remaining local failures are the expected not-present-locally dictionaries + localhost-canonical
  rows.
- **`pnpm check`** 0 errors · **`pnpm test`** 2528 passed · **`pnpm lint`** clean.
- **svelte-look:** all 3 stories screenshotted, light AND dark, eyeballed — chips, hint, italic
  conlang terms and FAQ all read correctly in both modes.
- **Real-browser screenshots** (light + dark, full page): `/tmp/ld-create-dictionary-shots/` on
  mustang (regenerable anytime via the new `_page.stories.ts` or `/tmp/ld-create-shots.mjs`).
- **Form submit e2e** (headless puppeteer + dev-auth, `/tmp/ld-create-e2e.mjs`): both branches
  submitted end-to-end as a signed-in user — natural branch → landed on `/{id}/entries`,
  `bucket=NULL`; conlang branch (3 checkboxes + 2 essays) → landed on `/{id}/entries`,
  `bucket='conlang'` + `con_language_description` stored. Zero page errors. Test rows deleted from
  local shared.db afterward.

## For Jacob to decide / know

- **Copy review**: the tone calls are mine — especially `conlang_hint` ("hosted here under their
  own terms, so please answer accurately") and the FAQ conlang answer opening with "Yes." Happy to
  tighten either direction.
- Old conlang translations still sit in the committed non-EN locale JSON seed files (harmless dead
  keys — I didn't touch non-EN files per the EN-only rule). They'll wash out whenever those seeds
  are next re-baked from `/api/i18n/export`.
- The ~14 new `create.*` keys need translation at /translate (or `/fill-translations`).
- `/terms` + `/privacy-policy` sitemap inclusion was my call under "consider other missing public
  routes" — trivially revertable if unwanted.
- The audit's other `/create-dictionary`-adjacent idea (`SoftwareApplication` JSON-LD) was skipped
  in favor of WebPage+FAQPage; can add later if we want app-style rich results.
