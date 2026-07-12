# Deepen the per-dict client session — one registry, one lifecycle module

**Status: ✅ COMPLETED 2026-07-12 by the watcher session (d040331b) after the clobber recovery
(see .issues/clobber-recovery-2026-07-12.md). Executed as planned with these notes:**

- MERGED `dict-lifecycle.ts` into `dict-session.ts` (deleted; `open_dict` moved verbatim). Both
  registries keep their `globalThis` keys (`__ld_dict_clients`, `__ld_dict_connections`,
  `__ld_orama_watchers`) — e2e scripts read `__ld_dict_connections.achi.*` and globalThis survives
  dev HMR re-evals (module state alone would re-elect workers / stack watchers).
- `get_dict_session({ dict_id, can_edit, user_id, user_email, t }, deps?)` — async (awaits
  `open_dict`), returns `DictSession | null` (null during SSR). Injectable deps for tests:
  `open_dict`, `is_browser`, `enable_dev_live_share` (live_share.register opens a WebSocket —
  off in tests), `reload` (location.reload isn't stubbable).
- `replace_orama_watcher({ dict_id, make })` — stop-previous-then-make, own globalThis slot;
  entries-ui-store calls it with the watermark-bearing factory.
- `recover_from_schema_outdated` moved in from the layout; takes `reload` through.
- Layout: 265 → 142 lines (role derivation + get_dict_session + entries_ui + writes facade +
  catalog helpers). house has no equivalent session concept yet (checked lib/db/client — its
  sync-context/admin-instance are single-DB per user), so no naming to mirror.
- `dict-session.test.ts`: 9 tests — SSR null, per-dict caching + one initial sync, editor
  re-assert on newly-can_edit hit, set_user_id re-stamp, schema_outdated once-guard,
  snapshot_expired tracker+single toast, sync_halted single toast, watcher replacement + per-dict
  keying.
- Verified: pnpm test (1525) / tsc / lint / check all clean. Manual (real-data equivalent of the
  fixture-bound dict-sync + dict-watch-2ctx, which are NOT runnable against the current real
  pulled achi.db — no e_ja fixture): /tmp/dict-session-verify.mjs PASS — logged-out viewer
  pull-updates live without reload, manager edit→sync→server row, entries→entry→home→search
  navigation sweep, follower tab + leader-close hand-off (queries keep flowing), and a
  mid-session user switch audit-stamps the new user in the server db (verified
  `updated_by_user_id`). Real entry's phonetic restored net-zero via the live-db sync path.
- FOUND (pre-existing, logged in .issues/cold-window-scalar-edit-loss.md): scalar field edits
  made during the cold window (live row not yet swapped in) mutate the SSR fallback entry and are
  SILENTLY dropped — no guard, no toast.

Original plan below.

---

## Problem

"Everything that must exist exactly once per open dictionary" is ONE concept maintained as
THREE separately-keyed `globalThis` caches in three modules with three lifecycles:

| Registry | Module | Owns |
|---|---|---|
| `__ld_dict_clients` | `site/src/lib/db/dict-client/dict-lifecycle.ts` (109 lines) | transport client per dict, editor-role re-assert on cache hit (`set_role` idempotent), auth refresh |
| `__ld_dict_connections` | `site/src/routes/[dictionaryId]/+layout.ts` (265 lines) | `DictLiveDb` + `DictSyncStatus` + broadcast-sentinel subscriptions (schema_outdated auto-reload / snapshot_expired toast / sync_halted toast, each with once-guards) + dev SQL-proxy registration (`live_share.register`) + `set_user_id` refresh on auth change + initial `sync_now()` fire-and-forget |
| `__ld_orama_watchers` | `site/src/lib/search/entries-ui-store.ts` | orama watcher stop/replace per navigation (avoid stacked subscribers), watermark computation from the bundle |

To understand "what is alive for dict X and when does it die" you read three files and mentally
merge their cache-hit/miss branches. The subtle invariants — each one a past bug per the
comments — are guarded in DIFFERENT modules:

- re-assert editor capability when a cached pull-only connection gains edit rights (layout, the
  `else if (can_edit)` branch)
- refresh `user_id` for audit stamping after login/logout while a dict is open (layout, after
  cache read)
- stop the previous orama watcher before starting a new one on re-navigation (entries-ui-store)
- `recover_from_schema_outdated` reload-guard via sessionStorage (layout bottom, uses
  `client-behind-recovery.ts`)

## Design

One module `site/src/lib/db/dict-client/dict-session.ts` owning a SINGLE per-dict registry:

```ts
export interface DictSession {
  connection: DictConnection
  dict_db: DictLiveDb
  sync_status: DictSyncStatus
}

export async function get_dict_session({ dict_id, can_edit, user_id, t }: {
  dict_id: string
  can_edit: boolean
  user_id: string | undefined
  t: TranslateFunction
}): Promise<DictSession>
```

Internally it:

1. Wraps (or absorbs) `open_dict` from `dict-lifecycle.ts` — consider merging the
   `__ld_dict_clients` cache INTO this module so there is exactly one registry; `dict-lifecycle`'s
   editor-promotion and auth-refresh logic comes along. If merging is too invasive, keep
   `dict-lifecycle` as the transport-level cache and make dict-session the only CALLER —
   but prefer the merge (deletion test: it concentrates).
2. On first open per dict: creates DictLiveDb + DictSyncStatus, subscribes the broadcast
   sentinels (move `recover_from_schema_outdated` + the toast logic here from `+layout.ts`,
   including the once-guards and the `mark_snapshot_expired` call), fires the initial
   `sync_now()` with the existing error logging, registers the dev SQL proxy (`live_share`)
   under `dev` only.
3. On cache hit: re-asserts editor capability if `can_edit` newly true; always
   `dict_db.set_user_id(user_id)`.
4. Owns the orama-watcher slot: expose `set_watcher(dict_id, watcher)` or better, move the
   stop/replace logic here as `replace_orama_watcher({ dict_id, make: () => watcher })` so
   `entries-ui-store.ts` calls one line and the registry lives with the others. (The watcher is
   created by entries-ui-store because it needs the bundle watermark — keep creation there,
   move only the registry/replacement semantics.)

`+layout.ts` then shrinks to: role derivation (unchanged) + `get_dict_session(...)` +
`create_entries_ui_store(...)` + the returned data object. Target: layout under ~100 lines.

### Constraints / gotchas

- **SSR**: everything session-y is `browser`-only today (layout guards with `if (browser)`).
  `get_dict_session` should no-op/return nulls on server — keep the layout's null-typed
  `dict_db/connection/dict_sync_status` contract intact.
- The layout re-runs on EVERY navigation within a dict and on `invalidateAll` (login/logout,
  persona switch) — the session must be idempotent and cheap on cache hits (it is today;
  preserve that).
- `DICTIONARY_UPDATED_LOAD_TRIGGER` invalidation, `update_dictionary`, `about_is_too_short`,
  `url_from_storage_path` stay in the layout (they're catalog/UI, not session).
- Toasts need `t` — note the translate function is passed per-call, but subscriptions are
  registered once with the FIRST `t`. That's today's behavior too (closure over first load's
  `t`); fine to keep, note it in a comment.
- Broadcast subscription happens ONCE per dict per tab lifetime — preserve; don't resubscribe
  per navigation.
- Check `dict-boot-progress.svelte.ts` and `DictBootProgress.svelte` (routes root) for any
  coupling to `open_dict` timing.
- house parity: this is LD-specific composition ABOVE the parity-shared worker harness — do not
  touch `worker/` files (PARITY.md manifest). But mirror house's naming if house has an
  equivalent session concept (check `~/code/house/site/src/lib/db/` for prior art before
  inventing names).

## Tests

`dict-session.test.ts` with an injectable `open_dict` stub (make the dependency explicit — a
`deps` param defaulting to the real one) + `memory-connection.ts`:

- second call with `can_edit` newly true calls `set_role`/re-open exactly once (spy)
- login mid-session: second call with a new user_id re-stamps `dict_db.set_user_id`
- watcher replacement: two `replace_orama_watcher` calls → first watcher's `stop()` called
- broadcast sentinels: emitting `schema_outdated` twice → recovery handled once;
  `snapshot_expired` → `mark_snapshot_expired` + one toast; `sync_halted` → one toast
- server-side call (no browser) returns the null shape

(For toast/t, inject or spy on the toast module via vitest module mock.)

## Verification

- `pnpm test`, `tsc`, `pnpm lint`, `pnpm check`
- Manual dev: open a dict, navigate entries→entry→home (no stacked watchers — check no duplicate
  `tables_changed` re-index churn in console), log in/out while dict open then make an edit and
  confirm `updated_by_user_id` stamps the new user (sqlite-query skill), open a second tab
  (follower works), kill the leader tab (hand-off works).
- e2e scripts still pass where runnable: `site/e2e/dict-sync.mjs`, `dict-watch-2ctx.mjs` (read
  `site/e2e/E2E.md` for how to run).
