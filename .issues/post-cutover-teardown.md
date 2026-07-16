# Post-cutover teardown & porting inventory (Supabase → SQLite)

Production cutover to SQLite/VPS completed 2026-07-03 (DNS flip). This file is the single home for
what remains of the legacy-platform surface in `/scripts` — AGENTS.md no longer inventories it.

**2026-07-04 reorg:** all Supabase-coupled tooling now lives under **`scripts/supabase/`** (the
connector, cutover pipeline, entry-caches, delete-media, reset-local-db). The genuinely-useful tools
that only *currently* depend on Supabase — **`scripts/import/` (FLEx/CSV import)** and
**`scripts/download-audio.ts`** — stay in place and import the connector from
`scripts/supabase/config-supabase`; porting them to SQLite (below) severs that last dependency.

<Callout type="warn" title="Jacob's standing constraint">We deliberately KEEP the ability to reach
back into Supabase — creds and the connection module stay in hand so an agent can be asked to go
look at legacy data at any time. Media bytes also still live on Google (GCS); those credentials are
load-bearing, not legacy. Rename/reword/port, but don't destroy access.</Callout>

## Keep (permanent — NOT teardown)
- `scripts/supabase/config-supabase.ts` — shared Supabase/GCS connection module. GCS media access is
  live production infrastructure; Supabase access is retained for legacy lookups.
- `scripts/supabase/supabase-creds.private` — credentials (gitignored via the root bare-name rule).

## Port to SQLite (tools that still READ Supabase — real ongoing needs)
- [ ] `scripts/import/import-data.ts` + `import-media.ts` (+ `import-data.test.ts`,
      `vitest.config.import.ts`) — CSV/FLEx dictionary import; ongoing business need. Port to the
      SQLite server helpers / v1 API. (Kept in place; imports `../supabase/config-supabase`.)
- [ ] `scripts/download-audio.ts` — reads `materialized_entries_view`; port to the SQLite DBs.
      (Kept in place; imports `./supabase/config-supabase`.)
- [ ] `scripts/supabase/delete-dictionary-media/index.ts` — drains the `media_to_delete` queue from
      Supabase and deletes GCS objects. Decide where the deletion queue lives post-cutover, then port.

## Delete after settling (≥2 weeks post-cutover, and after any Phase-B delta re-migrate)
> Executed 2026-07-16 by the one-shot cron `living-dictionaries/teardown-2026-07-17` (now self-deleted).
- [x] `scripts/supabase/cutover/` — DELETED 2026-07-16. The one-shot cutover pipeline (incl. its
      `migrate.test.ts` / `richtext.test.ts`). Nothing imported it outside itself; lives on in git
      history. Also removed its 5 `scripts/package.json` scripts (`migrate-to-sqlite:dry`,
      `migrate-to-sqlite`, `verify-migration`, `validate-migration`, `audit-rich-text`).
- [x] `scripts/supabase/create-entry-caches/` — DELETED 2026-07-16. Pre-cutover Cloudflare entry
      caches, superseded by the R2 snapshot + OPFS leader-worker model. The only consumer was the
      archived (dead) `archive/api-keys/external-api/read-entries/+server.ts` hitting
      `cache.livingdictionaries.app` — not wired into the site build. Removed its
      `create-entry-caches` `scripts/package.json` script too.
- [ ] `scripts/supabase/reset-local-db.ts` — **KEPT** (not deleted 2026-07-16). Retained port-item
      `scripts/import/import-data.test.ts` still imports `reset_local_db` from it
      (`beforeEach(reset_local_db)`); deleting it would break that file (which we're not to touch
      pre-port). Delete this together with the import-tooling SQLite port above.
- [ ] `scripts/types/supabase/` — **KEPT** (not deleted 2026-07-16). Still transitively required by
      the retained `config-supabase.ts`: it imports `Database` from `../types`, whose `index.ts`
      re-exports from `./supabase/{combined.types,entry.interface,content-update.interface,
      unsupported.interface,orthography.interface}`. Per the keep-if-config-needs-them rule, keep.
