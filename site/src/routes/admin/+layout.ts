import type { LayoutLoad } from './$types'
import type { LiveDb } from '$lib/db/client/live/live-db.svelte'
import type { SyncableTableName } from '$lib/db/sync/types'
import { browser } from '$app/environment'
import { get_admin_db } from '$lib/db/client/db'
import { Sync } from '$lib/db/sync/engine.svelte.js'
import { error } from '@sveltejs/kit'

interface AdminLayoutGlobals {
  __ld_admin_sync?: Sync
}

export const load: LayoutLoad = async ({ parent }) => {
  const { auth_user } = await parent()

  // Source of truth = SSR-resolved user from the session cookie (set in root
  // `+layout.server.ts`). No session → render the admin shell's signed-out
  // state, which offers the login modal in place (no redirect to /login).
  if (!auth_user.user)
    return { auth_user, db: null as LiveDb | null, sync: null as Sync | null }

  if (!auth_user.user.is_admin)
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
    sync = new Sync({
      connection,
      user_id: auth_user.user.id,
      on_tables_changed: (tables) => {
        if (!live_db_ref)
          return
        for (const table of tables)
          live_db_ref.notify_table(table)
      },
      on_client_behind: () => {
        console.warn('Sync blocked: client bundle is behind. Reload to update.')
      },
    })
    globals.__ld_admin_sync = sync
  }
  mark_dirty = t => sync.mark_dirty(t)

  return { auth_user, db: live_db, sync }
}
