# Warnings → client_logs: explicit channel, not blanket console.warn

## Decision (Jacob, 2026-06-29)
`console.warn` is **deliberately NOT auto-captured** — most warns are operational /
3rd-party / browser noise (dict-instance snapshot-fail on every new dict, sync
retries, leader-boot retries, localStorage-in-private-mode, etc.). Shipping a
warning to telemetry must be an **explicit, curated** decision via `log_warning()`
(thin wrapper over `log_event({ level: 'warn' })`). The level/console-method are
decoupled: a `warn` row does not have to be a `console.error`.

## Tasks
- [x] Revert the blanket `console.warn` patch in `remote-log.ts` (state vars, patch
      block in `init_remote_logging`, restore in `_reset_for_tests`, doc comment).
- [x] Add `export function log_warning({ message, context })` to `remote-log.ts`:
      mirrors to the dev `console.warn` AND `push({ level:'warn', ... })`.
- [x] i18n missing-key (`i18n/index.ts`): keep only the truly-actionable case
      (no English base). console.warn for dev + fire a **client-only injected hook**
      (`set_missing_translation_handler`) — **deduped once per unique key/session**.
- [x] Wire the hook in `+layout.svelte` onMount → ships via `log_event({level:'warn'})`
      (NOT log_warning, to avoid a double console.warn since i18n already consoled).
- [x] Sweep the high-signal **client-side data-integrity** warns to `log_warning`:
      LiveDb save/reset "row missing primary key", DictLiveDb save "row missing id".
      (Left operational ones — sync/snapshot/leader/localStorage — as plain console.warn.)
- [x] Tests: replace console.warn-patch test with `log_warning` ship test; add i18n
      dedupe + no-fire-when-en-exists inline tests.
- [x] Update `check-logs` skill: console.error patched; warns only via explicit log_warning.

## Verify
- [x] `pnpm exec vitest run` on remote-log + i18n
- [x] `pnpm check` (0 errors)
- [x] Browser: trigger a fully-missing key → exactly one `warn` row in client_logs;
      a plain `console.warn('noise')` → NO row.

## Done — all tasks complete, verified end-to-end. Ready for review/commit.

## Notes
- mustang's LD `.env` lacks `JWT_SECRET` (blocks auth-gated dev testing); worked
  around by launching dev with an injected throwaway secret. Jacob to add a dev value.
- `+page.ts` in create-dictionary is a SEPARATE agent's soft-nav WIP — untouched.
- Possible follow-up: port `log_warning` + this convention to tutor & house
  (shared `remote-log.ts`).
