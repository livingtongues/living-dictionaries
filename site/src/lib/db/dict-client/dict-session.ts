import type { AuthHeaders } from './worker/instance'
import type { DbClient } from './worker/db-client'
import type { DictConnection } from './worker-connection'
import type { DictLiveDb } from './dict-live-db.svelte'
import type { TranslateFunction } from '$lib/i18n/types'
import type { ReloadGuard } from '$lib/db/client/client-behind-recovery'
import { CLIENT_BEHIND_GUARD_KEY, decide_client_behind_recovery } from '$lib/db/client/client-behind-recovery'
import { create_db_client } from './worker/db-client'
import { ensure_persistent_storage } from './worker/persistent-storage'
import { create_dict_worker_connection } from './worker-connection'
import { end_dict_boot_progress, report_dict_boot_progress } from './dict-boot-progress.svelte'
import { create_dict_live_db } from './dict-live-db.svelte'
import { DictSyncStatus } from './dict-sync-status.svelte'
import { mark_snapshot_expired } from './snapshot-expired-tracker'
import { get_session_id, log_event } from '$lib/debug/remote-log'
import { live_share } from '$lib/db/client/live-share.svelte'
import { toast } from '$lib/state/toast.svelte'
import { browser, dev, version } from '$app/environment'

/**
 * Everything that must exist exactly once per open dictionary, in one module
 * with one lifecycle story. Two layers, both cached per dict_id on
 * `globalThis` for the tab's lifetime (module state alone would reset on dev
 * HMR re-evals and re-elect workers / stack watchers):
 *
 * 1. TRANSPORT (`__ld_dict_clients`, `open_dict`): the leader-worker `DbClient`
 *    per dict — one per dict per tab; the election winner spawns the leader
 *    dedicated worker, followers RPC it over BroadcastChannel. `open_dict`
 *    returns the `DictConnection` shim IMMEDIATELY (no ready-wait) so
 *    navigating into a dictionary stays instant: queries queue in the
 *    transport until the leader boots (cold-boot snapshot download streams to
 *    the root-layout `DictBootProgress` bar). No unload teardown needed — a
 *    dedicated worker dies with its document and Web Locks auto-release, so
 *    leadership hands off to another tab by itself. Editor tabs re-assert
 *    `set_role` after EVERY leader `ready` (a hand-off can promote a fresh
 *    viewer-booted leader mid-session).
 *
 * 2. SESSION (`__ld_dict_connections`, `get_dict_session`): the
 *    `DictLiveDb` + `DictSyncStatus` pair over that connection, the sync-fatal
 *    broadcast sentinels (schema_outdated auto-reload / snapshot_expired toast
 *    / sync_halted toast — subscribed ONCE per dict per tab), the initial
 *    fire-and-forget `sync_now()`, and the dev SQL-proxy registration. The
 *    dict `+layout.ts` calls this on every load run (navigation +
 *    `invalidateAll`); cache hits are cheap and re-stamp the session-scoped
 *    auth state: editor capability re-assert when `can_edit` newly true, and
 *    `set_user_id` so audit stamping follows login/logout while a dict is open.
 *
 * The per-dict Orama watcher slot (`__ld_orama_watchers`,
 * `replace_orama_watcher`) also lives here: `entries-ui-store.ts` creates the
 * watcher (it needs the bundle watermark) but the stop-previous/replace
 * registry semantics — one watcher per dict, never stacked across
 * navigations — belong with the rest of the per-dict lifetime state.
 */

interface DictClientGlobals {
  __ld_dict_clients?: Record<string, { client: DbClient, has_editor_role: boolean, auth: AuthHeaders }>
}

interface OpenDictOptions {
  dict_id: string
  has_editor_role: boolean
  auth: AuthHeaders
}

