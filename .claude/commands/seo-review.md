---
description: Recurring SEO/GEO discoverability audit for Living Dictionaries. Crawls the priority public page-types on production (home, dictionaries list, a dictionary landing, entry pages) and asserts the SEO invariants (title / description / canonical / JSON-LD / indexability / OG image), then benchmarks a fixed set of target queries against search + AI answer engines. Ranks gaps by expected impact and writes a dated report. AUDIT-FIRST — read-only until Jacob promotes it; then it may fix ONE verified-green gap, uncommitted.
---

# SEO / GEO Discoverability Loop (Living Dictionaries)

For a language-documentation platform, **being findable IS the product**. A Living Dictionary that
Google can't crawl — or that an AI answer engine ("how do you say water in Wancho?") never cites —
fails its whole purpose. SEO here is done in bursts (sitemaps, JSON-LD, `SeoMetaTags`, SSR catalog,
entry-description tuning) and then silently drifts: a dropped `<title>`, a broken JSON-LD block, a
new route that isn't indexable, an entry page that stops answering its target query — nothing notices
until traffic quietly falls. This loop is the standing health check that converts burst-work into a
maintained surface.

> **Adapted from Loop Library #006 "SEO/GEO visibility loop."** The load-bearing part is the
> **cheap, re-runnable check** — build/keep that first; the fix is trivial once re-observation is free.

## Authority (start here)

**AUDIT-FIRST / read-only.** For the first several runs you ONLY crawl, assert, rank, and write the
dated digest — you change **no** code. Once Jacob says the lane is trustworthy, you may fix **exactly
ONE** verified-green, highest-leverage gap per run and leave it **uncommitted** for review (the
`parity-sweep` pattern). Never silence a check or weaken an assertion to make it pass — that defeats
the loop. If prod is unreachable, STOP and report.

## The re-runnable check (the load-bearing part)

Runs on **mustang** (clean internet — search + AI-engine calls work; they don't behind the GFW on
tuf). Target = **production** `https://livingdictionaries.app`.

**Priority page-types** (pick a live, populated public dictionary for the per-dict ones — e.g. one
near the top of `/dictionaries`):

1. Home `/`
2. Dictionaries list `/dictionaries`
3. A dictionary landing `/{dict}`
4. ≥3 entry pages `/{dict}/entry/{id}` (pull real ids from `/sitemaps/{dict}.xml`)
5. A language/about page `/{dict}/about`

**Per-URL technical assertions** (fetch with a normal UA; each is a pass/fail):

- `<title>` present, non-empty, and **not** the generic fallback verbatim — reflects the page's real
  subject (dictionary name / lexeme).
- `<meta name="description">` present, non-empty, and page-specific (not only the site boilerplate).
- Exactly one `<link rel="canonical">`, query-string-stripped and self-consistent — **or** an
  intentional `<meta name="robots" content="noindex">` (never both).
- ≥1 `<script type="application/ld+json">` that **parses** and carries the expected `@type`
  (home: `WebSite`/`Organization`; dict: `Dictionary`/`DefinedTermSet`; entry: `DefinedTerm`).
- `og:image` / `twitter:image` resolve **200** (HEAD the URL).
- **Indexability:** the URL appears in the right child of `/sitemap.xml` and is not blocked by
  `/robots.txt`.

**GEO / answer-first benchmark** (the half that decays fastest): keep a committed list of ~10 target
queries per page-type ("Wancho dictionary online", "how do you say water in \<lang\>", "\<lexeme\>
meaning \<language\>"). Each run, check whether an LD entry/dict page **surfaces + is cited** in
Google and in ≥1 AI answer engine, and whether the answer content on the page is **answer-first**
(the gloss/definition readable in the first crawlable text, not buried behind client-render).

Prefer to grow this into a committed script under `site/scripts/` (crawl + assert + benchmark) so the
second observation is free; until then, run it inline with `curl` + a small node parse.

## Each run

1. Run the check above across the priority URLs + the query benchmark.
2. **Rank gaps by expected impact** (indexation/crawlability blockers > missing/duplicate canonical >
   weak titles/descriptions > structured-data gaps > answer-first content). Note regressions vs the
   previous dated digest.
3. Write a dated digest to `.cron/seo-reviews/YYYY-MM-DD.md` (style: `~/code/horse/.cron/report-style.md`)
   — TL;DR, the per-URL check table, the query benchmark, ranked gaps, and the single highest-leverage
   next move.
4. (Only once promoted) fix the **one** top gap if it's clearly correct and verifiable, leave it
   uncommitted, and note it in the digest.

## Known infra to reuse (don't reinvent)

- `site/src/lib/components/SeoMetaTags.svelte` — title/description/canonical/OG/twitter meta.
- `site/src/lib/components/seo-title.ts`, `site/src/routes/[dictionaryId]/entry/[entryId]/seo_description.ts`.
- JSON-LD emitters: `+page.svelte` on `/`, `/{dict}`, `/{dict}/entry/{id}` via `$lib/components/json-ld-html.ts`.
- Sitemap: `src/routes/sitemap.xml` (index) → `src/routes/sitemaps/[dict_id].xml` (per-dict); `static/robots.txt`.
