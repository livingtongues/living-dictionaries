# Homepage dictionary stat quality threshold

Change the homepage `dictionaries` stat to count all public dictionaries plus only unlisted
dictionaries with more than 5 entries, instead of every dictionary bucketed `unlisted`.

## Live production snapshot — 2026-07-21

- Public dictionaries: **221** (always counted).
- Explicitly unlisted dictionaries: **396**.
- Unlisted with `entry_count > 5`: **280**.
- Current computed homepage count: **617** (`221 + 396`); the currently committed/baked payload is
  one catalog revision behind at **618**.
- New homepage count: **501** (`221 + 280`), rendered as **501+**.
- The filter removes 116 embryonic unlisted projects: 34 empty and 82 with 1–5 entries.

## Recommendation

Use the threshold. The homepage band is labeled “What communities have built so far,” so excluding
empty and very early shells makes the number more defensible while the trailing `+` still signals
that the platform serves additional projects. Keep all explicitly public dictionaries regardless
of entry count because publication is the stronger human-curated signal.

Jacob selected the inclusive six-entry minimum (`entry_count > 5`), retaining the 40 unlisted
projects with 6–10 entries while filtering empty and very small shells.

## Implementation notes

- ✅ Change `compute_homepage_stats` in `site/src/lib/db/server/homepage-stats.ts` and its export test.
- The Docker build fetches `/api/homepage/export` from the still-running old container. A query-only
  change will therefore affect that endpoint on the first deploy but will not enter the baked
  homepage payload until the following deploy. Jacob explicitly accepted that normal one-deploy lag.
- ✅ Update `.knowledge/domain/homepage-v2.md` and the nearby rounding comment to describe the rule.
- ✅ Focused export tests: 3 passed.
- ✅ ESLint passed on all touched source files.
- ✅ `pnpm --filter=site check`: 0 errors (45 pre-existing warnings across 23 files).