// Intentionally async-without-await: it no longer awaits `client.ready()` (that's
// what made nav block), but the `Promise<DictConnection>` contract is kept — the
// session's editor re-assert path does `open_dict(...).catch(...)` and callers
// `await` it. Readiness is handled in the background via `on_ready`.
// eslint-disable-next-line require-await
export async function open_dict(options: OpenDictOptions): Promise<DictConnection> {
  const { dict_id } = options
  const globals = globalThis as DictClientGlobals
  globals.__ld_dict_clients ??= {}

  // An editor has precious unsynced local writes — request persistent storage so
  // the browser won't evict them (a one-time Firefox prompt is justified).
  // Idempotent + origin-scoped; a no-op once granted. Viewers stay on the silent
  // path in `db-client.ts` and never see a prompt.
  if (options.has_editor_role)
    void ensure_persistent_storage({ allow_prompt: true })

  let cached = globals.__ld_dict_clients[dict_id]
  if (!cached) {
    let recovery_exhausted = false
    const client = create_db_client({
      instance_options: { dict_id, has_editor_role: options.has_editor_role, auth: options.auth, session_id: get_session_id() || null },
      // Worker-internal boot failures never reach the main-thread console.error
      // patch, so this is our only telemetry window. `last_stage` points the stall
      // at the exact boot phase (a slow `snapshot_fetch` vs a stuck `opfs_open`).
      on_boot_failed: ({ message, last_stage, attempt, will_retry }) => {
        if (!will_retry)
          recovery_exhausted = true
        log_event({
          level: will_retry ? 'warn' : 'error',
          message: will_retry ? 'leader_boot_failed' : 'dict_boot_recovery_exhausted',
          context: { dict_id, boot_message: message, last_stage, attempt, will_retry },
        })
      },
      // Feed the boot download progress bar (root-layout `DictBootProgress`). Only
      // a cold boot that actually downloads a snapshot activates it (see the store).
      on_boot_progress: ({ stage, detail }) => report_dict_boot_progress({ dict_id, stage, detail }),
    })
    cached = { client, has_editor_role: options.has_editor_role, auth: options.auth }
    globals.__ld_dict_clients[dict_id] = cached

    const entry = cached
    client.on_ready(() => {
      if (recovery_exhausted) {
        log_event({ level: 'info', message: 'dict_boot_recovered', context: { dict_id } })
        recovery_exhausted = false
      }
      // Leader is ready — the snapshot is in OPFS and open, so drop the boot bar.
      // Fires on every leader (including hand-offs); ending the bar is idempotent.
      end_dict_boot_progress(dict_id)
      // Re-assert the editor capability on every leader (covers hand-offs to a
      // viewer-booted leader). Idempotent on the instance side.
      if (entry.has_editor_role)
        void client.request({ type: 'set_role', has_editor_role: true, auth: entry.auth }).catch(() => { /* retried on next ready */ })
    })
  } else if (options.has_editor_role && !cached.has_editor_role) {
    // A later open from this tab carries the editor capability — promote.
    cached.has_editor_role = true
    cached.auth = options.auth
    void cached.client.request({ type: 'set_role', has_editor_role: true, auth: options.auth }).catch(() => { /* retried on next ready */ })
  }

  // Return the shim WITHOUT awaiting readiness — navigation stays instant. The
  // boot bar + editor set_role are handled by the `on_ready` callback above (and
  // for an already-cached client the `set_role` above / below covers it).
  return create_dict_worker_connection({ client: cached.client, dict_id })
}

export interface DictSession {
  connection: DictConnection
  dict_db: DictLiveDb
  sync_status: DictSyncStatus
}

interface DictSessionGlobals {
  __ld_dict_connections?: Record<string, DictSession>
  __ld_orama_watchers?: Record<string, { stop: () => void }>
}

export interface DictSessionDeps {
  open_dict: typeof open_dict
  is_browser: boolean
  /** Dev-only SQL-proxy registration (opens a WebSocket) — off in tests. */
  enable_dev_live_share: boolean
  reload: () => void
}

const default_deps: DictSessionDeps = {
  open_dict,
  is_browser: browser,
  enable_dev_live_share: dev,
  reload: () => location.reload(),
}

/**
 * The per-dict client session: everyone opens the browser wa-sqlite dict.db
 * (editors push, viewers pull-only) via the per-dict leader worker — it's the
 * client source of truth (the Orama worker is fed from it, saves write to it).
 * Returns `null` during SSR (the layout's `dict_db`/`connection`/
 * `dict_sync_status` stay null-typed).
 *
 * Note on `t`: the broadcast sentinels are subscribed once per dict per tab
 * with the FIRST load's translate function — a later locale switch keeps
 * toasting in the original locale until reload (long-standing behavior).
 */
