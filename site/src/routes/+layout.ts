import type { LayoutLoad } from './$types'
import { browser } from '$app/environment'
import { createPersistedStore } from '$lib/svelte-pieces'
import { getSupportedLocale } from '$lib/i18n/locales'
import { getTranslator } from '$lib/i18n'
import { defaultColumns } from '$lib/stores/columns'
import { get_auth_user } from '$lib/auth/user.svelte'
import { get_my_dictionary_roles } from '$lib/me/dictionary-roles.svelte'
import { create_dictionaries_store, create_my_dictionaries_store } from '$lib/dictionaries'

export const load: LayoutLoad = async ({ url: { searchParams }, data: { serverLocale, ssr_user, user_latitude, user_longitude } }) => {
  const urlLocale = searchParams.get('lang')
  const locale = getSupportedLocale(urlLocale || serverLocale) || 'en'
  const t = await getTranslator(locale)

  // Source of truth = the server's verified session cookie, surfaced as
  // `ssr_user`. Re-runs on every navigation/invalidation so login, logout, and
  // token expiry stay in sync across the shell.
  const auth_user = get_auth_user()
  const dict_roles = get_my_dictionary_roles()
  if (ssr_user) {
    auth_user.set_session({ user: ssr_user })
    dict_roles.set_user(ssr_user.id)
    if (browser) {
      // Warm cache (localStorage-hydrated) → refresh in the background. Cold
      // cache (first login / fresh browser) → AWAIT so the `[dictionaryId]`
      // layout computes `can_edit` from real roles instead of flashing
      // read-only until the next invalidation.
      if (dict_roles.fetched_at)
        void dict_roles.refresh_if_stale()
      else
        await dict_roles.refresh()
    }
  } else {
    auth_user.user = null
    dict_roles.forget()
  }

  const dictionaries = create_dictionaries_store()
  const my_dictionaries = create_my_dictionaries_store({ user_id: ssr_user?.id })

  const columns_key = `table_columns_03.18.2024-${ssr_user?.id ?? 'anon'}` // rename when adding more columns to invalidate the user's cache
  const preferred_table_columns = createPersistedStore(columns_key, defaultColumns)
  const mode = import.meta.env.MODE as 'development' | 'production'

  return {
    locale,
    t,
    auth_user,
    dict_roles,
    ssr_user,
    admin: ssr_user?.admin_level ?? 0,
    dictionaries,
    my_dictionaries,
    preferred_table_columns,
    mode,
    user_latitude,
    user_longitude,
  }
}
