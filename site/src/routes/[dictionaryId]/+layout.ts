import { error } from '@sveltejs/kit'
import type { TablesUpdate } from '$lib/types'
import { readable } from 'svelte/store'
import type { LayoutLoad } from './$types'
import type { DictConnection } from '$lib/db/dict-client/dict-connection'
import type { DictLiveDb } from '$lib/db/dict-client/dict-live-db.svelte'
import { MINIMUM_ABOUT_LENGTH, ResponseCodes } from '$lib/constants'
import { dbOperations, DICTIONARY_UPDATED_LOAD_TRIGGER } from '$lib/dbOperations'
import { url_from_storage_path } from '$lib/helpers/media'
import { create_dict_live_db } from '$lib/db/dict-client/dict-live-db.svelte'
import { open_dict } from '$lib/db/dict-client/shared-worker-lifecycle'
import { api_dictionaries_catalog } from '$api/dictionaries/[id]/catalog/_call'
import { PUBLIC_STORAGE_BUCKET } from '$env/static/public'
import { browser } from '$app/environment'
import { invalidate } from '$app/navigation'
import { create_entries_ui_store } from '$lib/search/entries-ui-store'

interface DictLayoutGlobals {
  __ld_dict_connections?: Record<string, { connection: DictConnection, dict_db: DictLiveDb }>
}

export const load: LayoutLoad = async ({ parent, depends, data }) => {
  depends(DICTIONARY_UPDATED_LOAD_TRIGGER)

  try {
    const { auth_user, dict_roles } = await parent()

    // M4: the catalog row is resolved server-side from shared.db in +layout.server.ts.
    // Long-form `about`/`grammar`/`citation`/`write_in_collaborators` are folded onto it
    // (legacy `dictionary_info`).
    const { dictionary } = data
    const dictionary_id = dictionary.id

    // M4-auth: role resolves from the real `dictionary_roles` cache + the admin
    // allow-list. Plain values, recomputed on every load (login / logout / the
    // dev admin-level toggle all `invalidateAll`). Server push endpoints
    // re-check the role on every write (verify-dict-role), so a stale cache is
    // safe — UI badges just lag.
    const { admin_level } = auth_user
    const is_site_admin = admin_level >= 1
    const role_grant = dict_roles.roles.find(grant => grant.dictionary_id === dictionary_id)?.role
    const role = is_site_admin ? 'admin' : (role_grant ?? null)
    const is_manager = role === 'admin' || role === 'manager'
    const is_contributor = role === 'admin' || role === 'contributor'
    const can_edit = is_manager || is_contributor || role === 'editor'

    const default_entries_per_page = 20

    // vps-migration M4 write/sync: open the browser wa-sqlite dict.db (everyone;
    // editors push, viewers pull-only) via the SharedWorker. It's the client
    // source of truth — the Orama worker is fed from it, and saves write to it.
    // Cached per dict_id on globalThis to survive layout invalidation.
    let connection: DictConnection | null = null
    let dict_db: DictLiveDb | null = null
    if (browser) {
      const globals = globalThis as DictLayoutGlobals
      globals.__ld_dict_connections ??= {}
      let cached = globals.__ld_dict_connections[dictionary_id]
      if (!cached) {
        const conn = await open_dict({ dict_id: dictionary_id, has_editor_role: can_edit, auth: {} })
        // Bootstrap: snapshot (OPFS) already populated the file; sync_now pulls
        // any deltas and backfills a fresh/MemoryVFS db (pull-since-null).
        await conn.sync_now().catch(err => console.error('initial dict sync failed', err))
        cached = { connection: conn, dict_db: create_dict_live_db(conn) }
        globals.__ld_dict_connections[dictionary_id] = cached
      }
      ;({ connection, dict_db } = cached)
    }

    const entries_ui = create_entries_ui_store({ dictionary_id, can_edit: readable(can_edit), admin: readable(admin_level), connection, dict_db })

    function about_is_too_short() {
      return (dictionary.about?.length || 0) < MINIMUM_ABOUT_LENGTH
    }

    async function update_dictionary(change: TablesUpdate<'dictionaries'>) {
      const { error } = await api_dictionaries_catalog(dictionary_id, change)
      if (error) throw new Error(error.message)
      await invalidate(DICTIONARY_UPDATED_LOAD_TRIGGER)
    }

    return {
      dictionary,
      is_manager,
      is_contributor,
      can_edit,
      dict_db,
      connection,
      about_is_too_short,
      update_dictionary,
      url_from_storage_path: (path: string) => url_from_storage_path(path, PUBLIC_STORAGE_BUCKET),
      default_entries_per_page,
      dbOperations,

      entries_data: entries_ui,
      speakers: entries_ui.speakers,
      tags: entries_ui.tags,
      dialects: entries_ui.dialects,
      reset_caches: entries_ui.reset_caches,
      search_entries: entries_ui.search_entries,
      search_index_updated: entries_ui.search_index_updated,
    }
  } catch (err) {
    error(ResponseCodes.INTERNAL_SERVER_ERROR, err)
  }
}
