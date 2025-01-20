import { createUserStore } from 'sveltefirets'
import { derived } from 'svelte/store'
import type { IUser } from '@living-dictionaries/types'
import { createPersistedStore } from 'svelte-pieces'
import type { LayoutLoad } from './$types'
import { getSupportedLocale } from '$lib/i18n/locales'
import { getTranslator } from '$lib/i18n'
import { defaultColumns } from '$lib/stores/columns'
import { getSupabase } from '$lib/supabase'

export const load: LayoutLoad = async ({ url: { searchParams }, data: { serverLocale, user_from_cookies } }) => {
  const urlLocale = searchParams.get('lang')
  const locale = getSupportedLocale(urlLocale || serverLocale) || 'en'
  const t = await getTranslator(locale)

  const supabase = getSupabase()
  const user = createUserStore<IUser>({ startWith: user_from_cookies })
  const admin = derived(user, $user => $user?.roles?.admin || 0)

  const columns_key = `table_columns_03.18.2024-${user_from_cookies?.uid}` // rename when adding more columns to invalidate the user's cache
  const preferred_table_columns = createPersistedStore(columns_key, defaultColumns)

  return {
    locale,
    t,
    supabase,
    user,
    admin,
    preferred_table_columns,
    user_from_cookies,
  }
}
