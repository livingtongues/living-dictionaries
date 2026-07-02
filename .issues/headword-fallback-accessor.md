# Headword fallback accessor (lexeme.default absent → first populated alternate orthography)

Agent feedback: entries whose lexeme has NO `default` value but DOES have a value under a
registered alternate-orthography code (real case: multi-dialect dict where one dialect writes only
in an alternate orthography) break several surfaces: empty list-view headword span, share text /
og:image:alt interpolating `undefined`, blank CSV lexeme column. Entry page field rows already
handle it fine.

## Decisions (Jacob, 2026-07-02)
- Scope: ALL display surfaces use the accessor; editing inputs (table lexeme cell, entry-page
  field rows) untouched — editors must see that `default` is genuinely unset.
- Fallback chain: `default` → registry-order alternates ONLY (no last-resort scan of unregistered
  lexeme keys). Cutover mappers rewrite legacy `lo1–lo5` keys to real orthography codes, so
  post-cutover all keys are registered.
- Accessor returns `{ value, code }`; alternates-listing surfaces skip the promoted code so the
  same string doesn't render twice (list view italics, print local-orthographies line,
  seo_description local-orthographies segment).
- CSV: lexeme column gets the fallback value; alternate orthography columns stay faithful
  (value may appear in two columns — honest duplication).
- Cutover note: record in `.issues/cutover.md` that lo1–lo5 keys are eliminated/mapped during
  migration (mappers already do this — make the runbook say so explicitly).

## Implementation
- ✅ `get_headword({ lexeme, orthographies })` in `site/src/lib/helpers/orthographies.ts`
  (+ inline vitest). Returns `{ value: '', code: 'default' }` when nothing populated.
- ✅ `get_local_orthographies(lexeme, { exclude_code })` option (print + seo_description dedupe).
- Call sites:
  - ✅ `entries/list/ListEntry.svelte` — headword span, italics-loop skip, Video lexeme, Image title
  - ✅ `$lib/helpers/share.ts` — share text (dictionary from `page.data`)
  - ✅ `entry/[entryId]/+page.svelte` — SeoMetaTags `imageTitle` + pass orthographies to seo_description
  - ✅ `entry/[entryId]/seo_description.ts` — accepts `orthographies`, excludes promoted code
  - ✅ `entry/[entryId]/EntryMedia.svelte` — photo titles + video lexeme
  - ✅ `entries/gallery/GalleryEntry.svelte` — caption + image title
  - ✅ `entries/print/PrintEntry.svelte` — headword, local-orthographies exclude, img alt
  - ✅ `entries/table/Cell.svelte` — photo title ONLY (line 63); editable lexeme cell untouched
  - ✅ `$lib/components/audio/EditAudio.svelte` — modal heading
  - ✅ `$lib/components/video/AddVideo.svelte` — modal heading
  - ✅ `export/prepareEntriesForCsv.ts` — lexeme column fallback
- ✅ `.issues/cutover.md` — lo{n} rewrite note under migration step 2
- Tests added: `get_headword` inline vitest, `get_local_orthographies` exclude_code, seo_description
  promoted-code skip, `prepareEntriesForCsv.test.ts` (fallback + faithful alternate column), and a new
  `ListEntry.stories.ts` (3 stories: default+alternate, promoted fallback, registry-order pick).
- Verify: ✅ full vitest (147 files / 1036 tests passed) · ✅ `pnpm check` 0 errors ·
  ✅ eslint clean on touched files (only pre-existing warnings) · ✅ svelte-look ListEntry screenshots
  confirm: bold fallback headword, no duplicate italic, registry order beats lexeme key order.

## Notes
- ListEntry stories use ASCII lexeme values — the screenshot env lacks Ol Chiki/Devanagari fonts
  (tofu boxes made the dedupe assertion unreadable).
- Editable surfaces deliberately left on raw `default`: table lexeme cell (Cell.svelte:~206) and
  entry-page field rows.