export async function get_dict_session({ dict_id, can_edit, user_id, user_email, t }: {
  dict_id: string
  can_edit: boolean
  user_id: string | undefined
  /** For the dev SQL-proxy client id (`<email>::dict::<dict_id>`). */
  user_email?: string | null
  t: TranslateFunction
}, deps: Partial<DictSessionDeps> = {}): Promise<DictSession | null> {
  const { open_dict: open, is_browser, enable_dev_live_share, reload } = { ...default_deps, ...deps }
  if (!is_browser)
    return null

  const globals = globalThis as DictSessionGlobals
  globals.__ld_dict_connections ??= {}
  let session = globals.__ld_dict_connections[dict_id]
  if (!session) {
    const connection = await open({ dict_id, has_editor_role: can_edit, auth: {} })
    // Bootstrap sync — fire-and-forget so navigation stays instant. `open_dict`
    // returns before the leader worker is ready (a cold-boot snapshot download
    // runs in the background), so this `sync_now()` RPC queues in the transport
    // until the leader is up; first paint renders the loading state (or the
    // entry page's server-fetched cold-window content) and deltas fill in
    // reactively as the sync applies (`tables_changed` re-queries every store +
    // the Orama feed). A MemoryVFS fallback boot (pre-iOS-17) may flash an
    // empty list briefly before pull-since-null fills it — accepted.
    void connection.sync_now().catch(err => log_event({
      level: 'error',
      message: 'initial dict sync failed',
      context: { dict_id, code: (err as { code?: string })?.code ?? null, error: (err as Error)?.message ?? String(err) },
    }))
    session = { connection, dict_db: create_dict_live_db(connection, { user_id }), sync_status: new DictSyncStatus(connection) }
    globals.__ld_dict_connections[dict_id] = session

    subscribe_sync_sentinels({ connection, dict_id, t, reload })

    // Dev-only: expose this dict.db to the SQL proxy under a composite
    // client_id so `sqlite-query.sh --dict <id>` can reach it. Writes route
    // through the DictConnection's `execute()` → leader-worker broadcast, so
    // open tabs live-update. No-op in prod (`dev` is false).
    if (enable_dev_live_share)
      live_share.register({ connection, client_id: `${user_email ?? user_id ?? 'dev'}::dict::${dict_id}` })
  } else if (can_edit) {
    // The session was cached (possibly opened pull-only before the user gained
    // edit rights — login or role grant mid-session). Re-assert the editor
    // capability: `open_dict` reuses the cached per-dict client and `set_role`
    // is idempotent, so this is cheap. Without it, local writes would queue
    // dirty=1 and never push until a full reload.
    void open({ dict_id, has_editor_role: true, auth: {} })
      .catch(err => console.warn('editor capability re-assert failed (retried next load)', err))
  }

  // The session survives layout invalidation, so refresh who gets audit-stamped
  // on writes after a login/logout while a dict is open (the layout load re-runs
  // on auth changes via invalidateAll).
  session.dict_db.set_user_id(user_id)
  return session
}

/**
 * Surface sync-fatal sentinels (these otherwise die silently in the worker).
 * Subscribed ONCE per dict per tab lifetime; all arrive on EVERY tab via the
 * BroadcastChannel.
 *   schema_outdated  = this bundle is older than the server's schema. The sync
 *     engine lives in ONE per-dict leader worker, so reloading a single tab
 *     just makes it a follower of the still-alive stale leader (the "reload
 *     doesn't help" loop). Auto-reload ALL tabs to evict that leader so a
 *     fresh one boots on the new bundle. Guarded to one reload per window; if
 *     it recurs we fall back to a toast.
 *   snapshot_expired = cursor > 60 days behind. The worker auto-resets
 *     viewers/clean editors in place; the toast matters for editors with
 *     un-pushed writes (do NOT auto-reload — that's not a stale bundle).
 *   sync_halted = the repeat-fatal circuit breaker tripped (the same
 *     non-transient failure kept recurring), so the engine stopped retrying.
 *     The editor's local writes are safe but NOT reaching the server — prompt
 *     a manual reload (fresh engine); do NOT auto-reload (they may have work
 *     mid-edit).
 */
