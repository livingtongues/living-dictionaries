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
> Scheduled: the committed one-shot cron `living-dictionaries/teardown-2026-07-17`
> (`.cron/teardown-2026-07-17.md`) executes this section on 2026-07-17.
- [ ] `scripts/supabase/cutover/` — the one-shot cutover pipeline. Phase-B delta re-migrate is DONE
      (2026-07-03), so this is now safe to delete once we're confident no further legacy re-pull is
      needed. Lives in git history after deletion. (Self-contained: its own
      `looks-like-html.ts` since the site shim was removed 2026-07-04.)
- [ ] `scripts/supabase/reset-local-db.ts` — Supabase local-dev reset; obsolete under SQLite dev flow.
- [ ] `scripts/supabase/create-entry-caches/` — pre-cutover Cloudflare entry caches; superseded by
      the R2 snapshot + OPFS leader-worker model. Confirm nothing consumes the caches, then delete.
- [ ] `scripts/types/supabase/` — legacy generated Supabase TS types; delete only once nothing
      (config-supabase aside) imports them. If `config-supabase.ts` still needs them for legacy
      lookups, keep. (Left at `scripts/types/` — not moved.)
