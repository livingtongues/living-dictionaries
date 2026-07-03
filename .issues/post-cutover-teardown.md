# Post-cutover teardown & porting inventory (Supabase → SQLite)

Production cutover to SQLite/VPS completed 2026-07-02 (see `.issues/cutover.md`). This file is the
single home for what remains of the legacy-platform surface in `/scripts` — AGENTS.md no longer
inventories it.

<Callout type="warn" title="Jacob's standing constraint">We deliberately KEEP the ability to reach
back into Supabase — creds and the connection module stay in hand so an agent can be asked to go
look at legacy data at any time. Media bytes also still live on Google (GCS); those credentials are
load-bearing, not legacy. Rename/reword/port, but don't destroy access.</Callout>

## Keep (permanent — NOT teardown)
- `scripts/config-supabase.ts` — shared Supabase/GCS connection module. GCS media access is live
  production infrastructure; Supabase access is retained for legacy lookups.
- `scripts/supabase-creds.private` — credentials (gitignored).

## Port to SQLite (tools that still READ Supabase — real ongoing needs)
- [ ] `scripts/import/import-data.ts` + `import-media.ts` (+ `import-data.test.ts`,
      `vitest.config.import.ts`) — CSV dictionary import; ongoing business need. Port to the
      SQLite server helpers / v1 API.
- [ ] `scripts/download-audio.ts` — reads `materialized_entries_view`; port to the SQLite DBs.
- [ ] `scripts/delete-dictionary-media/index.ts` — drains the `media_to_delete` queue from Supabase
      and deletes GCS objects. Decide where the deletion queue lives post-cutover, then port.

## Delete after settling (≥2 weeks post-cutover, and after any Phase-B delta re-migrate)
- [ ] `scripts/supabase-cutover/` — the one-shot cutover pipeline. `.issues/cutover.md` notes a
      possible Phase-B `--since` delta re-migrate for live-edit races (e.g. the `ewdébe` 4-row
      parity delta) — keep until that's ruled out. Lives in git history after deletion.
- [ ] `scripts/reset-local-db.ts` — Supabase local-dev reset; obsolete under SQLite dev flow.
- [ ] `scripts/create-entry-caches/` — pre-cutover Cloudflare entry caches; superseded by the R2
      snapshot + OPFS leader-worker model. Confirm nothing consumes the caches, then delete.
- [ ] `scripts/types/supabase/` — legacy generated Supabase TS types; delete only once nothing
      (config-supabase aside) imports them. If `config-supabase.ts` still needs them for legacy
      lookups, keep.
