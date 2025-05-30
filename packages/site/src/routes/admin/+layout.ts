import type { Tables } from '@living-dictionaries/types'
import type { UserForAdminTable } from '@living-dictionaries/types/supabase/users.types'
import type { LayoutLoad } from './$types'
import { inviteHelper } from '$lib/helpers/inviteHelper'
import { cached_query_data_store } from '$lib/supabase/cached-query-data'

export const load = (async ({ parent }) => {
  const { supabase } = await parent()

  // TODO delete this code since now it has been stored in layout root
  // const dictionaries = cached_query_data_store<DictionaryView>({
  //   materialized_query: supabase.from('materialized_admin_dictionaries_view')
  //     .select(),
  //   live_query: supabase.from('dictionaries_view')
  //     .select(),
  //   key: 'dictionaries',
  // })

  const users = cached_query_data_store<UserForAdminTable>({
    live_query: supabase.rpc('users_for_admin_table')
      .select(),
    key: 'users',
    order_field: 'id',
  })

  const dictionary_roles = cached_query_data_store<Tables<'dictionary_roles'>>({
    live_query: supabase.from('dictionary_roles')
      .select(),
    key: 'dictionary_roles',
    order_field: 'created_at',
    id_fields: ['dictionary_id', 'user_id'],
  })

  async function get_invites() {
    const { supabase } = await parent()
    const { data: invites, error } = await supabase.from('invites')
      .select()
      .in('status', ['queued', 'sent'])

    if (error) {
      console.error(error)
      alert(error.message)
      return []
    }
    return invites
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
    // dictionaries,
    users,
    dictionary_roles,
    get_invites,
    add_editor,
    remove_editor,
    inviteHelper,
  }
}) satisfies LayoutLoad
