# Entries sync status indicator

Add a small "sync cloud" indicator (idle/syncing/synced/error/offline) next to the
entry count in the sidebar's "Entries" nav item — mirroring the pattern already
used in `/admin` (`SyncStatus.svelte`) and in tutor RN (`sync-status-pill.tsx`).

## Decisions (from user Q&A)

- **Placement**: sidebar "Entries" nav item, cloud icon to the **left** of the
  count pill. No mobile-header mirror needed — mobile users can open the
  hamburger to see it.
- **Visibility gate**: `can_edit` (managers, contributors, editors — anyone who
  can write). Viewers never see it.
- **Tap behavior**: tap triggers `connection.sync_now()` immediately. No new
  dashboard page. Disabled (no-op) while a sync is already in flight.
- **Errors**: icon turns red/alert on background failures (no toast). A tap
  that itself fails DOES show `toast.error(...)` (explicit user action deserves
  explicit feedback). No success toast on manual tap — the icon flipping to
  the checkmark is enough.

## Why this needed new plumbing

`DictSyncEngine` (in the leader worker) already had `on_status` →
`dict-instance.ts` already broadcasts `{ type: 'sync_status', is_syncing,
last_error, last_sync_at }` as a `DbEvent` — but nothing on the main thread
subscribed to it. `DictConnection.sync_now()` already existed (used once for
the initial boot sync in `+layout.ts`), so tap-to-sync was basically free.

## Plan

- [x] `site/src/lib/db/dict-client/dict-sync-status.svelte.ts` — new reactive
      `DictSyncStatus` class (Svelte 5 runes): subscribes to `sync_status`
      broadcasts, exposes `is_syncing` / `last_error` / `last_sync_at` /
      `online`, a `busy` getter (is_syncing OR an in-flight manual trigger —
      covers the round-trip gap before the broadcast confirms), and
      `sync_now()` (no-ops while busy). Pure `pick_dict_sync_status()` status
      derivation function + inline vitest, mirroring tutor's `pick_status`.
- [x] `[dictionaryId]/+layout.ts` — instantiate `DictSyncStatus` alongside
      `connection`/`dict_db` in the cached `globals.__ld_dict_connections`
      entry (browser-only), return it as `dict_sync_status` in load data.
- [x] `site/src/lib/db/dict-client/DictSyncStatus.svelte` — the icon button.
      Renders nothing when `can_edit` is false or `sync_status` is null (SSR).
      `title`/`aria-label` via localized status text. Click: `stopPropagation`
      (sits inside the sidebar's click-to-close-mobile-menu wrapper) +
      `preventDefault`, no-ops while busy, `toast.error` on a failed manual
      trigger.
- [x] `en.json` — new `sync` namespace: `syncing` / `synced` / `error` /
      `offline` / `idle` / `tap_error` (toast prefix).
- [x] `SideMenu.svelte` — restructure the Entries row: pull the spinner /
      sync icon / count-pill out of the `<a>` (nested interactive elements
      are invalid HTML) into a wrapping `<div>` that keeps the same
      hover/active row styling, with the `<a>` now covering just the
      icon+label flex-grow area. New props `can_edit`, `dict_sync_status`.
- [x] `[dictionaryId]/+layout.svelte` — pass `can_edit` + `dict_sync_status`
      down to `SideMenu`.
- [x] `SideMenu.stories.ts` — mock `DictSyncStatus`-shaped objects for every
      state (idle/syncing/synced/error/offline) + `can_edit` true/false, and
      screenshot-verify with svelte-look.
- [x] `pnpm test`, `tsc`, `pnpm lint`, `pnpm check`.

## Verification

- `pnpm exec vitest run` — 1034 passed (incl. new `pick_dict_sync_status` cases).
- `tsc --noEmit`, `pnpm lint`, `pnpm check` — all clean (0 new errors/warnings;
  the one pre-existing `v1-entry-write.ts` tsc error is unrelated WIP already
  in the working tree, not touched here).
- svelte-look screenshots of every `SideMenu` story (Manager/Editor/
  Contributor/Viewer + Syncing/Error/Offline/Idle sync states) — icon renders
  left of the count pill, hidden for `Viewer` (`can_edit=false`).
- Headless Puppeteer e2e against a real running dev server + real dict
  (`local-mquh8w6n`, logged in as an existing manager via the dev OTP
  bypass): confirmed idle→"Synced", disabled+"Syncing…" immediately on tap,
  back to "Synced" after the round-trip; anonymous viewer gets no sync
  button; a forced 500 on `/changes` shows the red alert icon + a
  `Sync failed: boom` toast, button re-enabled (tap-to-retry) after the
  failure — matching every decision above exactly.

## Notes / gotchas for future readers

- The dict sync engine's periodic timer (`DICT_SYNC_INTERVAL_MS` = 30s) always
  runs a full round-trip regardless of dirty rows (unlike admin's engine,
  which skips when `total_dirty === 0`) — so the cloud will briefly pulse
  "syncing" every ~30s even when idle. That's existing engine behavior, not a
  bug introduced here.
- `emit_event` → `server.broadcast(event)` goes out over the same
  `BroadcastChannel` the leader worker and ALL tabs (including whichever tab
  triggered the sync) share — so relying purely on the `sync_status` broadcast
  for state (rather than optimistically flipping local state on tap) is
  accurate even for the tab that tapped, just with one microtask/RPC round
  trip of latency (covered by the `busy` flag above).
