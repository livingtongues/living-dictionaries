import { error } from '@sveltejs/kit'
import type { TablesUpdate } from '$lib/types'
import { get, readable } from 'svelte/store'
import type { LayoutLoad } from './$types'
import { DICTIONARY_UPDATED_LOAD_TRIGGER, ResponseCodes } from '$lib/constants'
import { url_from_storage_path } from '$lib/utils/media-url'
import { create_guarded_writes } from '$lib/db/dict-client/guarded-writes'
import { get_dict_session } from '$lib/db/dict-client/dict-session'
import { toast } from '$lib/state/toast.svelte'
import { api_dictionaries_catalog } from '$api/dictionaries/[id]/catalog/_call'
import { PUBLIC_STORAGE_BUCKET } from '$env/static/public'
import { browser } from '$app/environment'
import { invalidate } from '$app/navigation'
import { create_entries_ui_store } from '$lib/search/entries-ui-store'

export const load: LayoutLoad = async ({ parent, depends, data }) => {
  // Catalog-edit refresh: `invalidate(DICTIONARY_UPDATED_LOAD_TRIGGER)` re-runs
  // this load AND `+layout.server.ts` (which registers the same trigger and holds
  // the authoritative catalog row). Both registrations matter — a universal
  // load's `depends` does NOT drag its server parent along on invalidate, so
  // without the server-side one this re-run reads a cached `data.dictionary`.
  depends(DICTIONARY_UPDATED_LOAD_TRIGGER)

  try {
    const { auth_user, dict_roles, t } = await parent()

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
    // `admin_level` + `preview` are the preview-aware "View as…" persona. They're
    // read once here and baked into role / can_edit / the entries-search
    // `readable(admin_level)` below, so switching persona invalidates this load
    // (`DICTIONARY_UPDATED_LOAD_TRIGGER`, fired from UserMenu) to re-derive live.
    const { admin_level, preview } = auth_user
    const is_site_admin = admin_level >= 1
    // `dict_roles` is a browser-only localStorage cache (empty during SSR), so
    // fall back to `ssr_role` (resolved from shared.db in +layout.server.ts) —
    // otherwise a hard load of an editor-gated page 403s until client hydration.
    const role_grant = dict_roles.roles.find(grant => grant.dictionary_id === dictionary_id)?.role
    // An active preview FULLY determines the effective role so "View as
    // Manager/Contributor/Visitor" is deterministic regardless of any real grant
    // on this dict: the Manager/Contributor personas carry a `dict_role`; Visitor
    // carries none (→ null, a pure viewer). Site-admin tiers (Super Manager and up)
    // map to 'admin'. Without a preview, the real grant / ssr_role wins as before.
    const role = is_site_admin
      ? 'admin'
      : preview
        ? (preview.dict_role ?? null)
        : (role_grant ?? data.ssr_role ?? null)
    const is_manager = role === 'admin' || role === 'manager'
    const is_contributor = role === 'admin' || role === 'contributor'
    const can_edit = is_manager || is_contributor

    const default_entries_per_page = 20

    // vps-migration M4 write/sync: everything that lives exactly once per open
    // dict (leader-worker connection, DictLiveDb, sync status, broadcast
    // sentinels, dev SQL proxy) is owned by `dict-session.ts`. Null during SSR;
    // cache hits re-stamp editor capability + audit user (this load re-runs on
    // every navigation and on invalidateAll).
    const session = await get_dict_session({ dict_id: dictionary_id, can_edit, user_id: auth_user.user?.id, user_email: auth_user.user?.email, t })
    const connection = session?.connection ?? null
    const dict_db = session?.dict_db ?? null
    const dict_sync_status = session?.sync_status ?? null

    const entries_ui = create_entries_ui_store({ dictionary_id, can_edit: readable(can_edit), admin: readable(admin_level), connection, dict_db })

    // The one write facade for components (`page.data.writes`) — guard +
    // telemetry + error toast live inside (guarded-writes.ts). Recreated per
    // load run (cheap) so it tracks the current auth/loading state.
    const writes = create_guarded_writes({
      dict_db,
      connection,
      dictionary: { id: dictionary_id, url: dictionary.url },
      get_user_id: () => auth_user.user?.id,
      is_loading: () => get(entries_ui.loading),
      on_error: err => toast.error(err instanceof Error ? err.message : String(err)),
    })

    function about_is_too_short() {
      return !data.about_is_complete
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
      dict_sync_status,
      about_is_too_short,
      update_dictionary,
      url_from_storage_path: (path: string) => url_from_storage_path(path, PUBLIC_STORAGE_BUCKET),
      default_entries_per_page,
      writes,

      entries_data: entries_ui,
      speakers: entries_ui.speakers,
      tags: entries_ui.tags,
      dialects: entries_ui.dialects,
      sources: entries_ui.sources,
      search_entries: entries_ui.search_entries,
      search_sentences: entries_ui.search_sentences,
      search_texts: entries_ui.search_texts,
      search_index_updated: entries_ui.search_index_updated,
    }
  } catch (err) {
    // Surface the REAL error + stack to the telemetry pipeline (console.error is
    // patched by remote-log). Without this the load failure ships as a bare
    // "Internal Error" crash with an empty stack — which is exactly what hid a
    // server-module-in-client-bundle leak that crashed every dictionary open.
    console.error('dictionary layout load failed', err)
    // On the SERVER (first-paint SSR), rethrow the RAW error so `handleError`
    // (hooks.server.ts) captures the real cause + stack into server telemetry
    // (`source='server'`). `error()` wraps it in an HttpError, which SvelteKit
    // treats as "expected" and does NOT pass to handleError — so the cause would
    // otherwise vanish into rotated `docker logs`. In the browser, console.error
    // is patched by remote-log, so the 500 page below is enough.
    if (!browser)
      throw err instanceof Error ? err : new Error(String(err))
    error(ResponseCodes.INTERNAL_SERVER_ERROR, err)
  }
}
