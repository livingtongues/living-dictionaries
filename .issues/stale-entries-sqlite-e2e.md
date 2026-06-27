# Stale e2e: `test:entries` hits a removed endpoint

Surfaced during the 2026-06-12 uno drop (whose issue is now retired). Low priority, small.

`site/e2e/entries-sqlite.mjs` (run via the `test:entries` package script) fetches
`/api/dictionaries/[id]/entries-data`, an endpoint **removed by commit `bacef8a7`** ("Remove
Supabase entirely…"). The route no longer exists, so the test is dead — it can't pass.

Verified 2026-06-26: the script still references the endpoint at `entries-sqlite.mjs:46`, the
`test:entries` script still exists in `site/package.json`, and
`src/routes/api/dictionaries/[id]/entries-data` is gone.

## Fix (pick one)
- **Delete** `e2e/entries-sqlite.mjs` + the `test:entries` script if the entries read path is
  already covered by `e2e/achi-flow.mjs` / the snapshot-read e2es (likely).
- **Or rewrite** it against the current snapshot read path (`src/lib/db/dict-client/fetch-snapshot.ts`
  + the wa-sqlite read layer) if a dedicated entries-bundle assertion is still wanted.

## Also noted (pre-existing, cosmetic — fix if touching the file)
`SyncStatus.svelte` has unused `.sync-icon` selectors (class passed to an icon component needs
`:global`). Harmless dead CSS.
