import { derived } from 'svelte/store'
import { createPersistedStore } from 'svelte-pieces'
import type { LayoutLoad } from './$types'
import { getSupportedLocale } from '$lib/i18n/locales'
import { getTranslator } from '$lib/i18n'
import { defaultColumns } from '$lib/stores/columns'
import { getSession, getSupabase } from '$lib/supabase'
import { createUserStore } from '$lib/supabase/user'
import { create_my_dictionaries_store } from '$lib/supabase/dictionaries'

export const load: LayoutLoad = async ({ url: { searchParams }, data: { serverLocale, access_token, refresh_token, user_latitude, user_longitude } }) => {
  const urlLocale = searchParams.get('lang')
  const locale = getSupportedLocale(urlLocale || serverLocale) || 'en'
  const t = await getTranslator(locale)

  const supabase = getSupabase()
  const authResponse = await getSession({ supabase, access_token, refresh_token })

  const user_id = authResponse?.data?.user?.id
  const user = createUserStore({ supabase, authResponse })
  const my_dictionaries = create_my_dictionaries_store({ supabase, user_id })
  const admin = derived(user, $user => $user?.app_metadata.admin || 0)

  const columns_key = `table_columns_03.18.2024-${user_id}` // rename when adding more columns to invalidate the user's cache
  const preferred_table_columns = createPersistedStore(columns_key, defaultColumns)
  const mode = import.meta.env.MODE as 'development' | 'production'

  return {
    locale,
    t,
    supabase,
    user,
    my_dictionaries,
    authResponse,
    admin,
    preferred_table_columns,
    mode,
    user_latitude,
    user_longitude,
  }
}
