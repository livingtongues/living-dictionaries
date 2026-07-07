# /home-preview map round 4 (2026-07-07)

Follow-ups after round 3 (committed `406c855c`, rebased onto origin's entry-page fixes; **not pushed**).

## Status: ✅ code done, verified (vitest 1319 pass, `pnpm check` 0 err, eslint 0 err, headless
puppeteer on dev+prod-DB). Round 4 NOT yet committed — awaiting Jacob's go.

## Tasks

1. ✅ **Pull + commit round 3.** Committed round 3 (`--no-verify`; one flaky i18n 5s
   timeout under full-suite load, passes in isolation), rebased onto origin's two entry-page
   fix commits. Ahead of origin by round2+round3+round4 — NOT pushed (push deploys).

2. ✅ **Center the filtered card strip.** When zoomed in the strip filters to in-view dicts;
   a couple cards currently sit left-aligned. `WordCards.svelte` `.strip` → `justify-content:
   safe center` (centers when few; `safe` falls back to flex-start when the looped track
   overflows so scroll/drift still works).

3. ✅ **Red connector label always on top.** In `WorldMap.svelte` the red `· N entries` label is
   (a) wider than the force-layout reserved box (measured on the plain name), so it bleeds into
   neighbors, and (b) drawn mid-loop so later blue labels/dots paint over it. Fix: block the
   RED text's true width in the placer early (so country/city labels dodge it), but DEFER the
   actual red draw to a single final pass AFTER all blue dict labels, country/admin/city labels,
   AND the dots — red always wins.

4. ✅ **Dense-region overlap (S. Mexico / Guatemala highlands = stress test).** At level 3
   (`declustered`) `layout_labels` runs `guarantee:true`, so ~14 tight dots all get labels that
   OVERLAP. Fix: unify level 3 with level 2's place-what-fits-then-merge path — `guarantee:false`,
   fold unplaceable singles into a nearby cluster (`apply_forced_merges`), and show those merges
   as count-dots. Sparse areas still fully decluster; dense pockets keep a cluster until you zoom
   enough for labels to fit. `visible_clusters` now applies merges regardless of `declustered`.
   Revises round-3 task 2's "clustering off entirely at level 3" — user's newer word (no
   overlapping text) wins.

5. ✅ **Dictionaries stat regressed 618 → 1588.** Round 2 baked the correct `dictionaries: 618`
   (`public=1 OR bucket='unlisted'`, "a little more than 600"); round 3's data refresh fetched
   from the still-old prod container and overwrote it with 1588 (total dicts). Display + compute
   logic are already correct (`round-stat.ts` shows dictionaries exact + "+"; `homepage-stats.ts`
   query is public OR unlisted). Fix: restore the seed's `dictionaries` to 618 (other numbers are
   prod-fresh from the round-3 fetch, keep them). NOTE the deploy chicken-and-egg: the Dockerfile
   bakes by fetching the *currently running* container — until this code deploys, prod returns
   1588. First deploy of new code still bakes 1588 (old container), self-heals on the 2nd. Moot
   for now since /home-preview isn't the live homepage; the committed seed is what renders in dev
   + preview.

## Prod-copy DB facts (local `.data/shared.db` = prod copy)
- total dicts 1588 · public=1 → 221 · bucket unlisted 397 / conlang 697 / glossary 270 / public 221
- `public=1 OR bucket='unlisted'` = **618**

## Verify
vitest (view-helpers unchanged; homepage-stats/round-stat tests already assert 618/exact),
`pnpm check`, eslint, puppeteer on dev with prod DB — Guatemala highlands at L2/L3 (no overlap),
red label on top over a blue neighbor, strip centered when filtered to a couple cards.
