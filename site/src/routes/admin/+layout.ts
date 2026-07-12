import type { LayoutLoad } from './$types'
import type { LiveDb } from '$lib/db/client/live/live-db.svelte'
import type { TableName } from '$lib/db/client/live/types'
import type { SyncableTableName } from '$lib/db/sync/types'
import { browser, dev } from '$app/environment'
import { get_admin_db } from '$lib/db/client/db'
import { live_share } from '$lib/db/client/live-share.svelte'
import { Sync } from '$lib/db/sync/engine.svelte.js'
import { toast } from '$lib/state/toast.svelte'
import { error } from '@sveltejs/kit'

interface AdminLayoutGlobals {
  __ld_admin_sync?: Sync
}

export const load: LayoutLoad = async ({ parent }) => {
  const { auth_user, t: translate } = await parent()

  // Source of truth = SSR-resolved user from the session cookie (set in root
  // `+layout.server.ts`). No session → render the admin shell's signed-out
  // state, which offers the login modal in place (no redirect to /login).
  if (!auth_user.user)
    return { auth_user, db: null as LiveDb | null, sync: null as Sync | null }

  if (!auth_user.is_admin)
    error(403, 'You do not have access to the admin area.')

  if (!browser)
    return { auth_user, db: null as LiveDb | null, sync: null as Sync | null }

  // Singleton — survive layout invalidation.
  const globals = globalThis as AdminLayoutGlobals
  let sync = globals.__ld_admin_sync

  // No-op until sync is created below; closures defer until then.
  let mark_dirty: (table: SyncableTableName) => void = (_table) => {
    void _table
  }
  let live_db_ref: LiveDb | null = null

  const { connection, live_db } = await get_admin_db(auth_user.user.id, {
    on_dirty: t => mark_dirty(t),
  })
  live_db_ref = live_db

  if (!sync) {
    // admin.db sync runs on THIS tab's main thread (per-tab, not a shared leader
    // worker), so a single manual reload genuinely picks up the new bundle. We
    // deliberately do NOT auto-reload (unlike the dict path): an admin may have
    // un-committed in-progress edits, and a surprise reload would lose them.
    // Surface a manual toast once and let them reload when ready.
    let client_behind_toasted = false
    sync = new Sync({
      connection,
      on_tables_changed: (tables) => {
        if (!live_db_ref)
          return
        for (const table of tables)
          live_db_ref.notify_table(table)
      },
      on_client_behind: () => {
        if (client_behind_toasted)
          return
        client_behind_toasted = true
        toast(translate('misc.app_update_needed'), {
          action: { label: translate('misc.reload'), callback: () => location.reload() },
          dismiss_label: translate('misc.close'),
        })
      },
      // Repeat-fatal circuit breaker tripped: the engine halted retrying (the
      // same failure kept recurring). Local writes are safe but NOT reaching
      // the server — prompt a manual reload (never auto-reload an admin).
      on_repeated_failure: () => {
        toast(translate('misc.sync_paused_repeated_failure'), {
          action: { label: translate('misc.reload'), callback: () => location.reload() },
          dismiss_label: translate('misc.close'),
        })
      },
    })
    globals.__ld_admin_sync = sync
  }
  mark_dirty = t => sync.mark_dirty(t)

  // Dev-only: expose the admin shared.db to the SQL proxy so the agent CLI
  // (`scripts/sqlite-query.sh`) can read/write it. client_id = the admin email.
  // No-op in prod (`dev` is false).
  if (dev)
    live_share.register({ connection, client_id: auth_user.user.email ?? auth_user.user.id, notify: t => live_db.notify_table(t as TableName) })

  return { auth_user, db: live_db, sync }
}
