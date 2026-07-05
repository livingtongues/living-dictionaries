# Log-review approved fixes — 2026-07-05 (from 2026-07-04 run-2 brief)

Tracking the morning-approved batch. Source: `.cron/log-reviews/2026-07-04.md` (run 2).

## LD1 · 🔴 P1 — empty-dictionary regression
- [x] IMMEDIATE (prod data): ran the `reconcile_dictionary_catalog()` logic on prod — **163 cursor-ahead
  dicts bumped** (updated_at → the 11:23 featured-sweep cursor), flagging them for the running builder
  to re-snapshot. Verified 161 now dirty/awaiting rebuild; monitor confirms rebuild lands.
- [x] DURABLE (client): `entries-ui-store.ts` — `load_bundle_with_retry` retries once on a transient
  (SQLITE_MISUSE/closed) error before giving up; the snapshot data renders instead of an empty list.
- [x] DURABLE (server): `reconcile_dictionary_catalog()` runs at snapshot-builder boot → a metadata-only
  cursor advance self-heals on the next deploy.
- [ ] VERIFY boot cascade → ~0 next window (background monitor `b3mxnsuji` tracks the rebuild; cascade
  count needs the next log-review window).

## LD2 · 🟠 effect_update_depth_exceeded on /{dict}/entry/* — DONE
- [x] Moved `star_row` from a `$derived` reading `featured_entries.rows` into an `$effect` + plain
  `$state star_row_id` (the accessor's designed context). Markup + toggle updated.

## LD3 · 🟠 Enrich boot-cascade telemetry — DONE
- [x] New `sqlite-result-codes.ts` (decode + transient classify) + `snapshot-expired-tracker.ts`.
  `Failed to read dict bundle` → `log_event` with `dict_id` / `sqlite_code` / `sqlite_code_name` /
  `snapshot_expired_recently` / `retried`. `initial dict sync failed` → `log_event` with `dict_id`/`code`.

## LD4 · 🟡 Classify stale admin-chat 404s — DONE
- [x] `hooks.server.ts` `is_stale_client_404` skips logging 404s for `/api/admin/chat/*`.

## LD5 · 📊 Fresh-viewer boot-health strip — DONE
- [x] `log-analytics.ts` `BootHealth` + `build_boot_health` (failed/recovered/non-recovery/snapshot_expired
  + by-message + daily). Panel on `/admin/analytics`; both story mocks; unit test. svelte-look light+dark ✓.

## TD3 · river.entry_count — DONE (premise was stale)
- [x] Maintenance path (`mirror_dictionary_cursor`) + schema comment already correct. Prod already shows
  **river = 8692 = actual** (count_mismatch = 0 across all 2233 dicts) — the "0 vs 8693" premise was stale.
  `reconcile_dictionary_catalog()` adds the never-written-dict backfill/heal at boot. Issue file premise fixed.

## Verify — DONE
- [x] tsc clean · eslint 0 new · vitest 1255 pass (+ new sqlite-result-codes / snapshot-tracker / boot_health
  tests) · `pnpm check` 0 errors · svelte-look analytics panel light+dark.
