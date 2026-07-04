# Migration knowledge

Gotchas/decisions for evolving LD off Vercel+Supabase onto VPS+SQLite. **The production cutover is
DONE** (DNS flipped 2026-07-03, +1d grace watch clean 2026-07-04) — see
`production-cutover-record.md`. Remaining legacy-surface teardown: `.issues/post-cutover-teardown.md`.

## Pages
- [production-cutover-record.md](./production-cutover-record.md) — the final record of THE flip:
  the merge-into-existing-prod shape (prod-id-wins identity), the Phase-A rehearsal → Phase-B delta,
  the DNS/domain flip mechanics + the reusable operational-tails checklist (webhook, ld-email,
  Caddy inode, CF token gaps, snapshot preservation), the bugs real traffic surfaced (U+2028 NDJSON
  split, non-ASCII slug redirect crash, brace-paragraph loss), the +1d grace-watch health snapshot,
  and where the legacy `/scripts` surface + HTML shim went.
- [supabase-cutover-conversions.md](./supabase-cutover-conversions.md) — full-corpus cutover
  rehearsal findings (2,229 dicts pushed live 2026-07-02): the two silent-data-loss bugs
  (`<`-prefix `looks_like_html` misfire, undeclared `lo{n}` orthographies), the Tiptap
  per-conversion heap leak → disposable-child isolation, rich-text audit decisions
  (tables/underline/smallcaps), schema-drift converge, the hard-delete/orphan-prune model, and the
  prod-id-wins identity merge + blue/green push procedure.
- [migration-squash-2026-07-02.md](./migration-squash-2026-07-02.md) — the pre-cutover squash of
  all three migration sets into single idempotent `20260702_initial.sql` files: the re-run-by-name
  convergence mechanism, the prunable Convergence sections, the ALTER-order column-position gotcha,
  the audit-driven index decisions (junction UNIQUE-leading-column rule, the two `deletes` indexes
  differing on purpose), and `entry_count`'s single `mirror_dictionary_cursor` chokepoint.
- [adding-a-syncable-dict-table.md](./adding-a-syncable-dict-table.md) — the ~7-place checklist for
  adding a new per-dict table/column: the new-migration rule, the `process_delete_cascade`
  DROP+re-CREATE gotcha (SQLite has no ALTER TRIGGER), the search-feed wiring order, and how the
  cutover auto-picks up the DDL. Distilled from the `sources` registry work.
- [shared-stack-conventions.md](./shared-stack-conventions.md) — the durable LD ↔ house contract:
  orchestration norms, the stack/architecture decisions (keep UnoCSS, numeric roles rejected,
  native deps in `dependencies`), the sync-engine invariants, the R2/media boundary, and
  deploy-via-webhook-not-Actions. Relocated from the retired master plan.
