import { error } from '@sveltejs/kit'
import type { TablesUpdate } from '$lib/types'
import { readable } from 'svelte/store'
import type { LayoutLoad } from './$types'
import type { DictConnection } from '$lib/db/dict-client/worker-connection'
import type { DictLiveDb } from '$lib/db/dict-client/dict-live-db.svelte'
import type { TranslateFunction } from '$lib/i18n/types'
import type { ReloadGuard } from '$lib/db/client/client-behind-recovery'
import { CLIENT_BEHIND_GUARD_KEY, decide_client_behind_recovery } from '$lib/db/client/client-behind-recovery'
import { MINIMUM_ABOUT_LENGTH, ResponseCodes } from '$lib/constants'
import { dbOperations, DICTIONARY_UPDATED_LOAD_TRIGGER } from '$lib/dbOperations'
import { url_from_storage_path } from '$lib/helpers/media'
import { create_dict_live_db } from '$lib/db/dict-client/dict-live-db.svelte'
import { DictSyncStatus } from '$lib/db/dict-client/dict-sync-status.svelte'
import { open_dict } from '$lib/db/dict-client/dict-lifecycle'
import { live_share } from '$lib/db/client/live-share.svelte'
import { toast } from '$lib/svelte-pieces/toast.svelte'
import { api_dictionaries_catalog } from '$api/dictionaries/[id]/catalog/_call'
import { PUBLIC_STORAGE_BUCKET } from '$env/static/public'
import { browser, dev } from '$app/environment'
import { invalidate } from '$app/navigation'
import { create_entries_ui_store } from '$lib/search/entries-ui-store'

interface DictLayoutGlobals {
  __ld_dict_connections?: Record<string, { connection: DictConnection, dict_db: DictLiveDb, sync_status: DictSyncStatus }>
}

