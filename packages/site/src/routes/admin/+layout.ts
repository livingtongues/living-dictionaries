import type { DictionaryView } from '@living-dictionaries/types'
import type { LayoutLoad } from './$types'
import { inviteHelper } from '$lib/helpers/inviteHelper'
import { cached_query_data_store } from '$lib/supabase/cached-query-data'

export const load = (async ({ parent }) => {
  const { supabase } = await parent()

  const public_dictionaries = cached_query_data_store<DictionaryView>({
    materialized_query: supabase.from('materialized_admin_dictionaries_view')
      .select()
      .eq('public', true),
    live_query: supabase.from('dictionaries_view')
      .select()
      .eq('public', true),
    key: 'public_dictionaries',
    log: true,
  })

  const private_dictionaries = cached_query_data_store<DictionaryView>({
    materialized_query: supabase.from('materialized_admin_dictionaries_view')
      .select()
      .neq('public', true)
      .is('con_language_description', null),
    live_query: supabase.from('dictionaries_view')
      .select()
      .neq('public', true)
      .is('con_language_description', null),
    key: 'private_dictionaries',
    log: true,
  })

  const other_dictionaries = cached_query_data_store<DictionaryView>({
    materialized_query: supabase.from('materialized_admin_dictionaries_view')
      .select()
      .neq('public', true)
      .not('con_language_description', 'is', null),
    live_query: supabase.from('dictionaries_view')
      .select()
      .neq('public', true)
      .not('con_language_description', 'is', null),
    key: 'other_dictionaries',
    log: true,
  })

  async function get_dictionary_roles() {
    const { supabase } = await parent()
    const { data: dictionary_roles, error } = await supabase.from('dictionary_roles')
      .select()

    if (error) {
      console.error(error)
      alert(error.message)
      return []
    }
    return dictionary_roles
  }

  async function get_invites() {
    const { supabase } = await parent()
    const { data: invites, error } = await supabase.from('invites')
      .select()

    if (error) {
      console.error(error)
      alert(error.message)
      return []
    }
    return invites
  }

  async function get_users_with_roles() {
    const { supabase } = await parent()
    const { data: users_with_dictionary_ids, error } = await supabase.rpc('users_with_dictionary_roles')
      .select()
    if (error) {
      console.error(error)
      alert(error.message)
      return []
    }
    return users_with_dictionary_ids
  }

  async function add_editor({ role, dictionary_id, user_id }: { role: 'manager' | 'contributor', dictionary_id: string, user_id: string }) {
    const { supabase } = await parent()
    const { error } = await supabase.from('dictionary_roles')
      .insert({ dictionary_id, user_id, role })
    if (error) {
      console.error(error)
      alert(error.message)
    }
  }

  async function remove_editor({ dictionary_id, user_id }: { dictionary_id: string, user_id: string }) {
    const { supabase } = await parent()
    const { error } = await supabase.from('dictionary_roles')
      .delete()
      .eq('dictionary_id', dictionary_id)
      .eq('user_id', user_id)
    if (error) {
      console.error(error)
      alert(error.message)
    }
  }

  return {
    public_dictionaries,
    private_dictionaries,
    other_dictionaries,
    get_users_with_roles,
    add_editor,
    remove_editor,
    get_dictionary_roles,
    get_invites,
    inviteHelper,
  }
}) satisfies LayoutLoad