- [pulling-supabase-data-locally.md](./pulling-supabase-data-locally.md) — operational runbook
  for refreshing `site/.data` with real dictionaries: run the migrator from the **example** repo
  (this repo's `scripts/` can't install — `workspace:` deps, not a workspace member), the
  `--content-dicts`/`--data-dir` flags, the two post-pull reconciliations vs this schema (ALTER
  `linguistic_history`; app auto-applies the lmod-trigger fix), and the gotchas (`process.exit`
  truncates piped stdout; `linguistic_history` is empty in prod; media files aren't pulled).
- [build-and-deploy-gotchas.md](./build-and-deploy-gotchas.md) — pnpm lockfile discipline,
  the adapter-node swap fallout (deps/devDeps bucketing, rollup bump, `@types/node` dedup),
  and the local-build/boot loop.
- [eslint-custom-config-and-runes-finish.md](./eslint-custom-config-and-runes-finish.md) — LD-A2:
  replacing antfu with the example's hand-written flat config (eslint 10 / svelte-plugin 3); why
  `lint:fix` churns ~125 files harmlessly; finishing the runes migration of the legacy stragglers to
  reach 0 lint errors (svelte-pieces slot/event conversion, the `state`/`$state` clash, `untrack`-ing a
  self-referential `$effect`, typing a JS action's custom event, `ban-types` removal, `{#each}` key
  conventions); the re-enabled pre-commit hook.
- [m4-sqlite-read-layer.md](./m4-sqlite-read-layer.md) — M4 read: replacing the M1 Supabase stub's
  READ path with server better-sqlite3 (`shared.db` catalog + per-dict `dictionaries/{id}.db` entries
  via a bundle endpoint feeding the Orama worker). Why LD's seam differs from house's reader port
  (client stub + search worker), the catalog/entries projections to legacy shapes, the confirmed
  adapter-node `dependencies` gotcha, the "only 4 of 2136 dbs have entries" data finding (+ `VACUUM
  INTO` seeding), keeping achi-flow unchanged by seeding fixtures into `achi.db`, the e2e harnesses
  + their external-error filtering, and what intentionally stays on the stub until auth/M4-write.
- [m4-write-sync.md](./m4-write-sync.md) — M4 write/sync: the browser wa-sqlite per-dict DB +
  SharedWorker + bidirectional sync. LD's design (wa-sqlite = client source of truth, Orama fed from
  it, saves to wa-sqlite); the main-thread-orchestrated Orama feed (worker boundary); the editor write
  path + interim double-write; **two latent sync bugs found + fixed (also in the example):** the
  `INSERT OR REPLACE` trigger failing under an UPSERT (fixed via `ON CONFLICT(key)` in a new
  migration) and the `/changes` fast-bail dropping editor pushes; OPFS→MemoryVFS fallback inside the
  SharedWorker (round-trip still works via sync-from-null); the "everyone opens wa-sqlite" snapshot
  decision (the page's original "no R2" framing is superseded — R2 dict snapshots are now live);
  the self-sufficient seed; how to debug SharedWorker fetch/console (invisible to puppeteer).
- [opfs-leader-worker-dict-db.md](./opfs-leader-worker-dict-db.md) — the dict DB moved from the
  SharedWorker-MemoryVFS path (m4-write-sync) to house's **OPFS-in-a-leader-elected-dedicated-worker**
  topology (real persistence — no re-download every boot). LD-specific `dict_id`-only keying
  (viewer+editor share one OPFS file, capability promoted via `set_role`); the load-bearing op-mutex;
  and **the WAL-mode snapshot-header gotcha** (`.backup()` keeps version-2 WAL header → the single-file
  SAH VFS can't open it → 3 fixes: server `journal_mode=DELETE` in the R2 cron + editor endpoint, and
  client `normalize_snapshot_header` for legacy snapshots). Verification harnesses + cutover op note.
- [m4-real-auth.md](./m4-real-auth.md) — M4 auth: porting the example's `AuthUser`/`ssr_user`/
  `dict_roles` model (full port) with two pragmatic LD adaptations (plain `page.data.admin` mirror;
  plain role booleans wrapped in `readable()` only for the search store); the legacy `getSession`
  JWT shim kept for 6 write/media endpoints; the dev `dev_admin_level` cookie that re-establishes
  "Set Admin Role Level" in the allow-list world (house should mirror); the send-code rate-limit FIX
  + LD's `created_at` NOT NULL twist; the `E2E_EXPOSE_OTP` escape hatch for e2e on `node build`; the
  vitest `$env/dynamic/private` alias; hand-adding jose to the lockfile.
- [media-upload.md](./media-upload.md) — LD-MEDIA: wiring media upload to real auth + GCS HMAC presigned
  PUT (legacy bucket, NOT R2); env names kept + `$env/dynamic/private` 503-when-unset; dev/prod bucket
  split via `import.meta.env.DEV`; testing without GCS (fake creds + puppeteer-intercepted PUT/lh3 +
  local PROCESS_IMAGE_URL stub, CORS-preflight gotcha, e2e photo-accumulation hygiene); THREE
  runes/sync bugs that blocked audio/media (SelectSpeaker `$derived`→`$state`, EditAudio `$bindable`
  fallback mismatch → `props_invalid_value`, and the sync dirty-clear race); and dropping the service
  worker to kill the deep-link 404.
- [dict-sync-invariants.md](./dict-sync-invariants.md) — LD-P4B audit of LD's per-dict sync engine
  against the three house local-first-editing bugs (cold-DB id collisions, missing local `users` FK
  row, unscoped cross-sector `DELETE FROM deletes`). All three are prevented by LD's architecture
  (loading-gate + cold-open `sync_now`; dict.db has no `users` FK; single-sector engine) — records the
  invariants to keep true so they stay prevented.
- [leader-worker-boot-robustness.md](./leader-worker-boot-robustness.md) — **the boot must never put a
  snapshot download under a fixed wall-clock cap** (the 2026-07-01 `river` `leader boot timed out after
  12000ms` incident). The idle/no-progress boot watchdog (`create_boot_watchdog` + `report_progress` +
  streaming `fetch-snapshot`) so a slow-but-progressing download never false-times-out; single-tab
  auto-recovery via `leader-election.reacquire()` + capped re-election backoff (a lone tab used to
  dead-end forever); the `on_boot_failed` → `leader_boot_failed` telemetry (worker boot errors are
  otherwise invisible); the cross-app safety matrix (house/tutor already safe); and the 413 body-limit
  fix. All harness changes mirrored into house the same day.
- [client-behind-recovery.md](./client-behind-recovery.md) — why a `schema_outdated`/`CLIENT_BEHIND`
  block survives a single tab's reload on **dict.db** (the per-dict leader worker pins the old bundle)
  but not on **admin.db** (per-tab engine); the coordinated guarded auto-reload fix for dict +
  deliberate manual-toast (no auto-reload) for admin to protect un-saved edits. `client-behind-recovery.ts`
  is byte-identical to house's.
- [unocss-svelte-scoped-to-universal.md](./unocss-svelte-scoped-to-universal.md) — M2a plugin
  swap: the svelte-scoped defaults the universal plugin drops (directives transformer +
  Svelte `class:` extraction) and how to restore them; `@unocss/reset` becoming a direct dep AND
  needing a CSS cascade layer (else modal overlays go transparent from an equal-specificity tie);
  why svelte-pieces' pre-compiled CSS is unaffected; grep-based CSS parity checks; and using a
  headless browser on `node build`/throwaway `vite dev` to debug dev-only CSS.
- [service-worker-cutover.md](./service-worker-cutover.md) — re-adding a disciplined network-first
  SW (after media-upload dropped it): why a fresh `/service-worker.js` is the **cutover kill** for
  the old Vercel zombie SW (a 404 doesn't unregister; `activate` wipes the legacy caches); the
  deep-link 404 registration bug being a **pre-2.63 quirk** that's gone on kit 2.63 (no
  `kit.paths.relative` change needed); and why network-first + `version.pollInterval` toast, never
  cache-first/SWR. Shared shape with house.
