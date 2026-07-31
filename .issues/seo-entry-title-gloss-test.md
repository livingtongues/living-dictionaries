# SEO entry-title gloss test (50/50, started 2026-07-31)

Entry pages rank on page one for huge `<word> in English` query volume (Jul 23–29: entry leaves
239,058 impressions / 335 clicks / **0.140% CTR** / pos 9.1, vs dictionary homes at 1.87% CTR) but
the `<title>` only contains the headword — the gloss lives in the description/JSON-LD where the
searcher's eye doesn't go. Approved by Jacob 2026-07-31 (advisory SEO lane; full evidence in house
`.issues/google-search-console-cli.md`) as a measured test, not a blind 187k-URL change.

## Implementation

`site/src/routes/[dictionaryId]/entry/[entryId]/seo_entry_title.ts`, wired into the entry page's
`SeoMetaTags` `title` prop.

- **Arm assignment**: deterministic djb2 hash of the entry id, `hash % 2 === 0` → `gloss_title`,
  else `control`. Stable across builds and re-derivable from a GSC page URL's entry id when scoring.
- **Treatment title**: `{headword} means “{gloss}” in {Language} | {Dict} Living Dictionary`.
  Gloss = first gloss in dictionary gloss-language order, first `;`/`,` segment only, italic tags +
  trailing parenthetical stripped. Language name via `t('gl.{bcp}')` (English at SSR default locale).
- **Fallbacks to the unchanged headword-only title**: control arm, no gloss, gloss empty after
  cleaning, or gloss > 45 chars.
- Verified locally: `/achi/entry/e_ja` (gloss arm) SSRs `ja' means “water” in English | Achi Living
  Dictionary`.

## Readout — ~2026-08-21 (horse-cron job `c-2570c5`, scheduled from house)

Pull GSC `page` rows for entry leaves over the ~3 post-deploy weeks, re-derive each page's arm with
the same hash, and compare CTR (and position drift) between arms — a same-period
difference-in-differences, immune to the ongoing impression surge. Decision: CTR win → delete the
arm split and ship the gloss title to 100%; loss/flat → revert to headword-only. Either way this
issue closes with the arm logic removed.