export const load: LayoutLoad = async ({ parent, depends, data }) => {
  // Catalog-edit refresh hinges on this: `invalidate(DICTIONARY_UPDATED_LOAD_TRIGGER)`
  // re-runs THIS universal load, and because it `await parent()`s a server load
  // (`+layout.server.ts`, which holds the authoritative catalog row), SvelteKit
  // re-runs that parent too and re-reads the catalog. Don't remove the
  // `await parent()` below or catalog edits (settings/about/grammar) silently
  // stop refreshing. (The server layout itself does NOT depend on this trigger.)
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
    // `admin_level` is preview-aware (the "View as…" persona), but it's read once
    // here and baked into role / can_edit / the entries-search `readable(admin_level)`
    // below — so an active preview downgrades this view on the NEXT navigation into a
    // dictionary, not live while already on the page (no invalidation fires). Mirrors
    // house's accepted search-bound-once gap; see .issues/view-as-persona-preview.md.
    const { admin_level } = auth_user
    const is_site_admin = admin_level >= 1
    // `dict_roles` is a browser-only localStorage cache (empty during SSR), so
    // fall back to `ssr_role` (resolved from shared.db in +layout.server.ts) —
    // otherwise a hard load of an editor-gated page 403s until client hydration.
    const role_grant = dict_roles.roles.find(grant => grant.dictionary_id === dictionary_id)?.role
    const role = is_site_admin ? 'admin' : (role_grant ?? data.ssr_role ?? null)
    const is_manager = role === 'admin' || role === 'manager'
    const is_contributor = role === 'admin' || role === 'contributor'
    const can_edit = is_manager || is_contributor || role === 'editor'
    // Change-history visibility: editor rank or above (manager/admin), NOT bare
    // contributors. Mirrors the server gate `verify_auth_dict_role(…, 'editor')`.
    const is_editor_or_above = role === 'admin' || role === 'manager' || role === 'editor'

    const default_entries_per_page = 20

    // vps-migration M4 write/sync: open the browser wa-sqlite dict.db (everyone;
    // editors push, viewers pull-only) via the per-dict leader worker. It's the
    // client source of truth — the Orama worker is fed from it, and saves write
    // to it. Cached per dict_id on globalThis to survive layout invalidation.
    let connection: DictConnection | null = null
    let dict_db: DictLiveDb | null = null
    let dict_sync_status: DictSyncStatus | null = null
    if (browser) {
      const globals = globalThis as DictLayoutGlobals
      globals.__ld_dict_connections ??= {}
      let cached = globals.__ld_dict_connections[dictionary_id]
      if (!cached) {
        const conn = await open_dict({ dict_id: dictionary_id, has_editor_role: can_edit, auth: {} })
        // Bootstrap sync. OPFS-backed boots already hold the snapshot on disk,
        // so the `/changes` round-trip is fire-and-forget — first paint renders
        // local data and deltas fill in reactively (the apply broadcasts
        // `tables_changed`, re-querying every store + the Orama feed). A
        // MemoryVFS fallback boot (pre-iOS-17) starts EMPTY and pull-since-null
        // is its only data source, so it still blocks to avoid an empty flash.
        const initial_sync = conn.sync_now().catch(err => console.error('initial dict sync failed', err))
        if (!conn.is_opfs_backed)
          await initial_sync
        cached = { connection: conn, dict_db: create_dict_live_db(conn, { user_id: auth_user.user?.id }), sync_status: new DictSyncStatus(conn) }
        globals.__ld_dict_connections[dictionary_id] = cached

        // Surface sync-fatal sentinels (these otherwise die silently in the
        // worker). Both arrive on EVERY tab via the BroadcastChannel.
        //   schema_outdated  = this bundle is older than the server's schema.
        //     The sync engine lives in ONE per-dict leader worker, so reloading
        //     a single tab just makes it a follower of the still-alive stale
        //     leader (the "reload doesn't help" loop). Auto-reload ALL tabs to
        //     evict that leader so a fresh one boots on the new bundle. Guarded
        //     to one reload per window; if it recurs we fall back to a toast.
        //   snapshot_expired = cursor > 60 days behind. The worker auto-resets
        //     viewers/clean editors in place; the toast matters for editors with
        //     un-pushed writes (do NOT auto-reload — that's not a stale bundle).
        let schema_recovery_handled = false
        let snapshot_toasted = false
        conn.subscribe_broadcasts((broadcast) => {
          if (broadcast.type === 'schema_outdated') {
            if (schema_recovery_handled)
              return
            schema_recovery_handled = true
            recover_from_schema_outdated({ t })
            return
          }
          if (broadcast.type === 'snapshot_expired' && !snapshot_toasted) {
            snapshot_toasted = true
            toast(t('misc.local_data_expired'), { action: { label: t('misc.reload'), callback: () => location.reload() }, dismiss_label: t('misc.close') })
          }
        })

        // Dev-only: expose this dict.db to the SQL proxy under a composite
        // client_id so `sqlite-query.sh --dict <id>` can reach it. Writes route
        // through the DictConnection's `execute()` → leader-worker broadcast, so
        // open tabs live-update. No-op in prod (`dev` is false).
        if (dev) {
          const email = auth_user.user?.email ?? auth_user.user?.id ?? 'dev'
          live_share.register({ connection: conn, client_id: `${email}::dict::${dictionary_id}` })
        }
      } else if (can_edit) {
        // The connection was cached (possibly opened pull-only before the user
        // gained edit rights — login or role grant mid-session). Re-assert the
        // editor capability: `open_dict` reuses the cached per-dict client and
        // `set_role` is idempotent, so this is cheap. Without it, local writes
        // would queue dirty=1 and never push until a full reload.
        void open_dict({ dict_id: dictionary_id, has_editor_role: true, auth: {} })
          .catch(err => console.warn('editor capability re-assert failed (retried next load)', err))
      }
      ;({ connection, dict_db, sync_status: dict_sync_status } = cached)
      // The dict_db is cached on globalThis and survives layout invalidation, so
      // refresh who gets audit-stamped on writes after a login/logout while a
      // dict is open (this load re-runs on auth changes via invalidateAll).
      dict_db?.set_user_id(auth_user.user?.id)
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
      is_editor_or_above,
      can_edit,
      dict_db,
      connection,
      dict_sync_status,
      about_is_too_short,
      update_dictionary,
      url_from_storage_path: (path: string) => url_from_storage_path(path, PUBLIC_STORAGE_BUCKET),
      default_entries_per_page,
      dbOperations,

      entries_data: entries_ui,
      speakers: entries_ui.speakers,
      tags: entries_ui.tags,
      dialects: entries_ui.dialects,
      sources: entries_ui.sources,
      search_entries: entries_ui.search_entries,
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

/**
 * Auto-reload to escape a `schema_outdated` block (a stale per-dict leader
 * worker pinning an old bundle), or fall back to a manual-reload toast if we
 * already tried recently (see `client-behind-recovery`).
 */
function recover_from_schema_outdated({ t }: { t: TranslateFunction }): void {
  let stored: ReloadGuard | null = null
  try {
    const raw = sessionStorage.getItem(CLIENT_BEHIND_GUARD_KEY)
    if (raw)
      stored = JSON.parse(raw) as ReloadGuard
  } catch { /* sessionStorage unavailable or malformed — treat as no prior reload */ }

  const decision = decide_client_behind_recovery({ stored, now: Date.now() })
  if (decision.action === 'reload') {
    try { sessionStorage.setItem(CLIENT_BEHIND_GUARD_KEY, JSON.stringify(decision.next)) } catch { /* ignore */ }
    location.reload()
    return
  }

  toast(t('misc.app_update_needed'), { action: { label: t('misc.reload'), callback: () => location.reload() }, dismiss_label: t('misc.close') })
}
