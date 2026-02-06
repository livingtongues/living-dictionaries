import type { LayoutLoad } from './$types'
import { browser, dev } from '$app/environment'
import { inviteHelper } from '$lib/helpers/inviteHelper'
import { get_PG_lite } from '$lib/pglite/db'
import { live_share } from '$lib/pglite/live-share.svelte'
import { Sync } from '$lib/pglite/sync/sync-engine.svelte'
import { get } from 'svelte/store'

export const load = (async ({ parent }) => {
  const { supabase, admin, user } = await parent()

  const is_admin = get(admin)
  // PGlite only runs in browser
  if (!browser || !is_admin) {
    return {
      db: null,
      sync: null,
      add_editor: async () => {},
      remove_editor: async () => {},
      inviteHelper,
    }
  }

  // Initialize PGlite (singleton, reused across navigation)
  const { live_db: db, db: drizzle_db, pg } = await get_PG_lite()

  const sync = new Sync(drizzle_db, pg, supabase)

  // Auto-sync on route load
  sync.sync_with_notice()

  // Connect to pglite-proxy in dev mode for Drizzle Studio access
  const $user = get(user)
  if (dev && $user?.email) {
    console.log('Starting live_share with client_id:', $user.email)
    live_share.start({ pg, client_id: $user.email })
  }

  async function add_editor({ role, dictionary_id, user_id }: { role: 'manager' | 'contributor', dictionary_id: string, user_id: string }) {
    await db.dictionary_roles.insert({
      dictionary_id,
      user_id,
      role,
    })
  }

  async function remove_editor({ dictionary_id, user_id }: { dictionary_id: string, user_id: string }) {
    const roles = db.dictionary_roles.rows.filter(
      r => r.dictionary_id === dictionary_id && r.user_id === user_id,
    )
    for (const role of roles) {
      await role._delete()
    }
  }

  return {
    db,
    sync,
    add_editor,
    remove_editor,
    inviteHelper,
  }
}) satisfies LayoutLoad