function subscribe_sync_sentinels({ connection, dict_id, t, reload }: {
  connection: DictConnection
  dict_id: string
  t: TranslateFunction
  reload: () => void
}): void {
  let schema_recovery_handled = false
  let snapshot_toasted = false
  let halt_toasted = false
  connection.subscribe_broadcasts((broadcast) => {
    if (broadcast.type === 'schema_outdated') {
      if (schema_recovery_handled)
        return
      schema_recovery_handled = true
      recover_from_schema_outdated({ t, dict_id, reload })
      return
    }
    if (broadcast.type === 'snapshot_expired') {
      // Proxy for "a reset is in flight" so a concurrent bundle read that
      // hits SQLITE_MISUSE knows why (see entries-ui-store telemetry).
      mark_snapshot_expired(dict_id)
      if (!snapshot_toasted) {
        snapshot_toasted = true
        toast(t('misc.local_data_expired'), { action: { label: t('misc.reload'), callback: () => reload() }, dismiss_label: t('misc.close') })
      }
      return
    }
    if (broadcast.type === 'sync_halted' && !halt_toasted) {
      halt_toasted = true
      toast(t('misc.sync_paused_repeated_failure'), { action: { label: t('misc.reload'), callback: () => reload() }, dismiss_label: t('misc.close') })
    }
  })
}

/**
 * Auto-reload to escape a `schema_outdated` block (a stale per-dict leader
 * worker pinning an old bundle), or fall back to a manual-reload toast if we
 * already tried recently (see `client-behind-recovery`).
 */
function recover_from_schema_outdated({ t, dict_id, reload }: { t: TranslateFunction, dict_id: string, reload: () => void }): void {
  let stored: ReloadGuard | null = null
  try {
    const raw = sessionStorage.getItem(CLIENT_BEHIND_GUARD_KEY)
    if (raw)
      stored = JSON.parse(raw) as ReloadGuard
  } catch { /* sessionStorage unavailable or malformed — treat as no prior reload */ }

  const decision = decide_client_behind_recovery({ stored, now: Date.now() })
  if (decision.action === 'reload') {
    try { sessionStorage.setItem(CLIENT_BEHIND_GUARD_KEY, JSON.stringify(decision.next)) } catch { /* ignore */ }
    // Diagnostic for the client_behind storm: this row's `app_version` is the
    // stale bundle we're reloading AWAY from. If the very next session_start
    // still carries the SAME version, the reload re-served a stale bundle
    // (SW/CDN) rather than picking up the deploy — the pagehide beacon flushes
    // this before the navigation tears the page down.
    log_event({ level: 'info', message: 'schema_outdated_reload', context: { dict_id } })
    reload()
    return
  }

  // Reload guard already fired within the window and it didn't help (stale
  // SW/CDN, or the bundle is genuinely unavailable) — surface a manual toast
  // instead of reload-looping. `version` distinguishes this from the reload row.
  log_event({ level: 'warn', message: 'schema_outdated_reload_gave_up', context: { dict_id, app_version: version } })
  toast(t('misc.app_update_needed'), { action: { label: t('misc.reload'), callback: () => reload() }, dismiss_label: t('misc.close') })
}

/**
 * One Orama watcher per dict — stop the previous one BEFORE creating its
 * replacement so two never run concurrently (stacked subscribers used to
 * reindex twice per change after re-navigation). `entries-ui-store.ts` calls
 * this each time it finishes a bundle load (it owns watcher creation because
 * the watcher needs the bundle watermark).
 */
export function replace_orama_watcher({ dict_id, make }: { dict_id: string, make: () => { stop: () => void } }): void {
  const globals = globalThis as DictSessionGlobals
  globals.__ld_orama_watchers ??= {}
  globals.__ld_orama_watchers[dict_id]?.stop()
  globals.__ld_orama_watchers[dict_id] = make()
}

/** Test/dev hook — drop every per-dict registry so the next call starts fresh. */
export function _reset_for_tests() {
  const client_globals = globalThis as DictClientGlobals
  for (const { client } of Object.values(client_globals.__ld_dict_clients ?? {}))
    client.destroy()
  client_globals.__ld_dict_clients = undefined
  const session_globals = globalThis as DictSessionGlobals
  for (const watcher of Object.values(session_globals.__ld_orama_watchers ?? {}))
    watcher.stop()
  session_globals.__ld_dict_connections = undefined
  session_globals.__ld_orama_watchers = undefined
}
